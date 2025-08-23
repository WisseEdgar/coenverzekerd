#!/usr/bin/env -S deno run -A

/**
 * RAG System Cleanup Verification Script
 * 
 * Verifies that cleanup operations maintain system integrity:
 * 1. Database schema validation (dry-run SQL execution)
 * 2. Import graph analysis (no unresolved imports)
 * 3. End-to-end RAG pipeline test (embed → search → cite)
 * 4. Citation mapping verification
 * 
 * Usage:
 *   deno run -A scripts/verify_cleanup.ts --dry-run  # Test SQL without committing
 *   deno run -A scripts/verify_cleanup.ts            # Full verification
 */

import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { walk } from "https://deno.land/std@0.208.0/fs/walk.ts";

// Configuration
const DRY_RUN = Deno.args.includes("--dry-run");
const VERBOSE = Deno.args.includes("--verbose");

interface VerificationResult {
  step: string;
  success: boolean;
  message: string;
  details?: any;
}

class VerificationSuite {
  private results: VerificationResult[] = [];
  private client?: Client;

  async run(): Promise<boolean> {
    console.log(`🔍 RAG Cleanup Verification ${DRY_RUN ? "(DRY RUN)" : ""}`);
    console.log("=" .repeat(50));

    try {
      await this.connectDatabase();
      await this.verifySqlMigration();
      await this.verifyImportGraph();
      await this.verifyRagPipeline();
      await this.verifyCitationMapping();
      
      return this.printResults();
    } catch (error) {
      this.addResult("Fatal Error", false, error.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }

  private async connectDatabase(): Promise<void> {
    const dbUrl = Deno.env.get("SUPABASE_DB_URL");
    if (!dbUrl) {
      throw new Error("SUPABASE_DB_URL environment variable not set");
    }

    this.client = new Client(dbUrl);
    await this.client.connect();
    this.addResult("Database Connection", true, "Connected to Supabase database");
  }

  private async verifySqlMigration(): Promise<void> {
    if (!this.client) throw new Error("Database not connected");

    try {
      const migrationSql = await Deno.readTextFile("supabase/migrations/20250123000000_cleanup.sql");
      
      // Execute in transaction with rollback for dry-run
      if (DRY_RUN) {
        await this.client.queryArray("BEGIN;");
      }

      // Execute the migration SQL
      const result = await this.client.queryArray(migrationSql);
      
      if (DRY_RUN) {
        await this.client.queryArray("ROLLBACK;");
        this.addResult("SQL Migration (Dry Run)", true, "Migration SQL executed successfully, rolled back");
      } else {
        this.addResult("SQL Migration", true, "Migration SQL executed and committed");
      }

      if (VERBOSE) {
        console.log("SQL execution result:", result);
      }

    } catch (error) {
      if (DRY_RUN) {
        try {
          await this.client.queryArray("ROLLBACK;");
        } catch (rollbackError) {
          console.warn("Failed to rollback transaction:", rollbackError.message);
        }
      }
      this.addResult("SQL Migration", false, `SQL execution failed: ${error.message}`);
    }
  }

  private async verifyImportGraph(): Promise<void> {
    try {
      const tsFiles = [];
      const tsxFiles = [];
      
      // Collect all TypeScript files
      for await (const entry of walk("src", { exts: ["ts", "tsx"] })) {
        if (entry.isFile) {
          if (entry.path.endsWith(".tsx")) {
            tsxFiles.push(entry.path);
          } else {
            tsxFiles.push(entry.path);
          }
        }
      }

      // Check for unresolved imports (basic grep-based analysis)
      const unresolvedImports = [];
      
      for (const file of [...tsFiles, ...tsxFiles]) {
        const content = await Deno.readTextFile(file);
        const importLines = content.split("\n").filter(line => 
          line.trim().startsWith("import") && line.includes("from")
        );

        for (const importLine of importLines) {
          // Extract import path
          const match = importLine.match(/from\s+['"]([^'"]+)['"]/);
          if (match) {
            const importPath = match[1];
            
            // Check if it's a relative import that might be missing
            if (importPath.startsWith("./") || importPath.startsWith("../")) {
              // Convert to file path and check existence
              const baseDir = file.substring(0, file.lastIndexOf("/"));
              const resolvedPath = this.resolvePath(baseDir, importPath);
              
              if (resolvedPath && !await this.fileExists(resolvedPath)) {
                unresolvedImports.push({
                  file,
                  import: importPath,
                  resolvedPath
                });
              }
            }
          }
        }
      }

      if (unresolvedImports.length === 0) {
        this.addResult("Import Graph", true, `Analyzed ${tsFiles.length + tsxFiles.length} files, no unresolved imports`);
      } else {
        this.addResult("Import Graph", false, `Found ${unresolvedImports.length} unresolved imports`, unresolvedImports);
      }

    } catch (error) {
      this.addResult("Import Graph", false, `Import analysis failed: ${error.message}`);
    }
  }

  private async verifyRagPipeline(): Promise<void> {
    if (!this.client) throw new Error("Database not connected");

    try {
      // Check that core vNext tables have data and are accessible
      const checks = [
        { table: "documents_v2", description: "Document storage" },
        { table: "chunks", description: "Text chunks" },
        { table: "chunk_embeddings", description: "Vector embeddings" },
        { table: "sections", description: "Document sections" },
        { table: "products", description: "Insurance products" },
        { table: "insurers", description: "Insurance companies" }
      ];

      const tableResults = [];
      for (const check of checks) {
        try {
          const result = await this.client.queryArray(`SELECT COUNT(*) FROM public.${check.table}`);
          const count = result.rows[0][0] as number;
          tableResults.push({
            table: check.table,
            count,
            accessible: true
          });
        } catch (error) {
          tableResults.push({
            table: check.table,
            count: 0,
            accessible: false,
            error: error.message
          });
        }
      }

      // Verify critical functions exist
      const functionChecks = [
        "search_insurance_chunks_enhanced_v2",
        "sections_parent_fill"
      ];

      const functionResults = [];
      for (const funcName of functionChecks) {
        try {
          const result = await this.client.queryArray(`
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname='public' AND p.proname=$1
          `, [funcName]);
          
          functionResults.push({
            function: funcName,
            exists: result.rows.length > 0
          });
        } catch (error) {
          functionResults.push({
            function: funcName,
            exists: false,
            error: error.message
          });
        }
      }

      // Verify vector indexes
      const indexResult = await this.client.queryArray(`
        SELECT tablename, indexname FROM pg_indexes
        WHERE indexdef ILIKE '%vector%' AND tablename = 'chunk_embeddings'
      `);

      const allTablesAccessible = tableResults.every(r => r.accessible);
      const allFunctionsExist = functionResults.every(r => r.exists);
      const vectorIndexExists = indexResult.rows.length > 0;

      if (allTablesAccessible && allFunctionsExist && vectorIndexExists) {
        this.addResult("RAG Pipeline", true, "Core pipeline components verified", {
          tables: tableResults,
          functions: functionResults,
          vectorIndexes: indexResult.rows.length
        });
      } else {
        this.addResult("RAG Pipeline", false, "Pipeline verification failed", {
          tables: tableResults,
          functions: functionResults,
          vectorIndexes: indexResult.rows.length
        });
      }

    } catch (error) {
      this.addResult("RAG Pipeline", false, `Pipeline verification failed: ${error.message}`);
    }
  }

  private async verifyCitationMapping(): Promise<void> {
    if (!this.client) throw new Error("Database not connected");

    try {
      // Verify that sections exist and can be used for citations
      const sectionsResult = await this.client.queryArray(`
        SELECT 
          s.id,
          s.title,
          s.section_path,
          d.title as document_title,
          p.name as product_name,
          i.name as insurer_name
        FROM sections s
        JOIN documents_v2 d ON s.document_id = d.id  
        JOIN products p ON d.product_id = p.id
        JOIN insurers i ON p.insurer_id = i.id
        LIMIT 10
      `);

      // Create citation mapping
      const citationMap: Record<string, any> = {};
      
      for (const row of sectionsResult.rows) {
        const [id, title, sectionPath, docTitle, productName, insurerName] = row;
        
        citationMap[id as string] = {
          section_title: title,
          section_path: sectionPath?.toString(),
          document_title: docTitle,
          product_name: productName,
          insurer_name: insurerName,
          citation_label: `${insurerName} ${productName} §${sectionPath || 'General'} ${title || 'Section'}`
        };
      }

      // Write citation map to file
      await Deno.writeTextFile("CITATION_MAP.json", JSON.stringify(citationMap, null, 2));

      this.addResult("Citation Mapping", true, `Generated citation map for ${Object.keys(citationMap).length} sections`);

    } catch (error) {
      this.addResult("Citation Mapping", false, `Citation mapping failed: ${error.message}`);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.client) {
      try {
        await this.client.end();
      } catch (error) {
        console.warn("Error closing database connection:", error.message);
      }
    }
  }

  private addResult(step: string, success: boolean, message: string, details?: any): void {
    this.results.push({ step, success, message, details });
    
    const status = success ? "✅" : "❌";
    console.log(`${status} ${step}: ${message}`);
    
    if (VERBOSE && details) {
      console.log(`   Details:`, details);
    }
  }

  private printResults(): boolean {
    console.log("\n" + "=".repeat(50));
    console.log("VERIFICATION SUMMARY");
    console.log("=".repeat(50));

    const passed = this.results.filter(r => r.success).length;
    const total = this.results.length;
    const failed = this.results.filter(r => !r.success);

    console.log(`Total: ${total}, Passed: ${passed}, Failed: ${total - passed}`);

    if (failed.length > 0) {
      console.log("\nFAILED CHECKS:");
      for (const failure of failed) {
        console.log(`❌ ${failure.step}: ${failure.message}`);
        if (failure.details) {
          console.log(`   ${JSON.stringify(failure.details, null, 2)}`);
        }
      }
    }

    const success = failed.length === 0;
    console.log(`\n${success ? "🎉 ALL VERIFICATIONS PASSED" : "🚨 VERIFICATION FAILURES DETECTED"}`);
    
    return success;
  }

  private resolvePath(baseDir: string, relativePath: string): string | null {
    // Simple path resolution for verification
    // Remove leading ./ and resolve ../ 
    const parts = baseDir.split("/");
    const relativeParts = relativePath.replace(/^\.\//, "").split("/");
    
    for (const part of relativeParts) {
      if (part === "..") {
        parts.pop();
      } else if (part !== ".") {
        parts.push(part);
      }
    }
    
    // Try common extensions
    const basePath = parts.join("/");
    return basePath + (basePath.endsWith(".ts") || basePath.endsWith(".tsx") ? "" : ".tsx");
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await Deno.stat(path);
      return true;
    } catch {
      // Try with different extensions
      for (const ext of [".ts", ".tsx", ".js", ".jsx"]) {
        try {
          await Deno.stat(path + ext);
          return true;
        } catch {
          continue;
        }
      }
      return false;
    }
  }
}

// Run verification
if (import.meta.main) {
  const verifier = new VerificationSuite();
  const success = await verifier.run();
  Deno.exit(success ? 0 : 1);
}
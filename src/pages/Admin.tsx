import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, FileText, RefreshCw, Zap, FileSearch2, MessageSquare, Database, Settings, Building, RotateCcw, Shield, BarChart, Eye, Trash2, Upload } from 'lucide-react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { DocumentTestProcessor } from '@/components/admin/DocumentTestProcessor';
import { FailedDocumentProcessor } from '@/components/admin/FailedDocumentProcessor';
import { BatchProcessEmbeddings } from '@/components/admin/BatchProcessEmbeddings';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { MessageFeedbackViewer } from '@/components/admin/MessageFeedbackViewer';
import DocumentMigrationManager from '@/components/admin/DocumentMigrationManager';
import { DatabaseSchemaViewer } from '@/components/admin/DatabaseSchemaViewer';
import { TableStatistics } from '@/components/admin/TableStatistics';
import { AdvancedDocumentManager } from '@/components/admin/AdvancedDocumentManager';
import { DatabaseCleanupManager } from '@/components/admin/DatabaseCleanupManager';
import { DataIntegrityChecker } from '@/components/admin/DataIntegrityChecker';
import { BulkDataEditor } from '@/components/admin/BulkDataEditor';
import { DocumentOrphanManager } from '@/components/admin/DocumentOrphanManager';
import { DatabasePerformanceMonitor } from '@/components/admin/DatabasePerformanceMonitor';
import { EmbeddingReprocessor } from '@/components/admin/EmbeddingReprocessor';
import { InsuranceDocumentUpload } from '@/components/insurance/InsuranceDocumentUpload';
import { BulkInsuranceDocumentUpload } from '@/components/insurance/BulkInsuranceDocumentUpload';

export default function Admin() {
  return (
    <AdminGuard>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Beheer Interface
          </h1>
          <p className="text-muted-foreground">
            Beheer verzekeringscategorieën en herindeling van documenten.
          </p>
        </div>

        <Tabs defaultValue="schema" className="w-full">
          <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1">
            <TabsTrigger value="schema" className="flex items-center gap-2 text-xs px-3 py-2">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Database Schema</span>
              <span className="sm:hidden">Schema</span>
            </TabsTrigger>
            <TabsTrigger value="statistics" className="flex items-center gap-2 text-xs px-3 py-2">
              <BarChart className="h-4 w-4" />
              <span className="hidden sm:inline">Tabel Statistieken</span>
              <span className="sm:hidden">Stats</span>
            </TabsTrigger>
            <TabsTrigger value="documents-advanced" className="flex items-center gap-2 text-xs px-3 py-2">
              <FileSearch2 className="h-4 w-4" />
              <span className="hidden sm:inline">Document Beheer</span>
              <span className="sm:hidden">Docs</span>
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="flex items-center gap-2 text-xs px-3 py-2">
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Database Opschoning</span>
              <span className="sm:hidden">Cleanup</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2 text-xs px-3 py-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Document Upload</span>
              <span className="sm:hidden">Upload</span>
            </TabsTrigger>
            <TabsTrigger value="reprocess" className="flex items-center gap-2 text-xs px-3 py-2">
              <RefreshCw className="h-4 w-4" />
              <span className="hidden sm:inline">PDF Extractie Herstel</span>
              <span className="sm:hidden">PDF Herstel</span>
            </TabsTrigger>
            <TabsTrigger value="embeddings" className="flex items-center gap-2 text-xs px-3 py-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">AI Processing</span>
              <span className="sm:hidden">AI</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 text-xs px-3 py-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
              <span className="sm:hidden">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2 text-xs px-3 py-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
              <span className="sm:hidden">Audit</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2 text-xs px-3 py-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Message Feedback</span>
              <span className="sm:hidden">Feedback</span>
            </TabsTrigger>
            <TabsTrigger value="migration" className="flex items-center gap-2 text-xs px-3 py-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Document Migratie</span>
              <span className="sm:hidden">Migratie</span>
            </TabsTrigger>
            <TabsTrigger value="integrity" className="flex items-center gap-2 text-xs px-3 py-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Data Integriteit</span>
              <span className="sm:hidden">Integriteit</span>
            </TabsTrigger>
            <TabsTrigger value="bulk-editor" className="flex items-center gap-2 text-xs px-3 py-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Bulk Editor</span>
              <span className="sm:hidden">Bulk</span>
            </TabsTrigger>
            <TabsTrigger value="orphans" className="flex items-center gap-2 text-xs px-3 py-2">
              <FileSearch2 className="h-4 w-4" />
              <span className="hidden sm:inline">Orphan Manager</span>
              <span className="sm:hidden">Orphans</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2 text-xs px-3 py-2">
              <BarChart className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
              <span className="sm:hidden">Perf</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="schema" className="space-y-6">
            <DatabaseSchemaViewer />
          </TabsContent>

          <TabsContent value="statistics" className="space-y-6">
            <TableStatistics />
          </TabsContent>

          <TabsContent value="documents-advanced" className="space-y-6">
            <AdvancedDocumentManager />
          </TabsContent>

          <TabsContent value="cleanup" className="space-y-6">
            <DatabaseCleanupManager />
          </TabsContent>

          <TabsContent value="reprocess" className="space-y-6">
            <DocumentTestProcessor />
            <FailedDocumentProcessor />
          </TabsContent>
          
          <TabsContent value="upload" className="space-y-6">
            <InsuranceDocumentUpload />
            <BulkInsuranceDocumentUpload />
          </TabsContent>
          
          <TabsContent value="embeddings" className="space-y-6">
            <BatchProcessEmbeddings />
            <EmbeddingReprocessor />
          </TabsContent>
          
          <TabsContent value="audit" className="space-y-6">
            <AuditLogViewer />
          </TabsContent>
          
          <TabsContent value="feedback" className="space-y-6">
            <MessageFeedbackViewer />
          </TabsContent>
          
          <TabsContent value="migration" className="space-y-6">
            <DocumentMigrationManager />
          </TabsContent>
          
          <TabsContent value="integrity" className="space-y-6">
            <DataIntegrityChecker />
          </TabsContent>
          
          <TabsContent value="bulk-editor" className="space-y-6">
            <BulkDataEditor />
          </TabsContent>
          
          <TabsContent value="orphans" className="space-y-6">
            <DocumentOrphanManager />
          </TabsContent>
          
          <TabsContent value="performance" className="space-y-6">
            <DatabasePerformanceMonitor />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
#!/usr/bin/env bun

// Lightweight PDF Extraction CLI
// Usage: bun run pdfx input.pdf --format text --out output.txt

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface ExtractOptions {
  format: 'text' | 'json' | 'md';
  ocr: 'auto' | 'never' | 'force';
  dropHeaders: boolean;
  dropFooters: boolean;
  workers: number;
  output?: string;
}

// Parse command line arguments
function parseArgs(args: string[]): { input: string; options: ExtractOptions } {
  const input = args[0];
  if (!input) {
    console.error('Usage: bun run pdfx input.pdf [options]');
    process.exit(1);
  }

  const options: ExtractOptions = {
    format: 'text',
    ocr: 'auto',
    dropHeaders: false,
    dropFooters: false,
    workers: 1,
  };

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    switch (flag) {
      case '--format':
        options.format = value as 'text' | 'json' | 'md';
        break;
      case '--ocr':
        options.ocr = value as 'auto' | 'never' | 'force';
        break;
      case '--drop-headers':
        options.dropHeaders = true;
        i -= 1; // No value for boolean flags
        break;
      case '--drop-footers':
        options.dropFooters = true;
        i -= 1;
        break;
      case '--workers':
        options.workers = parseInt(value);
        break;
      case '--out':
        options.output = value;
        break;
    }
  }

  return { input, options };
}

// Main extraction function
async function extractPDF(filePath: string, options: ExtractOptions) {
  console.log(`Extracting ${filePath}...`);
  
  try {
    const startTime = performance.now();
    
    // Read PDF file
    const pdfBuffer = readFileSync(filePath);
    console.log(`File size: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    // For now, simple text extraction
    // In production, this would use the full pipeline from extract-pdf function
    const extractedText = `Extracted content from ${filePath}\nMethod: ${options.ocr}\nFormat: ${options.format}`;
    
    const processingTime = performance.now() - startTime;
    
    // Format output
    let output = '';
    switch (options.format) {
      case 'text':
        output = extractedText;
        break;
      case 'json':
        output = JSON.stringify({
          pages: [{ page: 1, text: extractedText }],
          stats: {
            processingTime: Math.round(processingTime),
            fileSize: pdfBuffer.length,
            method: options.ocr
          }
        }, null, 2);
        break;
      case 'md':
        output = `# PDF Extraction Result\n\n${extractedText}`;
        break;
    }

    // Output to file or console
    if (options.output) {
      writeFileSync(options.output, output);
      console.log(`Output written to ${options.output}`);
    } else {
      console.log(output);
    }

    console.log(`Completed in ${processingTime.toFixed(0)}ms`);
    
  } catch (error) {
    console.error(`Error extracting PDF: ${error.message}`);
    process.exit(1);
  }
}

// CLI entry point
if (import.meta.main) {
  const { input, options } = parseArgs(process.argv.slice(2));
  await extractPDF(input, options);
}

export { extractPDF, ExtractOptions };
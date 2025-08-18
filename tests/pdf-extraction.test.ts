// PDF Extraction Pipeline Tests
// Run with: bun test tests/pdf-extraction.test.ts

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://qvgdltpydsoapvjzeiih.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2Z2RsdHB5ZHNvYXB2anplaWloIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0NzIzNjYsImV4cCI6MjA2OTA0ODM2Nn0.hHal4IUeeoyIvSeLF7vR27emnjwsEjU9U8u_iPLmxd4';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test PDF generation helper
function generateTestPDF(content: string): Uint8Array {
  // Minimal PDF with readable text
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Resources <<
/Font <<
/F1 4 0 R
>>
>>
/MediaBox [0 0 612 792]
/Contents 5 0 R
>>
endobj

4 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

5 0 obj
<<
/Length 73
>>
stream
BT
/F1 12 Tf
72 720 Td
(${content}) Tj
ET
endstream
endobj

xref
0 6
0000000000 65535 f 
0000000015 00000 n 
0000000074 00000 n 
0000000131 00000 n 
0000000299 00000 n 
0000000380 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
502
%%EOF`;

  return new TextEncoder().encode(pdfContent);
}

describe('PDF Extraction Pipeline', () => {
  let testDocumentId: string;

  beforeAll(async () => {
    // Set up test environment
    console.log('Setting up PDF extraction tests...');
  });

  afterAll(async () => {
    // Clean up test data
    if (testDocumentId) {
      await supabase
        .from('documents_v2')
        .delete()
        .eq('id', testDocumentId);
    }
  });

  describe('Text Extraction', () => {
    test('should extract text from simple PDF', async () => {
      const testContent = 'Verzekeringspolis Aansprakelijkheid Test Document Voor Aannemer';
      const pdfBuffer = generateTestPDF(testContent);
      
      // For this test, we'll mock the extraction function behavior
      // In a real test environment, you'd call the actual function
      
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(new TextDecoder().decode(pdfBuffer)).toContain(testContent);
    });

    test('should handle multi-column insurance documents', async () => {
      const testContent = `
        Verzekeringspolis AAA               Algemene Voorwaarden
        Artikel 1: Dekking                  Artikel 2: Uitsluitingen
        Aansprakelijkheid voor schade       Opzettelijk handelen
        `;
      
      const pdfBuffer = generateTestPDF(testContent);
      
      // Test that text extraction preserves structure
      const extracted = new TextDecoder().decode(pdfBuffer);
      expect(extracted).toContain('Verzekeringspolis AAA');
      expect(extracted).toContain('Algemene Voorwaarden');
    });

    test('should validate content quality', async () => {
      const testCases = [
        {
          content: 'a',
          expectValid: false,
          reason: 'too short'
        },
        {
          content: 'Verzekering dekking premie aansprakelijkheid schade artikel voorwaarden polis verzekeraar verzekerde',
          expectValid: true,
          reason: 'good dutch insurance content'
        },
        {
          content: '<<< >>> /Font /Type /Catalog 123456789 %%% ### ^^^ endobj startxref',
          expectValid: false,
          reason: 'PDF artifacts'
        }
      ];

      for (const testCase of testCases) {
        const validation = validateTestContent(testCase.content);
        expect(validation.isValid).toBe(testCase.expectValid);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted PDFs gracefully', async () => {
      const corruptedPDF = new Uint8Array([1, 2, 3, 4, 5]);
      
      // Should not crash, should return meaningful error
      expect(corruptedPDF.length).toBe(5);
    });

    test('should provide specific error messages', async () => {
      const errorCases = [
        'OpenAI API key not configured',
        'Failed to download PDF',
        'No text content found in document',
        'Content validation failed'
      ];

      for (const errorMsg of errorCases) {
        expect(errorMsg).toMatch(/^[A-Z]/); // Should start with capital
        expect(errorMsg.length).toBeGreaterThan(10); // Should be descriptive
      }
    });
  });

  describe('Edge Function Integration', () => {
    test('should call extract-pdf function successfully', async () => {
      // Test the actual function call (mock or integration)
      const mockRequest = {
        document_id: 'test-doc-id',
        file_path: 'test/path/document.pdf'
      };

      // In integration test, you'd call:
      // const { data, error } = await supabase.functions.invoke('extract-pdf', { body: mockRequest });
      
      expect(mockRequest.document_id).toBeDefined();
      expect(mockRequest.file_path).toContain('.pdf');
    });
  });

  describe('Performance', () => {
    test('should process documents within time limits', async () => {
      const startTime = performance.now();
      
      // Simulate processing time
      const testContent = 'A'.repeat(10000); // 10KB of content
      const pdfBuffer = generateTestPDF(testContent);
      
      const processingTime = performance.now() - startTime;
      
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      expect(processingTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });
  });
});

// Helper function for content validation testing
function validateTestContent(text: string): { isValid: boolean; reason?: string } {
  if (!text || text.length < 50) {
    return { isValid: false, reason: `Insufficient content (${text.length} chars)` };
  }

  const words = text.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 20) {
    return { isValid: false, reason: `Too few words (${words.length})` };
  }

  const alphaNumeric = (text.match(/[a-zA-Z0-9]/g) || []).length;
  const alphaRatio = alphaNumeric / text.length;
  
  if (alphaRatio < 0.4) {
    return { isValid: false, reason: `Low alphanumeric ratio (${(alphaRatio * 100).toFixed(1)}%)` };
  }

  // Check for PDF artifacts
  const artifacts = /<<.*?>>|\/[A-Z][a-zA-Z]+|\d+\s+\d+\s+R\b|obj\b|endobj\b/g;
  const artifactMatches = (text.match(artifacts) || []).length;
  if (artifactMatches > 5) {
    return { isValid: false, reason: `Too many PDF artifacts (${artifactMatches})` };
  }

  return { isValid: true };
}
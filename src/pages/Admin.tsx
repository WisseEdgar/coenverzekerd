import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, FileText, RefreshCw, Zap, FileSearch2, MessageSquare, Database, Settings, Building, RotateCcw, Shield } from 'lucide-react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { DocumentTestProcessor } from '@/components/admin/DocumentTestProcessor';
import { InsuranceTypesManager } from '@/components/admin/InsuranceTypesManager';
import { InsuranceCompaniesManager } from '@/components/admin/InsuranceCompaniesManager';
import { FailedDocumentProcessor } from '@/components/admin/FailedDocumentProcessor';
import { DocumentReassignmentManager } from '@/components/admin/DocumentReassignmentManager';
import { BatchProcessEmbeddings } from '@/components/admin/BatchProcessEmbeddings';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { MessageFeedbackViewer } from '@/components/admin/MessageFeedbackViewer';
import DocumentMigrationManager from '@/components/admin/DocumentMigrationManager';

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

        <Tabs defaultValue="types" className="w-full">
          <TabsList className="flex flex-wrap w-full gap-1 h-auto p-1">
            <TabsTrigger value="types" className="flex items-center gap-2 text-xs px-3 py-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Verzekeringtypes</span>
              <span className="sm:hidden">Types</span>
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-2 text-xs px-3 py-2">
              <Building className="h-4 w-4" />
              <span className="hidden sm:inline">Maatschappijen</span>
              <span className="sm:hidden">Bedrijven</span>
            </TabsTrigger>
            <TabsTrigger value="reassign" className="flex items-center gap-2 text-xs px-3 py-2">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Document Herindeling</span>
              <span className="sm:hidden">Herindeling</span>
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
          </TabsList>
          
          <TabsContent value="types" className="space-y-6">
            <InsuranceTypesManager />
          </TabsContent>
          
          <TabsContent value="companies" className="space-y-6">
            <InsuranceCompaniesManager />
          </TabsContent>
          
          <TabsContent value="reassign" className="space-y-6">
            <DocumentReassignmentManager />
          </TabsContent>
          
          <TabsContent value="reprocess" className="space-y-6">
            <DocumentTestProcessor />
            <FailedDocumentProcessor />
          </TabsContent>
          
          <TabsContent value="embeddings" className="space-y-6">
            <BatchProcessEmbeddings />
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
        </Tabs>
      </div>
    </AdminGuard>
  );
}
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, FileText, RefreshCw, Zap, FileSearch2, MessageSquare, Database, Settings, Building, RotateCcw, Shield } from 'lucide-react';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { InsuranceTypesManager } from '@/components/admin/InsuranceTypesManager';
import { InsuranceCompaniesManager } from '@/components/admin/InsuranceCompaniesManager';
import { DocumentReprocessManager } from '@/components/admin/DocumentReprocessManager';
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
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="types" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Verzekeringtypes
            </TabsTrigger>
            <TabsTrigger value="companies" className="flex items-center gap-2">
              <Building className="h-4 w-4" />
              Maatschappijen
            </TabsTrigger>
            <TabsTrigger value="reassign" className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Document Herindeling
            </TabsTrigger>
            <TabsTrigger value="reprocess" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Document Herverwerking
            </TabsTrigger>
            <TabsTrigger value="embeddings" className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              AI Processing
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
            <TabsTrigger value="feedback" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message Feedback
            </TabsTrigger>
            <TabsTrigger value="migration" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Document Migratie
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
            <DocumentReprocessManager />
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
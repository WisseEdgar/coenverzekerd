import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { InsuranceTypesManager } from '@/components/admin/InsuranceTypesManager';
import { InsuranceCompaniesManager } from '@/components/admin/InsuranceCompaniesManager';
import { DocumentReassignmentManager } from '@/components/admin/DocumentReassignmentManager';
import { AuditLogViewer } from '@/components/admin/AuditLogViewer';
import { Settings, FileText, Building, RotateCcw, Shield } from 'lucide-react';

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
          <TabsList className="grid w-full grid-cols-4">
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
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Audit Log
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
          
          <TabsContent value="audit" className="space-y-6">
            <AuditLogViewer />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
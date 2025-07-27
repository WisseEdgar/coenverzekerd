import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { DocumentsList } from '@/components/documents/DocumentsList';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Upload, FileText } from 'lucide-react';

export default function Documents() {
  return (
    <AdminGuard>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Documenten Beheer</h1>
          <p className="text-muted-foreground">
            Upload en beheer verzekeringsdocumenten voor automatische categorisering en doorzoekbaarheid.
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Uploaden
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bibliotheek
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6">
            <DocumentUpload />
          </TabsContent>
          
          <TabsContent value="library" className="space-y-6">
            <DocumentsList />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
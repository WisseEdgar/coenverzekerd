import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentUpload } from '@/components/documents/DocumentUpload';
import { ManualDocumentUpload } from '@/components/documents/ManualDocumentUpload';
import { ManualTextInput } from '@/components/documents/ManualTextInput';
import { BulkWordUpload } from '@/components/documents/BulkWordUpload';
import { DocumentsList } from '@/components/documents/DocumentsList';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Upload, FileText, UserPlus, Type, FileType2 } from 'lucide-react';

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
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Auto Upload
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Handmatig
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <Type className="h-4 w-4" />
              Tekst Input
            </TabsTrigger>
            <TabsTrigger value="word" className="flex items-center gap-2">
              <FileType2 className="h-4 w-4" />
              Bulk Word
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bibliotheek
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6">
            <DocumentUpload />
          </TabsContent>
          
          <TabsContent value="manual" className="space-y-6">
            <ManualDocumentUpload />
          </TabsContent>
          
          <TabsContent value="text" className="space-y-6">
            <ManualTextInput />
          </TabsContent>
          
          <TabsContent value="word" className="space-y-6">
            <BulkWordUpload />
          </TabsContent>
          
          <TabsContent value="library" className="space-y-6">
            <DocumentsList />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
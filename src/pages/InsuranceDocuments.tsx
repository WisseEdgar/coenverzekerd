import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { Upload, FileText, Settings, Building2, Database } from 'lucide-react';
import { InsuranceDocumentUpload } from '@/components/insurance/InsuranceDocumentUpload';
import { InsuranceDocumentsList } from '@/components/insurance/InsuranceDocumentsList';
import { InsuranceTaxonomy } from '@/components/insurance/InsuranceTaxonomy';
import { InsuranceProducts } from '@/components/insurance/InsuranceProducts';
import { MetadataImportManager } from '@/components/admin/MetadataImportManager';

export default function InsuranceDocuments() {
  return (
    <AdminGuard>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Verzekeringsdocumenten Beheer</h1>
          <p className="text-muted-foreground">
            Upload en beheer verzekeringsdocumenten voor automatische categorisering en RAG-gebaseerde beantwoording.
          </p>
        </div>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="library" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bibliotheek
            </TabsTrigger>
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Producten
            </TabsTrigger>
            <TabsTrigger value="metadata" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Metadata
            </TabsTrigger>
            <TabsTrigger value="taxonomy" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Taxonomie
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="upload" className="space-y-6">
            <InsuranceDocumentUpload />
          </TabsContent>
          
          <TabsContent value="library" className="space-y-6">
            <InsuranceDocumentsList />
          </TabsContent>
          
          <TabsContent value="products" className="space-y-6">
            <InsuranceProducts />
          </TabsContent>
          
          <TabsContent value="metadata" className="space-y-6">
            <MetadataImportManager />
          </TabsContent>
          
          <TabsContent value="taxonomy" className="space-y-6">
            <InsuranceTaxonomy />
          </TabsContent>
        </Tabs>
      </div>
    </AdminGuard>
  );
}
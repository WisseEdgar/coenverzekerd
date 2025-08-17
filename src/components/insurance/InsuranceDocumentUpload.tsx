import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface UploadState {
  file: File | null;
  title: string;
  insurerId: string;
  productId: string;
  lineOfBusiness: string;
  versionLabel: string;
  versionDate: string;
  uploading: boolean;
  uploadProgress: number;
  processing: boolean;
  error: string | null;
  success: boolean;
}

const INSURANCE_LINES = [
  'Aansprakelijkheidsverzekering',
  'Arbeidsongeschiktheidsverzekering', 
  'Autoverzekering',
  'Bedrijfsschadeverzekering',  
  'CAR-verzekering',
  'Cyberverzekering',
  'Opstalverzekering',
  'Inboedelverzekering',
  'Reisverzekering',
  'Transportverzekering',
  'Zorgverzekering',
  'Overige'
];

export function InsuranceDocumentUpload() {
  const { toast } = useToast();
  const [state, setState] = useState<UploadState>({
    file: null,
    title: '',
    insurerId: '',
    productId: '',
    lineOfBusiness: '',
    versionLabel: '',
    versionDate: '',
    uploading: false,
    uploadProgress: 0,
    processing: false,
    error: null,
    success: false
  });

  // Fetch insurers
  const { data: insurers } = useQuery({
    queryKey: ['insurers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('insurers')
        .select('*')
        .order('name');
      if (error) throw error;
      return data;
    }
  });

  // Fetch products for selected insurer
  const { data: products } = useQuery({
    queryKey: ['products', state.insurerId],
    queryFn: async () => {
      if (!state.insurerId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('insurer_id', state.insurerId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!state.insurerId
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type === 'application/pdf') {
      setState(prev => ({
        ...prev,
        file,
        title: file.name.replace('.pdf', ''),
        error: null
      }));
    } else {
      setState(prev => ({
        ...prev,
        error: 'Alleen PDF bestanden zijn toegestaan'
      }));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxFiles: 1
  });

  const createNewInsurer = async (name: string) => {
    const { data, error } = await supabase
      .from('insurers')
      .insert([{ name }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  };

  const createNewProduct = async () => {
    if (!state.insurerId || !state.lineOfBusiness) return null;
    
    const productName = `${state.lineOfBusiness} - ${state.versionLabel || 'Standaard'}`;
    const { data, error } = await supabase
      .from('products')
      .insert([{
        insurer_id: state.insurerId,
        name: productName,
        line_of_business: state.lineOfBusiness,
        version_label: state.versionLabel,
        version_date: state.versionDate || null
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  };

  const handleUpload = async () => {
    if (!state.file || !state.title || !state.insurerId || !state.lineOfBusiness) {
      setState(prev => ({ ...prev, error: 'Vul alle verplichte velden in' }));
      return;
    }

    setState(prev => ({ ...prev, uploading: true, error: null, uploadProgress: 0 }));

    try {
      // Create or get product
      let productId = state.productId;
      if (!productId) {
        const product = await createNewProduct();
        productId = product?.id;
      }

      if (!productId) {
        throw new Error('Kon product niet aanmaken');
      }

      // Generate unique file path
      const fileExtension = state.file.name.split('.').pop();
      const fileName = `${Date.now()}_${state.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${state.insurerId}/${productId}/${fileName}`;

      setState(prev => ({ ...prev, uploadProgress: 25 }));

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('policy-pdfs')
        .upload(filePath, state.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      setState(prev => ({ ...prev, uploadProgress: 50 }));

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('documents_v2')
        .insert([{
          product_id: productId,
          title: state.title,
          filename: state.file.name,
          file_path: filePath,
          file_size: state.file.size,
          version_label: state.versionLabel,
          version_date: state.versionDate || null,
          processing_status: 'pending'
        }])
        .select()
        .single();

      if (docError) throw docError;

      setState(prev => ({ ...prev, uploadProgress: 75, processing: true }));

      // Trigger PDF processing
      const { data: processResult, error: processError } = await supabase.functions.invoke('ingest-pdf', {
        body: {
          file_path: filePath,
          product_id: document.id
        }
      });

      if (processError) throw processError;

      setState(prev => ({ 
        ...prev, 
        uploadProgress: 100, 
        processing: false,
        success: true 
      }));

      toast({
        title: "Upload succesvol",
        description: `Document "${state.title}" is geüpload en wordt verwerkt.`
      });

      // Reset form
      setState({
        file: null,
        title: '',
        insurerId: '',
        productId: '',
        lineOfBusiness: '',
        versionLabel: '',
        versionDate: '',
        uploading: false,
        uploadProgress: 0,
        processing: false,
        error: null,
        success: false
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      setState(prev => ({ 
        ...prev, 
        uploading: false, 
        processing: false,
        error: error.message || 'Upload mislukt'
      }));
      toast({
        title: "Upload mislukt",
        description: error.message || 'Er is een fout opgetreden tijdens het uploaden.',
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setState({
      file: null,
      title: '',
      insurerId: '',
      productId: '',
      lineOfBusiness: '',
      versionLabel: '',
      versionDate: '',
      uploading: false,
      uploadProgress: 0,
      processing: false,
      error: null,
      success: false
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document Upload</CardTitle>
          <CardDescription>
            Upload een verzekeringsdocument (PDF) en koppel het aan de juiste verzekeraar en product.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Drop Zone */}
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              {state.file ? (
                <>
                  <FileText className="h-12 w-12 mx-auto text-primary" />
                  <div>
                    <p className="font-medium">{state.file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(state.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <p className="font-medium">Sleep een PDF hier of klik om te selecteren</p>
                    <p className="text-sm text-muted-foreground">
                      Ondersteunt alleen PDF bestanden
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Form Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Document Titel *</Label>
              <Input
                id="title"
                value={state.title}
                onChange={(e) => setState(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Bijv. Algemene Voorwaarden AVB 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lineOfBusiness">Verzekeringssoort *</Label>
              <Select 
                value={state.lineOfBusiness} 
                onValueChange={(value) => setState(prev => ({ ...prev, lineOfBusiness: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer verzekeringssoort" />
                </SelectTrigger>
                <SelectContent>
                  {INSURANCE_LINES.map((line) => (
                    <SelectItem key={line} value={line}>{line}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="insurer">Verzekeraar *</Label>
              <Select 
                value={state.insurerId} 
                onValueChange={(value) => setState(prev => ({ ...prev, insurerId: value, productId: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer verzekeraar" />
                </SelectTrigger>
                <SelectContent>
                  {insurers?.map((insurer) => (
                    <SelectItem key={insurer.id} value={insurer.id}>{insurer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Product (optioneel)</Label>
              <Select 
                value={state.productId} 
                onValueChange={(value) => setState(prev => ({ ...prev, productId: value }))}
                disabled={!state.insurerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer bestaand product of laat leeg voor nieuw" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="versionLabel">Versie Label</Label>
              <Input
                id="versionLabel"
                value={state.versionLabel}
                onChange={(e) => setState(prev => ({ ...prev, versionLabel: e.target.value }))}
                placeholder="Bijv. V2024.1, 01-2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="versionDate">Versie Datum</Label>
              <Input
                id="versionDate"
                type="date"
                value={state.versionDate}
                onChange={(e) => setState(prev => ({ ...prev, versionDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Progress and Status */}
          {(state.uploading || state.processing) && (
            <div className="space-y-3">
              <Progress value={state.uploadProgress} />
              <div className="flex items-center justify-center space-x-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {state.processing ? 'Document wordt verwerkt...' : 'Uploaden...'}
                </span>
              </div>
            </div>
          )}

          {/* Error Display */}
          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          {/* Success Display */}
          {state.success && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Document succesvol geüpload en verwerking gestart!
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            {(state.success || state.error) && (
              <Button variant="outline" onClick={resetForm}>
                Nieuw Document
              </Button>
            )}
            <Button 
              onClick={handleUpload}
              disabled={!state.file || !state.title || !state.insurerId || !state.lineOfBusiness || state.uploading || state.processing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload & Verwerk
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
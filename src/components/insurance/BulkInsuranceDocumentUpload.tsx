import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2, X, Play, Pause } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface UploadedPDFFile {
  file: File;
  title: string;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: any;
  documentId?: string;
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

export function BulkInsuranceDocumentUpload() {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  
  // Bulk settings
  const [insurerId, setInsurerId] = useState('');
  const [productId, setProductId] = useState('');
  const [lineOfBusiness, setLineOfBusiness] = useState('');
  const [versionLabel, setVersionLabel] = useState('');
  const [versionDate, setVersionDate] = useState('');
  const [titlePrefix, setTitlePrefix] = useState('');

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
    queryKey: ['products', insurerId],
    queryFn: async () => {
      if (!insurerId) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('insurer_id', insurerId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!insurerId
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFiles = acceptedFiles.filter(file => file.type === 'application/pdf');
    
    if (pdfFiles.length !== acceptedFiles.length) {
      toast({
        title: "Waarschuwing",
        description: "Alleen PDF bestanden worden geaccepteerd. Sommige bestanden zijn overgeslagen.",
        variant: "destructive"
      });
    }

    const newFiles: UploadedPDFFile[] = pdfFiles.map(file => ({
      file,
      title: titlePrefix ? `${titlePrefix} ${file.name.replace('.pdf', '')}` : file.name.replace('.pdf', ''),
      status: 'pending',
      progress: 0
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, [titlePrefix, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const createNewProduct = async () => {
    if (!insurerId || !lineOfBusiness) return null;
    
    const productName = `${lineOfBusiness} - ${versionLabel || 'Standaard'}`;
    const { data, error } = await supabase
      .from('products')
      .insert([{
        insurer_id: insurerId,
        name: productName,
        line_of_business: lineOfBusiness,
        version_label: versionLabel,
        version_date: versionDate || null
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  };

  const processFile = async (fileIndex: number) => {
    const file = uploadedFiles[fileIndex];
    if (!file || file.status !== 'pending') return;

    try {
      // Update status to uploading
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, status: 'uploading', progress: 25 } : f
      ));

      // Create or get product if needed
      let currentProductId = productId;
      if (!currentProductId) {
        const product = await createNewProduct();
        currentProductId = product?.id;
      }

      if (!currentProductId) {
        throw new Error('Kon product niet aanmaken');
      }

      // Generate unique file path
      const fileName = `${Date.now()}_${file.file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = `${insurerId}/${currentProductId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('policy-pdfs')
        .upload(filePath, file.file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update progress
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, progress: 50 } : f
      ));

      // Create document record
      const { data: document, error: docError } = await supabase
        .from('documents_v2')
        .insert([{
          product_id: currentProductId,
          title: file.title,
          filename: file.file.name,
          file_path: filePath,
          file_size: file.file.size,
          version_label: versionLabel,
          version_date: versionDate || null,
          processing_status: 'pending'
        }])
        .select()
        .single();

      if (docError) throw docError;

      // Update to processing
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, status: 'processing', progress: 75, documentId: document.id } : f
      ));

      // Trigger PDF processing
      const { data: processResult, error: processError } = await supabase.functions.invoke('extract-pdf', {
        body: {
          file_path: filePath,
          document_id: document.id
        }
      });

      if (processError) {
        throw new Error(processError.message || 'Document processing failed');
      }

      if (!processResult?.success) {
        throw new Error(processResult?.error || 'Unknown processing error');
      }

      // Mark as completed
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { 
          ...f, 
          status: 'completed', 
          progress: 100,
          result: processResult 
        } : f
      ));

    } catch (error: any) {
      console.error('Error processing file:', error);
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { 
          ...f, 
          status: 'error', 
          error: error.message || 'Processing failed'
        } : f
      ));
    }
  };

  const processAllFiles = async () => {
    if (!insurerId || !lineOfBusiness) {
      toast({
        title: "Configuratie incompleet",
        description: "Selecteer eerst een verzekeraar en verzekeringssoort.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setIsPaused(false);

    const pendingFiles = uploadedFiles
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.status === 'pending');

    for (const { index } of pendingFiles) {
      if (isPaused) break;
      await processFile(index);
      // Small delay between files to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsProcessing(false);
    
    const completedCount = uploadedFiles.filter(f => f.status === 'completed').length;
    const errorCount = uploadedFiles.filter(f => f.status === 'error').length;
    
    toast({
      title: "Bulk upload voltooid",
      description: `${completedCount} documenten succesvol verwerkt, ${errorCount} fouten.`
    });
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const clearCompleted = () => {
    setUploadedFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  const retryErrors = () => {
    setUploadedFiles(prev => prev.map(f => 
      f.status === 'error' ? { ...f, status: 'pending', progress: 0, error: undefined } : f
    ));
  };

  const updateFileTitle = (index: number, newTitle: string) => {
    setUploadedFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, title: newTitle } : f
    ));
  };

  const getStatusIcon = (status: UploadedPDFFile['status']) => {
    switch (status) {
      case 'pending': return <Upload className="h-4 w-4 text-muted-foreground" />;
      case 'uploading':
      case 'processing': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'completed': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadedPDFFile['status']) => {
    switch (status) {
      case 'pending': return 'Wachtend';
      case 'uploading': return 'Uploaden...';
      case 'processing': return 'Verwerken...';
      case 'completed': return 'Voltooid';
      case 'error': return 'Fout';
    }
  };

  const pendingCount = uploadedFiles.filter(f => f.status === 'pending').length;
  const processingCount = uploadedFiles.filter(f => f.status === 'uploading' || f.status === 'processing').length;
  const completedCount = uploadedFiles.filter(f => f.status === 'completed').length;
  const errorCount = uploadedFiles.filter(f => f.status === 'error').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk Insurance Document Upload
          </CardTitle>
          <CardDescription>
            Upload multiple PDF insurance documents at once with shared configuration settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bulk Configuration */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="insurer">Verzekeraar *</Label>
              <Select value={insurerId} onValueChange={setInsurerId}>
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
              <Label htmlFor="lineOfBusiness">Verzekeringssoort *</Label>
              <Select value={lineOfBusiness} onValueChange={setLineOfBusiness}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent>
                  {INSURANCE_LINES.map((line) => (
                    <SelectItem key={line} value={line}>{line}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="product">Product (optioneel)</Label>
              <Select value={productId} onValueChange={setProductId} disabled={!insurerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Bestaand product" />
                </SelectTrigger>
                <SelectContent>
                  {products?.map((product) => (
                    <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="titlePrefix">Titel Voorvoegsel</Label>
              <Input
                id="titlePrefix"
                value={titlePrefix}
                onChange={(e) => setTitlePrefix(e.target.value)}
                placeholder="Bijv. Q1 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="versionLabel">Versie Label</Label>
              <Input
                id="versionLabel"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder="Bijv. V2024.1"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="versionDate">Versie Datum</Label>
              <Input
                id="versionDate"
                type="date"
                value={versionDate}
                onChange={(e) => setVersionDate(e.target.value)}
              />
            </div>
          </div>

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
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="font-medium">
                  Sleep meerdere PDF bestanden hier of klik om te selecteren
                </p>
                <p className="text-sm text-muted-foreground">
                  Ondersteunt alleen PDF bestanden
                </p>
              </div>
            </div>
          </div>

          {/* Status Summary */}
          {uploadedFiles.length > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex gap-4">
                <Badge variant="outline">{uploadedFiles.length} totaal</Badge>
                {pendingCount > 0 && <Badge variant="secondary">{pendingCount} wachtend</Badge>}
                {processingCount > 0 && <Badge variant="default">{processingCount} bezig</Badge>}
                {completedCount > 0 && <Badge variant="default" className="bg-green-500">{completedCount} voltooid</Badge>}
                {errorCount > 0 && <Badge variant="destructive">{errorCount} fouten</Badge>}
              </div>
              
              <div className="flex gap-2">
                {errorCount > 0 && (
                  <Button variant="outline" size="sm" onClick={retryErrors}>
                    Fouten opnieuw proberen
                  </Button>
                )}
                {completedCount > 0 && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}>
                    Voltooide wissen
                  </Button>
                )}
                {isProcessing ? (
                  <Button variant="outline" size="sm" onClick={togglePause}>
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    {isPaused ? 'Hervatten' : 'Pauzeren'}
                  </Button>
                ) : (
                  <Button 
                    onClick={processAllFiles}
                    disabled={pendingCount === 0 || !insurerId || !lineOfBusiness}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Alle bestanden verwerken ({pendingCount})
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* File List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getStatusIcon(file.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Input
                        value={file.title}
                        onChange={(e) => updateFileTitle(index, e.target.value)}
                        className="text-sm"
                        disabled={file.status === 'processing' || file.status === 'uploading'}
                      />
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {getStatusText(file.status)}
                      </Badge>
                    </div>
                    
                    <p className="text-xs text-muted-foreground truncate">
                      {file.file.name} • {(file.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    
                    {(file.status === 'uploading' || file.status === 'processing') && (
                      <Progress value={file.progress} className="h-1 mt-2" />
                    )}
                    
                    {file.error && (
                      <Alert className="mt-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">{file.error}</AlertDescription>
                      </Alert>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={file.status === 'processing' || file.status === 'uploading'}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
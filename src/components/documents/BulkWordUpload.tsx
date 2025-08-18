import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileText, Upload, CheckCircle, AlertCircle, FileType2, Loader2 } from 'lucide-react';
import mammoth from 'mammoth';

interface UploadedWordFile {
  file: File;
  status: 'pending' | 'extracting' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: any;
  extractedText?: string;
  customTitle?: string;
}

export const BulkWordUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedWordFile[]>([]);
  const [titlePrefix, setTitlePrefix] = useState('');
  const { toast } = useToast();

  const processWordDocument = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const processTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0,
      customTitle: ''
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/msword': ['.doc'],
      'text/plain': ['.txt']
    },
    multiple: true
  });

  const processFile = async (fileIndex: number) => {
    const fileData = uploadedFiles[fileIndex];
    if (!fileData) return;

    try {
      // Step 1: Extract text
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { ...f, status: 'extracting', progress: 20 } : f)
      );

      let extractedText = '';
      
      if (fileData.file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          fileData.file.name.endsWith('.docx')) {
        extractedText = await processWordDocument(fileData.file);
      } else if (fileData.file.type === 'text/plain' || fileData.file.name.endsWith('.txt')) {
        extractedText = await processTextFile(fileData.file);
      } else {
        throw new Error('Unsupported file type');
      }

      // Update with extracted text
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { 
          ...f, 
          progress: 50, 
          extractedText,
          status: 'processing'
        } : f)
      );

      // Step 2: Process with edge function
      const title = fileData.customTitle || 
                   (titlePrefix ? `${titlePrefix} - ${fileData.file.name.replace(/\.[^/.]+$/, '')}` : 
                   fileData.file.name.replace(/\.[^/.]+$/, ''));

      const { data: result, error: processError } = await supabase.functions.invoke('process-manual-text', {
        body: {
          title: title,
          text: extractedText,
        }
      });

      if (processError) {
        throw processError;
      }

      // Update status to completed
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { 
          ...f, 
          status: 'completed', 
          progress: 100,
          result 
        } : f)
      );

      toast({
        title: "Document verwerkt",
        description: `${fileData.file.name} is succesvol verwerkt (${result.chunkCount} chunks).`,
      });

    } catch (error) {
      console.error('Error processing file:', error);
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Processing failed'
        } : f)
      );

      toast({
        title: "Verwerking mislukt",
        description: `Fout bij verwerken van ${fileData.file.name}`,
        variant: "destructive",
      });
    }
  };

  const processAllFiles = async () => {
    const pendingFiles = uploadedFiles
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.status === 'pending');

    for (const { index } of pendingFiles) {
      await processFile(index);
    }
  };

  const updateFileTitle = (fileIndex: number, title: string) => {
    setUploadedFiles(prev => 
      prev.map((f, i) => i === fileIndex ? { ...f, customTitle: title } : f)
    );
  };

  const getStatusIcon = (status: UploadedWordFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'extracting':
      case 'processing':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: UploadedWordFile['status']) => {
    switch (status) {
      case 'pending': return 'Wachtend';
      case 'extracting': return 'Tekst extraheren...';
      case 'processing': return 'Verwerken...';
      case 'completed': return 'Voltooid';
      case 'error': return 'Fout';
      default: return 'Onbekend';
    }
  };

  const clearCompletedFiles = () => {
    setUploadedFiles(prev => prev.filter(f => f.status !== 'completed'));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileType2 className="h-5 w-5" />
            Bulk Word Document Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titlePrefix">Titel Voorvoegsel (optioneel)</Label>
              <Input
                id="titlePrefix"
                value={titlePrefix}
                onChange={(e) => setTitlePrefix(e.target.value)}
                placeholder="Bijv. 'Q1 2024 Beleid' - wordt toegevoegd aan elke bestandsnaam"
              />
            </div>
          </div>

          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <FileType2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg">Drop de bestanden hier...</p>
            ) : (
              <div>
                <p className="text-lg mb-2">Sleep Word documenten hierheen of klik om te selecteren</p>
                <p className="text-sm text-muted-foreground">
                  Ondersteunt .docx, .doc en .txt bestanden - meerdere bestanden tegelijk
                </p>
              </div>
            )}
          </div>

          {/* Upload Status */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Upload Status ({uploadedFiles.length} bestanden)</h3>
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    onClick={clearCompletedFiles}
                    disabled={!uploadedFiles.some(f => f.status === 'completed')}
                  >
                    Voltooide Wissen
                  </Button>
                  <Button 
                    onClick={processAllFiles}
                    disabled={!uploadedFiles.some(f => f.status === 'pending')}
                  >
                    Alle Bestanden Verwerken
                  </Button>
                </div>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {uploadedFiles.map((fileData, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(fileData.status)}
                        <span className="font-medium">{fileData.file.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({Math.round(fileData.file.size / 1024)} KB)
                        </span>
                      </div>
                      <span className="text-sm font-medium">
                        {getStatusText(fileData.status)}
                      </span>
                    </div>

                    {/* Custom title input */}
                    {fileData.status === 'pending' && (
                      <div className="mb-2">
                        <Input
                          placeholder={`Aangepaste titel voor ${fileData.file.name}`}
                          value={fileData.customTitle}
                          onChange={(e) => updateFileTitle(index, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}

                    {(fileData.status === 'extracting' || fileData.status === 'processing') && (
                      <Progress value={fileData.progress} className="mb-2" />
                    )}

                    {fileData.status === 'error' && (
                      <p className="text-sm text-red-500">{fileData.error}</p>
                    )}

                    {fileData.status === 'completed' && fileData.result && (
                      <div className="text-sm space-y-1">
                        <p><strong>Chunks aangemaakt:</strong> {fileData.result.chunkCount}</p>
                        <p><strong>Tekst lengte:</strong> {fileData.extractedText?.length.toLocaleString()} karakters</p>
                        <p className="text-green-600 font-medium">✓ Succesvol verwerkt en doorzoekbaar</p>
                      </div>
                    )}

                    {fileData.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => processFile(index)}
                        className="mt-2"
                      >
                        Verwerk Dit Bestand
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
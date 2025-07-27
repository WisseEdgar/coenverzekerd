import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { FileText, Upload, CheckCircle, AlertCircle } from 'lucide-react';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: any;
}

export const DocumentUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { toast } = useToast();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const uploadFile = async (fileIndex: number) => {
    const fileData = uploadedFiles[fileIndex];
    if (!fileData) return;

    try {
      // Update status to uploading
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { ...f, status: 'uploading', progress: 10 } : f)
      );

      // Upload file to Supabase Storage
      const fileExt = fileData.file.name.split('.').pop();
      const fileName = `${Date.now()}-${fileData.file.name}`;
      const filePath = `${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, fileData.file);

      if (uploadError) {
        throw uploadError;
      }

      // Update progress
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { ...f, progress: 50 } : f)
      );

      // Process document
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { ...f, status: 'processing', progress: 70 } : f)
      );

      const { data: processResult, error: processError } = await supabase.functions.invoke('process-document', {
        body: {
          document: {
            filename: fileData.file.name,
            file_path: filePath,
            file_size: fileData.file.size,
            mime_type: fileData.file.type,
          }
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
          result: processResult 
        } : f)
      );

      toast({
        title: "Document verwerkt",
        description: `${fileData.file.name} is succesvol verwerkt en gecategoriseerd.`,
      });

    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { 
          ...f, 
          status: 'error', 
          error: error instanceof Error ? error.message : 'Upload failed'
        } : f)
      );

      toast({
        title: "Upload mislukt",
        description: `Fout bij uploaden van ${fileData.file.name}`,
        variant: "destructive",
      });
    }
  };

  const uploadAllFiles = async () => {
    const pendingFiles = uploadedFiles
      .map((file, index) => ({ file, index }))
      .filter(({ file }) => file.status === 'pending');

    for (const { index } of pendingFiles) {
      await uploadFile(index);
    }
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending': return 'Wachtend';
      case 'uploading': return 'Uploaden...';
      case 'processing': return 'Verwerken...';
      case 'completed': return 'Voltooid';
      case 'error': return 'Fout';
      default: return 'Onbekend';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Documenten Uploaden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            {isDragActive ? (
              <p className="text-lg">Drop de bestanden hier...</p>
            ) : (
              <div>
                <p className="text-lg mb-2">Sleep bestanden hierheen of klik om te selecteren</p>
                <p className="text-sm text-muted-foreground">Alleen PDF-bestanden worden ondersteund</p>
              </div>
            )}
          </div>

          {uploadedFiles.length > 0 && (
            <div className="mt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Upload Status</h3>
                <Button 
                  onClick={uploadAllFiles}
                  disabled={!uploadedFiles.some(f => f.status === 'pending')}
                >
                  Alle Bestanden Uploaden
                </Button>
              </div>

              <div className="space-y-3">
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

                    {(fileData.status === 'uploading' || fileData.status === 'processing') && (
                      <Progress value={fileData.progress} className="mb-2" />
                    )}

                    {fileData.status === 'error' && (
                      <p className="text-sm text-red-500">{fileData.error}</p>
                    )}

                    {fileData.status === 'completed' && fileData.result && (
                      <div className="text-sm space-y-1">
                        <p><strong>Maatschappij:</strong> {fileData.result.processing?.extracted_company || 'Niet gevonden'}</p>
                        <p><strong>Type:</strong> {fileData.result.processing?.extracted_insurance_type || 'Niet gevonden'}</p>
                        <p><strong>Betrouwbaarheid:</strong> {fileData.result.processing?.confidence || 'Onbekend'}</p>
                      </div>
                    )}

                    {fileData.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => uploadFile(index)}
                        className="mt-2"
                      >
                        Upload
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
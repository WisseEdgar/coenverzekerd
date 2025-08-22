import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Loader2, Check, X, Trash2, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface UploadedTextFile {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  error?: string;
  result?: any;
  customTitle?: string;
}

export function BulkTextUpload() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedTextFile[]>([]);
  const [titlePrefix, setTitlePrefix] = useState('');
  const { toast } = useToast();

  const processTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadedTextFile[] = acceptedFiles.map(file => ({
      file,
      status: 'pending',
      progress: 0,
      customTitle: titlePrefix ? `${titlePrefix} - ${file.name.replace(/\.[^/.]+$/, '')}` : file.name.replace(/\.[^/.]+$/, '')
    }));

    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, [titlePrefix]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt']
    },
    multiple: true
  });

  const processFile = async (fileIndex: number) => {
    const file = uploadedFiles[fileIndex];
    if (!file || file.status === 'processing' || file.status === 'completed') return;

    setUploadedFiles(prev => prev.map((f, i) => 
      i === fileIndex ? { ...f, status: 'processing', progress: 10 } : f
    ));

    try {
      // Extract text from file
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, progress: 30 } : f
      ));

      const extractedText = await processTextFile(file.file);

      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { ...f, progress: 60 } : f
      ));

      // Process with Supabase function
      const { data, error } = await supabase.functions.invoke('process-manual-text', {
        body: {
          title: file.customTitle || file.file.name.replace(/\.[^/.]+$/, ''),
          text: extractedText,
        }
      });

      if (error) throw error;

      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { 
          ...f, 
          status: 'completed', 
          progress: 100, 
          result: data 
        } : f
      ));

      toast({
        title: "File processed successfully",
        description: `${file.file.name}: Created ${data.chunkCount} chunks with embeddings`,
      });

    } catch (error) {
      console.error('File processing error:', error);
      setUploadedFiles(prev => prev.map((f, i) => 
        i === fileIndex ? { 
          ...f, 
          status: 'error', 
          progress: 0, 
          error: error instanceof Error ? error.message : 'Processing failed' 
        } : f
      ));

      toast({
        title: "File processing failed",
        description: `${file.file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
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

  const updateFileTitle = (index: number, title: string) => {
    setUploadedFiles(prev => prev.map((f, i) => 
      i === index ? { ...f, customTitle: title } : f
    ));
  };

  const getStatusIcon = (status: UploadedTextFile['status']) => {
    switch (status) {
      case 'pending':
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case 'processing':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = (status: UploadedTextFile['status']) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing...';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
    }
  };

  const clearCompletedFiles = () => {
    setUploadedFiles(prev => prev.filter(file => file.status !== 'completed'));
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const pendingFilesCount = uploadedFiles.filter(f => f.status === 'pending').length;
  const processingFilesCount = uploadedFiles.filter(f => f.status === 'processing').length;
  const completedFilesCount = uploadedFiles.filter(f => f.status === 'completed').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Bulk Text File Upload
          </CardTitle>
          <CardDescription>
            Upload multiple .txt files for bulk processing and automatic embedding generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title Prefix */}
          <div className="space-y-2">
            <Label htmlFor="titlePrefix">Title Prefix (Optional)</Label>
            <Input
              id="titlePrefix"
              value={titlePrefix}
              onChange={(e) => setTitlePrefix(e.target.value)}
              placeholder="Add prefix to all file titles..."
            />
          </div>

          {/* File Upload Zone */}
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
              ${processingFilesCount > 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-lg font-medium">
                  {isDragActive ? 'Drop text files here' : 'Upload Text Files'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop multiple .txt files or click to select files
                </p>
              </div>
            </div>
          </div>

          {/* Bulk Actions */}
          {uploadedFiles.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              <Button
                onClick={processAllFiles}
                disabled={pendingFilesCount === 0 || processingFilesCount > 0}
                className="flex items-center gap-2"
              >
                <Play className="h-4 w-4" />
                Process All Pending ({pendingFilesCount})
              </Button>
              
              {completedFilesCount > 0 && (
                <Button
                  variant="outline"
                  onClick={clearCompletedFiles}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Completed ({completedFilesCount})
                </Button>
              )}
            </div>
          )}

          {/* File List */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">Files to Process</h3>
              <div className="space-y-3">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(file.status)}
                        <span className="font-medium">{file.file.name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({(file.file.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{getStatusText(file.status)}</span>
                        {file.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Custom Title Input */}
                    <div className="space-y-1">
                      <Label className="text-xs">Document Title</Label>
                      <Input
                        value={file.customTitle || ''}
                        onChange={(e) => updateFileTitle(index, e.target.value)}
                        placeholder="Enter custom title..."
                        disabled={file.status === 'processing' || file.status === 'completed'}
                        className="text-sm"
                      />
                    </div>

                    {/* Progress Bar */}
                    {(file.status === 'processing' || file.status === 'completed') && (
                      <Progress value={file.progress} className="h-2" />
                    )}

                    {/* Error Message */}
                    {file.status === 'error' && file.error && (
                      <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {file.error}
                      </div>
                    )}

                    {/* Success Message */}
                    {file.status === 'completed' && file.result && (
                      <div className="text-sm text-green-600 bg-green-50 p-2 rounded">
                        Successfully processed: {file.result.chunkCount} chunks created
                      </div>
                    )}

                    {/* Individual Process Button */}
                    {file.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => processFile(index)}
                        disabled={!file.customTitle?.trim()}
                        className="w-full"
                      >
                        <Upload className="h-3 w-3 mr-1" />
                        Process This File
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
}
import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Type, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import mammoth from 'mammoth';

interface ManualTextInputProps {
  onTextProcessed?: (result: any) => void;
}

export function ManualTextInput({ onTextProcessed }: ManualTextInputProps) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'paste' | 'file'>('paste');
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsProcessing(true);

    try {
      let extractedText = '';
      
      if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || 
          file.name.endsWith('.docx')) {
        extractedText = await processWordDocument(file);
        toast({
          title: "Word document processed",
          description: `Extracted ${extractedText.length} characters from ${file.name}`,
        });
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        extractedText = await processTextFile(file);
        toast({
          title: "Text file processed", 
          description: `Loaded ${extractedText.length} characters from ${file.name}`,
        });
      } else {
        throw new Error('Unsupported file type. Please use .docx or .txt files.');
      }

      setText(extractedText);
      if (!title) {
        setTitle(file.name.replace(/\.[^/.]+$/, ''));
      }
    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "File processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [title, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt']
    },
    multiple: false,
    disabled: isProcessing
  });

  const processManualText = async () => {
    if (!text.trim() || !title.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide both title and text content",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke('process-manual-text', {
        body: {
          title: title.trim(),
          text: text.trim(),
        }
      });

      if (error) throw error;

      toast({
        title: "Text processed successfully",
        description: `Created ${data.chunkCount} chunks with embeddings`,
      });

      onTextProcessed?.(data);
      setText('');
      setTitle('');
    } catch (error) {
      console.error('Manual text processing error:', error);
      toast({
        title: "Processing failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const chunkPreview = text ? Math.ceil(text.length / 800) : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="h-5 w-5" />
            Manual Text Input
          </CardTitle>
          <CardDescription>
            Upload Word documents (.docx), text files (.txt), or paste text directly for processing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Method Selection */}
          <div className="flex gap-4">
            <Button
              variant={uploadMethod === 'paste' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('paste')}
              disabled={isProcessing}
            >
              <Type className="h-4 w-4 mr-2" />
              Paste Text
            </Button>
            <Button
              variant={uploadMethod === 'file' ? 'default' : 'outline'}
              onClick={() => setUploadMethod('file')}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload File
            </Button>
          </div>

          {/* Document Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Document Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter document title..."
              disabled={isProcessing}
            />
          </div>

          {uploadMethod === 'file' ? (
            /* File Upload Zone */
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary/50'}
              `}
            >
              <input {...getInputProps()} />
              <div className="space-y-4">
                {isProcessing ? (
                  <Loader2 className="h-12 w-12 mx-auto text-muted-foreground animate-spin" />
                ) : (
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground" />
                )}
                <div>
                  <p className="text-lg font-medium">
                    {isProcessing ? 'Processing file...' : 
                     isDragActive ? 'Drop file here' : 'Upload Word or Text file'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Supports .docx and .txt files. Word documents will be automatically extracted.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Manual Text Input */
            <div className="space-y-2">
              <Label htmlFor="text">Document Text</Label>
              <Textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your document text here... You can use simple Markdown formatting like:

# Main Heading
## Sub Heading
**Bold text**
- List item

The text will be automatically chunked and processed for search."
                className="min-h-[400px] font-mono text-sm"
                disabled={isProcessing}
              />
            </div>
          )}

          {/* Text Stats */}
          {text && (
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>{text.length.toLocaleString()} characters</span>
              <span>~{Math.ceil(text.length / 5)} words</span>
              <span>~{chunkPreview} chunks</span>
            </div>
          )}

          {/* Process Button */}
          <Button
            onClick={processManualText}
            disabled={!text.trim() || !title.trim() || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing Text...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Process Text & Create Document
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
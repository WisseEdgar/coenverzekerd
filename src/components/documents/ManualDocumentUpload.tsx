import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { FileText, Upload, CheckCircle, AlertCircle, UserPlus, Bot } from 'lucide-react';

interface UploadedFile {
  file: File;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

interface InsuranceCompany {
  id: string;
  name: string;
}

interface InsuranceType {
  id: string;
  name: string;
}

export const ManualDocumentUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [insuranceCompanies, setInsuranceCompanies] = useState<InsuranceCompany[]>([]);
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [documentSummary, setDocumentSummary] = useState('');
  const [useAiForCompany, setUseAiForCompany] = useState(false);
  const [useAiForType, setUseAiForType] = useState(false);
  const { toast } = useToast();

  // Load insurance companies and types
  useEffect(() => {
    const loadData = async () => {
      const [companiesResult, typesResult] = await Promise.all([
        supabase.from('insurance_companies').select('id, name').order('name'),
        supabase.from('insurance_types').select('id, name').order('name')
      ]);

      if (companiesResult.data) setInsuranceCompanies(companiesResult.data);
      if (typesResult.data) setInsuranceTypes(typesResult.data);
    };

    loadData();
  }, []);

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

    if ((!useAiForCompany && !selectedCompanyId) || (!useAiForType && !selectedTypeId)) {
      toast({
        title: "Velden ontbreken",
        description: "Selecteer handmatig of schakel AI categorisatie in voor ontbrekende velden.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Update status to uploading
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { ...f, status: 'uploading', progress: 20 } : f)
      );

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Je moet ingelogd zijn om te uploaden.');
      }

      // Sanitize filename
      const sanitizedFileName = fileData.file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9.-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      const fileName = `${Date.now()}-${sanitizedFileName}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload file to Storage
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { ...f, progress: 50 } : f)
      );

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, fileData.file);

      if (uploadError) throw uploadError;

      // Handle AI categorization or manual selection
      let finalCompanyId = selectedCompanyId;
      let finalTypeId = selectedTypeId;
      
      if (useAiForCompany || useAiForType) {
        setUploadedFiles(prev => 
          prev.map((f, i) => i === fileIndex ? { ...f, progress: 60 } : f)
        );

        try {
          const { data: aiResponse } = await supabase.functions.invoke('categorize-document', {
            body: { 
              filePath,
              categorizeCompany: useAiForCompany,
              categorizeType: useAiForType,
              manualCompanyId: useAiForCompany ? null : selectedCompanyId,
              manualTypeId: useAiForType ? null : selectedTypeId
            }
          });

          if (useAiForCompany && aiResponse?.insurance_company_id) {
            finalCompanyId = aiResponse.insurance_company_id;
          }
          if (useAiForType && aiResponse?.insurance_type_id) {
            finalTypeId = aiResponse.insurance_type_id;
          }

          if ((useAiForCompany && !aiResponse?.insurance_company_id) || 
              (useAiForType && !aiResponse?.insurance_type_id)) {
            throw new Error('AI kon document niet volledig categoriseren');
          }
        } catch (aiError) {
          console.error('AI categorization failed:', aiError);
          toast({
            title: "AI categorisatie mislukt",
            description: "Controleer de handmatige selecties en probeer opnieuw.",
            variant: "destructive",
          });
          
          setUploadedFiles(prev => 
            prev.map((f, i) => i === fileIndex ? { 
              ...f, 
              status: 'error', 
              error: 'AI categorisatie mislukt'
            } : f)
          );
          return;
        }
      }

      // Create document record
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { ...f, progress: 80 } : f)
      );

      const { error: insertError } = await supabase
        .from('documents')
        .insert({
          title: documentTitle || fileData.file.name.replace('.pdf', ''),
          filename: fileData.file.name,
          file_path: filePath,
          file_size: fileData.file.size,
          mime_type: fileData.file.type,
          insurance_company_id: finalCompanyId,
          insurance_type_id: finalTypeId,
          summary: documentSummary || null,
          uploaded_by: user.id
        });

      if (insertError) throw insertError;

      // Update status to completed
      setUploadedFiles(prev => 
        prev.map((f, i) => i === fileIndex ? { 
          ...f, 
          status: 'completed', 
          progress: 100
        } : f)
      );

      toast({
        title: "Document toegevoegd",
        description: `${fileData.file.name} is succesvol handmatig toegevoegd.`,
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
            <UserPlus className="h-5 w-5" />
            Handmatig Documenten Toevoegen
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Form */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="company">
                  Verzekeringsmaatschappij {!useAiForCompany && '*'}
                </Label>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <Switch
                    checked={useAiForCompany}
                    onCheckedChange={setUseAiForCompany}
                  />
                  <span className="text-xs text-muted-foreground">AI</span>
                </div>
              </div>
              <Select 
                value={selectedCompanyId} 
                onValueChange={setSelectedCompanyId}
                disabled={useAiForCompany}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    useAiForCompany 
                      ? "Wordt automatisch bepaald door AI" 
                      : "Selecteer maatschappij"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {insuranceCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="type">
                  Verzekeringstype {!useAiForType && '*'}
                </Label>
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  <Switch
                    checked={useAiForType}
                    onCheckedChange={setUseAiForType}
                  />
                  <span className="text-xs text-muted-foreground">AI</span>
                </div>
              </div>
              <Select 
                value={selectedTypeId} 
                onValueChange={setSelectedTypeId}
                disabled={useAiForType}
              >
                <SelectTrigger>
                  <SelectValue placeholder={
                    useAiForType 
                      ? "Wordt automatisch bepaald door AI" 
                      : "Selecteer type"
                  } />
                </SelectTrigger>
                <SelectContent>
                  {insuranceTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Document Titel (optioneel)</Label>
              <Input
                id="title"
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder="Laat leeg voor bestandsnaam"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Samenvatting (optioneel)</Label>
              <Textarea
                id="summary"
                value={documentSummary}
                onChange={(e) => setDocumentSummary(e.target.value)}
                placeholder="Korte beschrijving van het document"
                rows={3}
              />
            </div>
          </div>

          {/* File Drop Zone */}
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

          {/* Upload Status */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Upload Status</h3>
                <Button 
                  onClick={uploadAllFiles}
                  disabled={!uploadedFiles.some(f => f.status === 'pending') || 
                    ((!useAiForCompany && !selectedCompanyId) || (!useAiForType && !selectedTypeId))}
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

                    {fileData.status === 'uploading' && (
                      <Progress value={fileData.progress} className="mb-2" />
                    )}

                    {fileData.status === 'error' && (
                      <p className="text-sm text-red-500">{fileData.error}</p>
                    )}

                    {fileData.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => uploadFile(index)}
                        disabled={(!useAiForCompany && !selectedCompanyId) || (!useAiForType && !selectedTypeId)}
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
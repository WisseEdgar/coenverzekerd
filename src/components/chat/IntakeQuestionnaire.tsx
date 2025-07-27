import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X, ArrowRight, Save } from "lucide-react";

interface IntakeData {
  client_type?: 'private' | 'business';
  full_name?: string;
  company_name?: string;
  email?: string;
  phone?: string;
  situation_description?: string;
  insurance_needs?: string;
  current_coverage?: string;
  budget?: string;
  timeline?: string;
}

interface IntakeQuestionnaireProps {
  onComplete: (data: IntakeData) => void;
  onSkip: () => void;
  onSaveAsClient?: (data: IntakeData) => void;
}

const INTAKE_QUESTIONS = [
  {
    id: 'client_type',
    label: 'Klanttype',
    type: 'select',
    options: [
      { value: 'private', label: 'Particuliere klant' },
      { value: 'business', label: 'Zakelijke klant' }
    ],
    required: true
  },
  {
    id: 'full_name',
    label: 'Naam',
    type: 'text',
    condition: (data: IntakeData) => data.client_type === 'private'
  },
  {
    id: 'company_name',
    label: 'Bedrijfsnaam',
    type: 'text',
    condition: (data: IntakeData) => data.client_type === 'business'
  },
  {
    id: 'email',
    label: 'E-mailadres',
    type: 'email'
  },
  {
    id: 'phone',
    label: 'Telefoonnummer',
    type: 'tel'
  },
  {
    id: 'situation_description',
    label: 'Beschrijf de situatie van de klant',
    type: 'textarea',
    placeholder: 'Bijv: Nieuwe auto gekocht, verhuizing, bedrijf opstarten...'
  },
  {
    id: 'insurance_needs',
    label: 'Welke verzekering(en) zijn er nodig?',
    type: 'textarea',
    placeholder: 'Bijv: Autoverzekering, inboedelverzekering, aansprakelijkheidsverzekering...'
  },
  {
    id: 'current_coverage',
    label: 'Huidige verzekeringen (indien van toepassing)',
    type: 'textarea',
    placeholder: 'Beschrijf bestaande verzekeringen en eventuele problemen...'
  },
  {
    id: 'budget',
    label: 'Budget indicatie',
    type: 'text',
    placeholder: 'Bijv: €50-100 per maand, geen budget limiet...'
  },
  {
    id: 'timeline',
    label: 'Gewenste tijdslijn',
    type: 'select',
    options: [
      { value: 'urgent', label: 'Zo snel mogelijk' },
      { value: 'week', label: 'Binnen een week' },
      { value: 'month', label: 'Binnen een maand' },
      { value: 'flexible', label: 'Flexibel' }
    ]
  }
];

export default function IntakeQuestionnaire({ onComplete, onSkip, onSaveAsClient }: IntakeQuestionnaireProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<IntakeData>({});
  const [showSummary, setShowSummary] = useState(false);

  const visibleQuestions = INTAKE_QUESTIONS.filter(q => 
    !q.condition || q.condition(data)
  );

  const currentQuestion = visibleQuestions[currentStep];
  const isLastStep = currentStep === visibleQuestions.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      setShowSummary(true);
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (showSummary) {
      setShowSummary(false);
    } else if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleInputChange = (value: any) => {
    setData(prev => ({
      ...prev,
      [currentQuestion.id]: value
    }));
  };

  const handleComplete = () => {
    onComplete(data);
  };

  const handleSaveAsClient = () => {
    if (onSaveAsClient) {
      onSaveAsClient(data);
    }
  };

  const renderInput = () => {
    const value = data[currentQuestion.id as keyof IntakeData] || '';

    switch (currentQuestion.type) {
      case 'select':
        return (
          <Select value={value as string} onValueChange={handleInputChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecteer een optie" />
            </SelectTrigger>
            <SelectContent>
              {currentQuestion.options?.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'textarea':
        return (
          <Textarea
            value={value as string}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={currentQuestion.placeholder}
            rows={3}
          />
        );
      default:
        return (
          <Input
            type={currentQuestion.type}
            value={value as string}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={currentQuestion.placeholder}
          />
        );
    }
  };

  if (showSummary) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Intake Samenvatting
                <Badge variant="outline">{data.client_type === 'private' ? 'Particulier' : 'Zakelijk'}</Badge>
              </CardTitle>
              <CardDescription>
                Controleer de ingevoerde gegevens voordat je verder gaat
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onSkip}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            {Object.entries(data).map(([key, value]) => {
              if (!value) return null;
              const question = INTAKE_QUESTIONS.find(q => q.id === key);
              return (
                <div key={key} className="flex justify-between">
                  <span className="font-medium text-sm">{question?.label}:</span>
                  <span className="text-sm text-muted-foreground max-w-xs text-right">
                    {typeof value === 'string' && value.length > 50 
                      ? `${value.substring(0, 50)}...` 
                      : value}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={handlePrevious}>
              Aanpassen
            </Button>
            {onSaveAsClient && (
              <Button variant="outline" onClick={handleSaveAsClient}>
                <Save className="mr-2 h-4 w-4" />
                Opslaan als Klant
              </Button>
            )}
            <Button onClick={handleComplete} className="flex-1">
              <ArrowRight className="mr-2 h-4 w-4" />
              Start Gesprek
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Snelle Intake</CardTitle>
            <CardDescription>
              Stap {currentStep + 1} van {visibleQuestions.length} - {currentQuestion.label}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Overslaan
          </Button>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div 
            className="bg-simon-green h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentStep + 1) / visibleQuestions.length) * 100}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="current-input" className="text-base font-medium">
            {currentQuestion.label}
            {currentQuestion.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <div className="mt-2">
            {renderInput()}
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          {currentStep > 0 && (
            <Button variant="outline" onClick={handlePrevious}>
              Vorige
            </Button>
          )}
          <Button 
            onClick={handleNext} 
            className="flex-1"
            disabled={currentQuestion.required && !data[currentQuestion.id as keyof IntakeData]}
          >
            {isLastStep ? 'Voltooien' : 'Volgende'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
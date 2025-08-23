import React from 'react';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, FileText, Book } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CitationPillProps {
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'secondary' | 'outline';
  className?: string;
  showIcon?: boolean;
}

export function CitationPill({ 
  label, 
  onClick, 
  variant = 'secondary',
  className,
  showIcon = true 
}: CitationPillProps) {
  const getIcon = () => {
    if (!showIcon) return null;
    
    if (label.includes('art.')) {
      return <Book className="w-3 h-3" />;
    }
    if (label.includes('§')) {
      return <FileText className="w-3 h-3" />;
    }
    return <ExternalLink className="w-3 h-3" />;
  };

  return (
    <Badge
      variant={variant}
      className={cn(
        "inline-flex items-center gap-1 cursor-pointer transition-all duration-200",
        "hover:bg-primary/20 hover:text-primary-foreground hover:scale-105",
        "text-xs font-medium px-2 py-1",
        onClick && "hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      {getIcon()}
      <span className="truncate max-w-[200px]">{label}</span>
    </Badge>
  );
}
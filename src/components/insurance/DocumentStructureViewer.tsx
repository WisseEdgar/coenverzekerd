import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronDown, 
  ChevronRight, 
  FileText, 
  Book, 
  Hash, 
  ExternalLink 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DocumentSection {
  id: string;
  section_path: string;
  section_label: string;
  title: string;
  parent_path?: string;
  depth: number;
  children?: DocumentSection[];
  chunk_count?: number;
}

interface DocumentStructureViewerProps {
  documentId: string;
  sections: DocumentSection[];
  onSectionClick?: (section: DocumentSection) => void;
  className?: string;
}

function SectionNode({ 
  section, 
  onSectionClick, 
  isExpanded = false, 
  onToggle 
}: { 
  section: DocumentSection;
  onSectionClick?: (section: DocumentSection) => void;
  isExpanded?: boolean;
  onToggle?: () => void;
}) {
  const hasChildren = section.children && section.children.length > 0;
  const indentLevel = Math.min(section.depth - 1, 4); // Max 4 levels of indentation

  return (
    <div className="space-y-1">
      <div 
        className={cn(
          "flex items-center gap-2 py-2 px-3 rounded-md cursor-pointer transition-colors",
          "hover:bg-muted/50",
          `ml-${indentLevel * 4}`
        )}
        onClick={() => onSectionClick?.(section)}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-4 h-4 p-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggle?.();
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </Button>
        ) : (
          <div className="w-4 h-4 flex items-center justify-center">
            <Hash className="w-2 h-2 text-muted-foreground" />
          </div>
        )}
        
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Badge variant="outline" className="text-xs font-mono shrink-0">
            {section.section_label}
          </Badge>
          
          <span className="text-sm truncate">{section.title}</span>
          
          {section.chunk_count && (
            <Badge variant="secondary" className="text-xs shrink-0">
              {section.chunk_count} chunks
            </Badge>
          )}
        </div>
        
        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      
      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {section.children!.map((child) => (
            <SectionNode
              key={child.id}
              section={child}
              onSectionClick={onSectionClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DocumentStructureViewer({ 
  documentId, 
  sections, 
  onSectionClick,
  className 
}: DocumentStructureViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Build hierarchical structure
  const buildHierarchy = (sections: DocumentSection[]): DocumentSection[] => {
    const sectionMap = new Map<string, DocumentSection>();
    const rootSections: DocumentSection[] = [];

    // First pass: create map and initialize children arrays
    sections.forEach(section => {
      sectionMap.set(section.id, { ...section, children: [] });
    });

    // Second pass: build hierarchy
    sections.forEach(section => {
      const sectionWithChildren = sectionMap.get(section.id)!;
      
      if (section.parent_path && section.depth > 1) {
        // Find parent by matching section_path with parent_path
        const parent = Array.from(sectionMap.values()).find(s => 
          s.section_path === section.parent_path
        );
        
        if (parent) {
          parent.children!.push(sectionWithChildren);
        } else {
          rootSections.push(sectionWithChildren);
        }
      } else {
        rootSections.push(sectionWithChildren);
      }
    });

    return rootSections.sort((a, b) => a.section_path.localeCompare(b.section_path));
  };

  const hierarchicalSections = buildHierarchy(sections);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const expandAll = () => {
    setExpandedSections(new Set(sections.map(s => s.id)));
  };

  const collapseAll = () => {
    setExpandedSections(new Set());
  };

  if (sections.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Book className="w-4 h-4" />
            Document Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No document structure available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Book className="w-4 h-4" />
            Document Structure
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={expandAll}
              className="text-xs"
            >
              Expand All
            </Button>
            <Button
              variant="ghost" 
              size="sm"
              onClick={collapseAll}
              className="text-xs"
            >
              Collapse All
            </Button>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          {sections.length} sections • Navigate to specific parts
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] p-4">
          <div className="space-y-1">
            {hierarchicalSections.map((section) => (
              <SectionNode
                key={section.id}
                section={section}
                onSectionClick={onSectionClick}
                isExpanded={expandedSections.has(section.id)}
                onToggle={() => toggleSection(section.id)}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
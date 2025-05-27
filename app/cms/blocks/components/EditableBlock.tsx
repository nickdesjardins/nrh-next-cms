// app/cms/blocks/components/EditableBlock.tsx
"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Block, ImageBlockContent } from "@/utils/supabase/types";
import { Button } from "@/components/ui/button";
import { GripVertical, Trash2, Edit2, Check, X } from "lucide-react";
import { getBlockDefinition } from "@/lib/blocks/blockRegistry";

// Define R2_BASE_URL, ideally this would come from a shared config or context
const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

export interface EditableBlockProps {
  block: Block;
  onDelete: (blockId: number) => void;
  isEditing: boolean;
  onSetEditing: (isEditing: boolean) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  tempContent: any;
  onTempContentChange: (newContent: any) => void;
  dragHandleProps?: any; // For dnd-kit: spread {...attributes} {...listeners}
}

export default function EditableBlock({
  block,
  onDelete,
  isEditing,
  onSetEditing,
  onSaveEdit,
  onCancelEdit,
  tempContent,
  onTempContentChange,
  dragHandleProps,
}: EditableBlockProps) {

  const [EditorComponent, setEditorComponent] = useState<React.ComponentType<any> | null>(null);
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Load editor component dynamically when editing starts
  useEffect(() => {
    if (!isEditing) {
      setEditorComponent(null);
      setEditorError(null);
      return;
    }

    const loadEditorComponent = async () => {
      setIsLoadingEditor(true);
      setEditorError(null);

      try {
        const blockDefinition = getBlockDefinition(block.block_type as any);
        if (!blockDefinition) {
          throw new Error(`No block definition found for type: ${block.block_type}`);
        }

        const componentPath = `../editors/${blockDefinition.editorComponentFilename.replace('.tsx', '')}`;
        const module = await import(componentPath);
        setEditorComponent(() => module.default);
      } catch (error) {
        console.error('Failed to load editor component:', error);
        setEditorError(`Failed to load editor for ${block.block_type}`);
      } finally {
        setIsLoadingEditor(false);
      }
    };

    loadEditorComponent();
  }, [isEditing, block.block_type]);

  const renderEditor = () => {
    if (isLoadingEditor) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Loading editor...</div>
        </div>
      );
    }

    if (editorError) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-red-600">{editorError}</div>
        </div>
      );
    }

    if (!EditorComponent) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">No editor available</div>
        </div>
      );
    }

    const currentContent = tempContent || block.content || {};

    // Handle special case for PostsGridBlockEditor which expects a block prop
    if (block.block_type === "posts_grid") {
      return <EditorComponent block={block} />;
    }

    // Standard editor interface: content and onChange props
    return <EditorComponent content={currentContent} onChange={onTempContentChange} />;
  };

  const renderPreview = () => {
    const blockDefinition = getBlockDefinition(block.block_type as any);
    const blockLabel = blockDefinition?.label || block.block_type;

    return (
      <div className="py-4 flex flex-col items-center justify-center space-y-2 min-h-[80px] border border-dashed rounded-md bg-muted/20">
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">{blockLabel}</p>
          <p className="text-xs text-muted-foreground">Click edit to modify content</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => onSetEditing(true)}>
          Edit Block
        </Button>
      </div>
    );
  };

  return (
    <div className="p-4 border rounded-lg bg-card shadow">
      <div className="flex justify-between items-center mb-2 pb-2 border-b">
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <button {...dragHandleProps} className="cursor-grab p-1 -ml-1" aria-label="Drag to reorder">
              <GripVertical className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
          <span className="font-medium capitalize">{block.block_type}</span>
        </div>
        <div className="flex items-center gap-1">
            {isEditing ? (
                <>
                    <Button variant="ghost" size="icon" onClick={onSaveEdit} title="Save">
                        <Check className="h-4 w-4 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onCancelEdit} title="Cancel">
                        <X className="h-4 w-4 text-red-600" />
                    </Button>
                </>
            ) : (
                 <Button variant="ghost" size="icon" onClick={() => onSetEditing(true)} title="Edit">
                    <Edit2 className="h-4 w-4 text-muted-foreground" />
                </Button>
            )}
          <Button variant="ghost" size="icon" onClick={() => onDelete(block.id)} title="Delete">
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </div>
      {isEditing ? <div className="mt-2">{renderEditor()}</div> : renderPreview()}
    </div>
  );
}

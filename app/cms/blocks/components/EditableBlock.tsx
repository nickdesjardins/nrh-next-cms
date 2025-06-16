// app/cms/blocks/components/EditableBlock.tsx
"use client";

import React, { useState, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import type { Block, ImageBlockContent } from "@/utils/supabase/types";
// Directly import PostsGridBlockEditor for the targeted fix
import PostsGridBlockEditor from '../editors/PostsGridBlockEditor';
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
  onEditNestedBlock?: (parentBlockId: string, columnIndex: number, blockIndexInColumn: number) => void;
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
  onEditNestedBlock,
}: EditableBlockProps) {
  // Add a guard for undefined block prop
  if (!block) {
    // Or some other placeholder/error display
    return <div className="p-4 border rounded-lg bg-card shadow text-red-500">Error: Block data is missing in EditableBlock.</div>;
  }

  // Define dynamic imports for each editor type
  // Note: PostsGridBlockEditor is imported statically above due to a "targeted fix"
  const DynamicTextBlockEditor = dynamic(() => import(/* webpackChunkName: "text-block-editor" */ '../editors/TextBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicHeadingBlockEditor = dynamic(() => import(/* webpackChunkName: "heading-block-editor" */ '../editors/HeadingBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicImageBlockEditor = dynamic(() => import(/* webpackChunkName: "image-block-editor" */ '../editors/ImageBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicButtonBlockEditor = dynamic(() => import(/* webpackChunkName: "button-block-editor" */ '../editors/ButtonBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicVideoEmbedBlockEditor = dynamic(() => import(/* webpackChunkName: "video-embed-block-editor" */ '../editors/VideoEmbedBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicSectionBlockEditor = dynamic(() => import(/* webpackChunkName: "section-block-editor" */ '../editors/SectionBlockEditor'), { loading: () => <p>Loading editor...</p> });


  const [EditorComponent, setEditorComponent] = useState<React.ComponentType<any> | null>(null);
  // isLoadingEditor state might become redundant if next/dynamic's loading state is sufficient
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  // Load editor component dynamically when editing starts
  useEffect(() => {
    if (!isEditing) {
      setEditorComponent(null);
      setEditorError(null);
      return;
    }
    
    // Posts_grid is handled by a static import and direct rendering path below.
    if (block && block.block_type === "posts_grid") {
        setEditorComponent(null); // Ensure no other dynamic editor is set
        return;
    }

    setIsLoadingEditor(true); // Still useful for initial "Loading editor..." message if not using dynamic's loading prop
    setEditorError(null);

    try {
      const currentBlockType = block?.block_type;
      if (!currentBlockType) {
        throw new Error(`Block type is missing or block is invalid.`);
      }

      let SelectedEditor = null;
      switch (currentBlockType) {
        case 'text':
          SelectedEditor = DynamicTextBlockEditor;
          break;
        case 'heading':
          SelectedEditor = DynamicHeadingBlockEditor;
          break;
        case 'image':
          SelectedEditor = DynamicImageBlockEditor;
          break;
        case 'button':
          SelectedEditor = DynamicButtonBlockEditor;
          break;
        case 'video_embed':
          SelectedEditor = DynamicVideoEmbedBlockEditor;
          break;
        case 'hero':
        case 'section':
          SelectedEditor = DynamicSectionBlockEditor;
          break;
        // posts_grid is handled statically
        default:
          // This case should ideally not be hit if block_type is valid and not posts_grid
          throw new Error(`No dynamic editor configured for type: ${currentBlockType}`);
      }
      setEditorComponent(() => SelectedEditor); // next/dynamic returns a component directly
      setIsLoadingEditor(false); // Set to false once the dynamic component is assigned
    } catch (error: any) {
      console.error('Failed to select or load editor component:', error);
      setEditorError(`Failed to load editor for ${block?.block_type || 'unknown type'}: ${error.message}`);
      setIsLoadingEditor(false);
    }
  }, [isEditing, block]);

  const renderEditor = () => {
    // Targeted fix: If it's a posts_grid, render it directly.
    if (block && block.block_type === "posts_grid") {
      console.log("EditableBlock: Directly rendering PostsGridBlockEditor with block:", JSON.stringify(block));
      // Ensure block is not null/undefined before passing, though the outer guard should handle this.
      if (!block) return <div className="text-red-500">Error: Block became null before direct render.</div>;
      return <PostsGridBlockEditor block={block} />;
    }

    // Original dynamic loading logic for other block types
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
      // This case should ideally not be hit if isEditing is true and not posts_grid,
      // as useEffect should have loaded it or set an error.
      return (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-muted-foreground">Editor not available or still loading.</div>
        </div>
      );
    }

    const currentContent = tempContent || block.content || {};
    // Standard editor interface for other dynamically loaded blocks
    return <EditorComponent content={currentContent} onChange={onTempContentChange} />;
  };

  const renderPreview = () => {
    // Safe access to block_type for preview
    const currentBlockType = block && block.block_type;
    if (!currentBlockType) {
      return <div className="text-red-500">Error: Block type missing for preview.</div>;
    }

    const blockDefinition = getBlockDefinition(currentBlockType as any);
    const blockLabel = blockDefinition?.label || currentBlockType;

    // Special preview for section blocks
    if (currentBlockType === 'section' && block.content) {
      const sectionContent = block.content as any; // SectionBlockContent type
      const columnBlocks = sectionContent.column_blocks || [];
      const desktopColumns = sectionContent.responsive_columns?.desktop || columnBlocks.length;

      return (
        <div className="py-4 space-y-3 min-h-[120px] border border-dashed rounded-md bg-muted/20">
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">{blockLabel}</p>
            <p className="text-xs text-muted-foreground">
              {desktopColumns} column{desktopColumns !== 1 ? 's' : ''} • Click edit to modify
            </p>
          </div>
          
          {/* Column preview grid */}
          <div className={`grid gap-2 px-4 ${
            desktopColumns === 1 ? 'grid-cols-1' :
            desktopColumns === 2 ? 'grid-cols-2' :
            desktopColumns === 3 ? 'grid-cols-3' :
            'grid-cols-4'
          }`}>
            {Array.from({ length: desktopColumns }, (_, columnIndex) => {
              const columnContent = columnBlocks[columnIndex] || [];
              
              return (
                <div key={columnIndex} className="border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 p-2 min-h-[60px]">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Col {columnIndex + 1}
                  </div>
                  {columnContent.length === 0 ? (
                    <div className="text-xs text-gray-400 italic">Empty</div>
                  ) : (
                    <div className="space-y-1">
                      {columnContent.slice(0, 2).map((innerBlock: any, blockIndexInColumn: number) => {
                        let preview = '';
                        
                        // Generate preview based on block type
                        switch (innerBlock.block_type) {
                          case 'text':
                            const htmlContent = innerBlock.content?.html_content || '';
                            const textContent = htmlContent.replace(/<[^>]*>/g, ''); // Strip HTML tags
                            preview = textContent.substring(0, 30) + (textContent.length > 30 ? '...' : '');
                            break;
                          case 'heading':
                            const headingText = innerBlock.content?.text_content || 'Empty heading';
                            const level = innerBlock.content?.level || 1;
                            preview = `H${level}: ${headingText.substring(0, 20) + (headingText.length > 20 ? '...' : '')}`;
                            break;
                          case 'image':
                            preview = innerBlock.content?.alt_text || (innerBlock.content?.media_id ? 'Image' : 'No image');
                            break;
                          case 'button':
                            preview = `Button: ${innerBlock.content?.text || 'No text'}`;
                            break;
                          case 'video_embed':
                            preview = `Video: ${innerBlock.content?.title || innerBlock.content?.url || 'No URL'}`;
                            break;
                          case 'posts_grid':
                            const cols = innerBlock.content?.columns || 3;
                            const posts = innerBlock.content?.postsPerPage || 12;
                            preview = `Posts: ${cols} cols, ${posts} posts`;
                            break;
                          default:
                            preview = innerBlock.block_type;
                        }
                        
                        const canEditNested = typeof onEditNestedBlock === 'function';
                        const handleClick = canEditNested
                          ? () => onEditNestedBlock(String(block.id), columnIndex, blockIndexInColumn)
                          : undefined;

                        return (
                          <div
                            key={blockIndexInColumn}
                            className={`text-xs text-gray-600 dark:text-gray-300 truncate p-1 rounded ${
                              canEditNested ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800' : ''
                            }`}
                            onClick={handleClick}
                            title={canEditNested ? `Edit this ${innerBlock.block_type} block` : undefined}
                          >
                            <span className="font-medium capitalize">{innerBlock.block_type}:</span> {preview}
                          </div>
                        );
                      })}
                      {columnContent.length > 2 && (
                        <div className="text-xs text-gray-400">
                          +{columnContent.length - 2} more
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => onSetEditing(true)}>
              Edit Section
            </Button>
          </div>
        </div>
      );
    }

    // Default preview for other block types
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
          <span className="font-medium capitalize">{block?.block_type || 'Unknown Block'}</span>
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

// app/cms/blocks/editors/SectionBlockEditor.tsx
"use client";

import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Trash2, Edit2, Check, X, GripVertical, ChevronDown, ChevronUp, Plus, Minus } from "lucide-react";
import type { SectionBlockContent, BlockType } from "@/lib/blocks/blockRegistry";
import { availableBlockTypes, getBlockDefinition, getInitialContent } from "@/lib/blocks/blockRegistry";
import dynamic from 'next/dynamic';

// DND Kit imports for column block reordering
import {
  DndContext,
  closestCenter,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DropAnimation,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SectionBlockEditorProps {
  content: Partial<SectionBlockContent>;
  onChange: (newContent: SectionBlockContent) => void;
}

// Sortable block item component for column blocks
interface SortableColumnBlockProps {
  block: SectionBlockContent['column_blocks'][0][0];
  index: number;
  columnIndex: number;
  onEdit: () => void;
  onDelete: () => void;
  isEditing: boolean;
}

function SortableColumnBlock({ block, index, columnIndex, onEdit, onDelete, isEditing }: SortableColumnBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `column-${columnIndex}-block-${index}`,
    data: {
      type: 'block',
      columnIndex,
      blockIndex: index,
      block
    }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const blockDefinition = getBlockDefinition(block.block_type);
  const blockLabel = blockDefinition?.label || block.block_type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative p-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 shadow-sm"
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab p-1 opacity-0 group-hover:opacity-100 transition-opacity touch-none"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-3 w-3 text-gray-400" />
          </button>
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 capitalize">
            {blockLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="h-6 w-6 p-0"
            title="Edit block"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
            title="Delete block"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Block content preview */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {block.block_type === 'text' && (
          <div dangerouslySetInnerHTML={{ __html: (block.content.html_content || 'Empty text').substring(0, 50) + (block.content.html_content && block.content.html_content.length > 50 ? '...' : '') }} />
        )}
        {block.block_type === 'heading' && (
          <div>H{block.content.level || 1}: {(block.content.text_content || 'Empty heading').substring(0, 30) + (block.content.text_content && block.content.text_content.length > 30 ? '...' : '')}</div>
        )}
        {block.block_type === 'image' && (
          <div>Image: {block.content.alt_text || block.content.media_id ? 'Image selected' : 'No image selected'}</div>
        )}
        {block.block_type === 'button' && (
          <div>Button: {block.content.text || 'No text'} → {block.content.url || '#'}</div>
        )}
        {block.block_type === 'video_embed' && (
          <div>Video: {block.content.title || block.content.url || 'No URL set'}</div>
        )}
        {block.block_type === 'posts_grid' && (
          <div>Posts Grid: {block.content.columns || 3} cols, {block.content.postsPerPage || 12} posts</div>
        )}
      </div>
    </div>
  );
}

// Column editor component
interface ColumnEditorProps {
  columnIndex: number;
  blocks: SectionBlockContent['column_blocks'][0];
  onBlocksChange: (newBlocks: SectionBlockContent['column_blocks'][0]) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

function ColumnEditor({ columnIndex, blocks, onBlocksChange, isExpanded, onToggleExpanded }: ColumnEditorProps) {
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [tempBlockContent, setTempBlockContent] = useState<any>(null);
  const [EditorComponent, setEditorComponent] = useState<React.ComponentType<any> | null>(null);
  const [selectedBlockType, setSelectedBlockType] = useState<BlockType | "">("");

  // Load editor component dynamically when editing starts
  useEffect(() => {
    if (editingBlockIndex === null) {
      setEditorComponent(null);
      return;
    }

    const loadEditorComponent = async () => {
      try {
        const block = blocks[editingBlockIndex];
        const blockDefinition = getBlockDefinition(block.block_type);
        if (!blockDefinition) return;

        const componentPath = `./${blockDefinition.editorComponentFilename.replace('.tsx', '')}`;
        const module = await import(componentPath);
        setEditorComponent(() => module.default);
      } catch (error) {
        console.error('Failed to load editor component:', error);
      }
    };

    loadEditorComponent();
  }, [editingBlockIndex, blocks]);

  const handleAddBlock = () => {
    if (!selectedBlockType) return;
    
    const initialContent = getInitialContent(selectedBlockType);
    const newBlock = {
      block_type: selectedBlockType,
      content: initialContent || {},
      temp_id: `temp-${Date.now()}-${Math.random()}`
    };

    onBlocksChange([...blocks, newBlock]);
    setSelectedBlockType("");
  };

  const handleDeleteBlock = (index: number) => {
    const newBlocks = blocks.filter((_, i) => i !== index);
    onBlocksChange(newBlocks);
    if (editingBlockIndex === index) {
      setEditingBlockIndex(null);
      setTempBlockContent(null);
    }
  };

  const handleStartEdit = (index: number) => {
    setEditingBlockIndex(index);
    setTempBlockContent(JSON.parse(JSON.stringify(blocks[index].content)));
  };

  const handleSaveEdit = () => {
    if (editingBlockIndex === null) return;

    const newBlocks = [...blocks];
    
    // For posts_grid, the content might not have changed via tempBlockContent
    // since PostsGridBlockEditor manages its own state
    if (blocks[editingBlockIndex].block_type === 'posts_grid') {
      // For posts_grid, we keep the existing content since it manages itself
      // This is a limitation we'll need to address in a future update
      console.warn('PostsGridBlockEditor content changes are not yet supported in section columns');
    } else if (tempBlockContent !== null) {
      newBlocks[editingBlockIndex] = {
        ...newBlocks[editingBlockIndex],
        content: tempBlockContent
      };
    }
    
    onBlocksChange(newBlocks);
    setEditingBlockIndex(null);
    setTempBlockContent(null);
  };

  const handleCancelEdit = () => {
    setEditingBlockIndex(null);
    setTempBlockContent(null);
  };


  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Column {columnIndex + 1}
            </h4>
            <span className="text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
              {blocks.length} block{blocks.length !== 1 ? 's' : ''}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Add block controls */}
        <div className="flex gap-2 mt-2">
          <Select value={selectedBlockType} onValueChange={(value) => setSelectedBlockType(value as BlockType)}>
            <SelectTrigger className="flex-1 h-8 text-xs">
              <SelectValue placeholder="Add block..." />
            </SelectTrigger>
            <SelectContent>
              {availableBlockTypes.filter(type => type !== 'section').map((type) => (
                <SelectItem key={type} value={type} className="text-xs capitalize">
                  {getBlockDefinition(type)?.label || type.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={handleAddBlock}
            disabled={!selectedBlockType}
            size="sm"
            className="h-8 px-2"
          >
            <PlusCircle className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3">
          {blocks.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">
              No blocks in this column. Add one above.
            </p>
          ) : (
               <div className="space-y-2">
                 {blocks.map((block, index) => (
                   <div key={`column-${columnIndex}-block-${index}`}>
                     <SortableColumnBlock
                       block={block}
                       index={index}
                       columnIndex={columnIndex}
                       onEdit={() => handleStartEdit(index)}
                       onDelete={() => handleDeleteBlock(index)}
                       isEditing={editingBlockIndex === index}
                     />
                     
                     {/* Inline editor */}
                     {editingBlockIndex === index && EditorComponent && (
                       <div className="mt-2 p-3 border border-blue-200 dark:border-blue-800 rounded bg-blue-50 dark:bg-blue-900/20">
                         <div className="flex items-center justify-between mb-2">
                           <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                             Editing {getBlockDefinition(block.block_type)?.label}
                           </span>
                           <div className="flex gap-1">
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={handleSaveEdit}
                               className="h-6 w-6 p-0 text-green-600"
                             >
                               <Check className="h-3 w-3" />
                             </Button>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={handleCancelEdit}
                               className="h-6 w-6 p-0 text-red-600"
                             >
                               <X className="h-3 w-3" />
                             </Button>
                           </div>
                         </div>
                         <div className="text-sm">
                           {block.block_type === 'posts_grid' ? (
                             <EditorComponent
                               block={{
                                 ...block,
                                 content: tempBlockContent,
                                 id: 0,
                                 language_id: 0,
                                 order: 0,
                                 created_at: '',
                                 updated_at: ''
                               }}
                             />
                           ) : (
                             <EditorComponent
                               content={tempBlockContent}
                               onChange={setTempBlockContent}
                             />
                           )}
                         </div>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SectionBlockEditor({ content, onChange }: SectionBlockEditorProps) {
  // Ensure we have default values first
  const sectionContent: SectionBlockContent = {
    container_type: content.container_type || "container",
    background: content.background || { type: "none" },
    responsive_columns: content.responsive_columns || { mobile: 1, tablet: 2, desktop: 3 },
    column_gap: content.column_gap || "md",
    padding: content.padding || { top: "md", bottom: "md" },
    column_blocks: content.column_blocks || [
      [{ block_type: "text", content: { html_content: "<p>Column 1</p>" } }],
      [{ block_type: "text", content: { html_content: "<p>Column 2</p>" } }],
      [{ block_type: "text", content: { html_content: "<p>Column 3</p>" } }]
    ]
  };

  // Auto-expand columns that have content (UX improvement)
  const getInitialExpandedColumns = () => {
    const expanded = new Set<number>();
    sectionContent.column_blocks.forEach((columnBlocks, index) => {
      if (columnBlocks.length > 0) {
        expanded.add(index);
      }
    });
    // Always expand at least the first column
    expanded.add(0);
    return expanded;
  };

  const [expandedColumns, setExpandedColumns] = useState<Set<number>>(getInitialExpandedColumns());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedBlock, setDraggedBlock] = useState<any>(null);
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState<boolean>(true);

  // DND sensors for cross-column dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );


  const handleContainerTypeChange = (value: SectionBlockContent['container_type']) => {
    onChange({
      ...sectionContent,
      container_type: value
    });
  };

  const handleColumnGapChange = (value: SectionBlockContent['column_gap']) => {
    onChange({
      ...sectionContent,
      column_gap: value
    });
  };

  const handleBackgroundChange = (newBackground: Partial<SectionBlockContent['background']>) => {
    onChange({
      ...sectionContent,
      background: {
        ...sectionContent.background,
        ...newBackground
      }
    });
  };

  const handleBackgroundTypeChange = (type: SectionBlockContent['background']['type']) => {
    let newBackground: SectionBlockContent['background'] = { type };
    
    // Set default values based on type
    switch (type) {
      case 'theme':
        newBackground.theme = 'primary';
        break;
      case 'solid':
        newBackground.solid_color = '#ffffff';
        break;
      case 'gradient':
        newBackground.gradient = {
          type: 'linear',
          direction: 'to right',
          stops: [
            { color: '#ffffff', position: 0 },
            { color: '#000000', position: 100 }
          ]
        };
        break;
      case 'image':
        newBackground.image = {
          media_id: '',
          object_key: '',
          position: 'cover',
          overlay: { type: 'none' }
        };
        break;
    }
    
    onChange({
      ...sectionContent,
      background: newBackground
    });
  };

  const handleGradientStopChange = (index: number, field: 'color' | 'position', value: string | number) => {
    if (!sectionContent.background.gradient) return;
    
    const newStops = [...sectionContent.background.gradient.stops];
    newStops[index] = {
      ...newStops[index],
      [field]: value
    };
    
    handleBackgroundChange({
      gradient: {
        ...sectionContent.background.gradient,
        stops: newStops
      }
    });
  };

  const addGradientStop = () => {
    if (!sectionContent.background.gradient) return;
    
    const stops = sectionContent.background.gradient.stops;
    const newPosition = stops.length > 0 ? Math.min(100, Math.max(...stops.map(s => s.position)) + 25) : 50;
    
    handleBackgroundChange({
      gradient: {
        ...sectionContent.background.gradient,
        stops: [
          ...stops,
          { color: '#808080', position: newPosition }
        ]
      }
    });
  };

  const removeGradientStop = (index: number) => {
    if (!sectionContent.background.gradient || sectionContent.background.gradient.stops.length <= 2) return;
    
    const newStops = sectionContent.background.gradient.stops.filter((_, i) => i !== index);
    handleBackgroundChange({
      gradient: {
        ...sectionContent.background.gradient,
        stops: newStops
      }
    });
  };

  const handleDesktopColumnsChange = (value: string) => {
    const desktopColumns = parseInt(value) as 1 | 2 | 3 | 4;
    const currentBlocks = sectionContent.column_blocks || [];
    let newColumnBlocks = [...currentBlocks];

    if (desktopColumns < currentBlocks.length) {
      // Truncate columns if new column count is less
      newColumnBlocks = currentBlocks.slice(0, desktopColumns);
    } else if (desktopColumns > currentBlocks.length) {
      // Add new default columns if new column count is more
      const columnsToAdd = desktopColumns - currentBlocks.length;
      for (let i = 0; i < columnsToAdd; i++) {
        newColumnBlocks.push([{
          block_type: "text",
          content: { html_content: `<p>New Column ${currentBlocks.length + i + 1}</p>` },
          temp_id: `new-${Date.now()}-${i}`
        }]);
      }
    }

    // Update expanded columns to include new columns
    const newExpandedColumns = new Set(expandedColumns);
    for (let i = 0; i < desktopColumns; i++) {
      if (i === 0) newExpandedColumns.add(i); // Always expand first column
    }
    setExpandedColumns(newExpandedColumns);

    onChange({
      ...sectionContent,
      responsive_columns: {
        ...sectionContent.responsive_columns,
        desktop: desktopColumns,
      },
      column_blocks: newColumnBlocks,
    });
  };

  const handleColumnBlocksChange = (columnIndex: number, newBlocks: SectionBlockContent['column_blocks'][0]) => {
    // With 2D array structure, we directly update the specific column
    const newColumnBlocks = [...sectionContent.column_blocks];
    newColumnBlocks[columnIndex] = newBlocks;

    onChange({
      ...sectionContent,
      column_blocks: newColumnBlocks
    });
  };

  const toggleColumnExpanded = (columnIndex: number) => {
    console.log(` ${columnIndex}:`, {
      currentExpanded: Array.from(expandedColumns),
      isCurrentlyExpanded: expandedColumns.has(columnIndex)
    });
    
    const newExpanded = new Set(expandedColumns);
    if (newExpanded.has(columnIndex)) {
      newExpanded.delete(columnIndex);
      console.log(`🔍 Collapsing column ${columnIndex}`);
    } else {
      newExpanded.add(columnIndex);
      console.log(`🔍 Expanding column ${columnIndex}`);
    }
    
    console.log(`🔍 New expanded columns:`, Array.from(newExpanded));
    setExpandedColumns(newExpanded);
  };

  // Get blocks for a specific column from the 2D array
  const getColumnBlocks = (columnIndex: number) => {
    // With 2D array structure, directly return the column's blocks
    return sectionContent.column_blocks[columnIndex] || [];
  };

  // Parse drag item ID to get column and block indices
  const parseDragId = (id: string) => {
    const parts = id.split('-');
    if (parts.length === 4 && parts[0] === 'column' && parts[2] === 'block') {
      return {
        columnIndex: parseInt(parts[1]),
        blockIndex: parseInt(parts[3])
      };
    }
    return null;
  };

  // Handle drag start - store the dragged block for overlay
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id.toString());
    
    const parsed = parseDragId(active.id.toString());
    if (parsed) {
      const block = sectionContent.column_blocks[parsed.columnIndex]?.[parsed.blockIndex];
      setDraggedBlock(block);
    }
  };

  // Handle drag end - move blocks between columns
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setDraggedBlock(null);
    
    if (!over || active.id === over.id) return;

    const activeData = parseDragId(active.id.toString());
    const overData = parseDragId(over.id.toString());
    
    if (!activeData || !overData) return;

    const { columnIndex: sourceColumn, blockIndex: sourceIndex } = activeData;
    const { columnIndex: targetColumn, blockIndex: targetIndex } = overData;

    // Create a copy of the current column blocks
    const newColumnBlocks = [...sectionContent.column_blocks];
    
    if (sourceColumn === targetColumn) {
      // Same column reordering
      const columnBlocks = [...newColumnBlocks[sourceColumn]];
      const [movedBlock] = columnBlocks.splice(sourceIndex, 1);
      columnBlocks.splice(targetIndex, 0, movedBlock);
      newColumnBlocks[sourceColumn] = columnBlocks;
    } else {
      // Cross-column move
      const sourceColumnBlocks = [...newColumnBlocks[sourceColumn]];
      const targetColumnBlocks = [...newColumnBlocks[targetColumn]];
      
      // Remove from source column
      const [movedBlock] = sourceColumnBlocks.splice(sourceIndex, 1);
      
      // Add to target column
      targetColumnBlocks.splice(targetIndex, 0, movedBlock);
      
      // Update both columns
      newColumnBlocks[sourceColumn] = sourceColumnBlocks;
      newColumnBlocks[targetColumn] = targetColumnBlocks;
    }

    onChange({
      ...sectionContent,
      column_blocks: newColumnBlocks
    });
  };

  // Custom drop animation for better visual feedback
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6 p-4 border-t mt-2">
      {/* Section Configuration */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Section Configuration</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
            className="h-8 w-8 p-0"
            aria-label={isConfigPanelOpen ? "Collapse Section Configuration" : "Expand Section Configuration"}
            title={isConfigPanelOpen ? "Collapse" : "Expand"}
          >
            {isConfigPanelOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        
        {isConfigPanelOpen && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Container Type */}
              <div className="space-y-2">
                <Label htmlFor="container-type">Container Type</Label>
                <Select value={sectionContent.container_type} onValueChange={handleContainerTypeChange}>
                  <SelectTrigger id="container-type">
                    <SelectValue placeholder="Select container type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-width">Full Width</SelectItem>
                    <SelectItem value="container">Container</SelectItem>
                    <SelectItem value="container-sm">Container Small</SelectItem>
                    <SelectItem value="container-lg">Container Large</SelectItem>
                    <SelectItem value="container-xl">Container XL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Desktop Columns */}
              <div className="space-y-2">
                <Label htmlFor="desktop-columns">Desktop Columns</Label>
                <Select value={sectionContent.responsive_columns.desktop.toString()} onValueChange={handleDesktopColumnsChange}>
                  <SelectTrigger id="desktop-columns">
                    <SelectValue placeholder="Select columns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Column</SelectItem>
                    <SelectItem value="2">2 Columns</SelectItem>
                    <SelectItem value="3">3 Columns</SelectItem>
                    <SelectItem value="4">4 Columns</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Column Gap */}
              <div className="space-y-2">
                <Label htmlFor="column-gap">Column Gap</Label>
                <Select value={sectionContent.column_gap} onValueChange={handleColumnGapChange}>
                  <SelectTrigger id="column-gap">
                    <SelectValue placeholder="Select gap" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="sm">Small</SelectItem>
                    <SelectItem value="md">Medium</SelectItem>
                    <SelectItem value="lg">Large</SelectItem>
                    <SelectItem value="xl">Extra Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Background Configuration */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-md font-medium text-gray-900 dark:text-gray-100">Background</h4>
          
          {/* Background Type Selection */}
          <div className="space-y-2">
            <Label htmlFor="background-type">Background Type</Label>
            <Select value={sectionContent.background.type} onValueChange={handleBackgroundTypeChange}>
              <SelectTrigger id="background-type">
                <SelectValue placeholder="Select background type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="theme">Theme Color</SelectItem>
                <SelectItem value="solid">Custom Color</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
                <SelectItem value="image">Image</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Theme Color Options */}
          {sectionContent.background.type === 'theme' && (
            <div className="space-y-2">
              <Label htmlFor="theme-color">Theme Color</Label>
              <Select
                value={sectionContent.background.theme || 'primary'}
                onValueChange={(value) =>
                  handleBackgroundChange({ theme: value as SectionBlockContent['background']['theme'] })
                }
              >
                <SelectTrigger id="theme-color">
                  <SelectValue placeholder="Select theme color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-primary"></div>
                      Primary
                    </div>
                  </SelectItem>
                  <SelectItem value="secondary">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-secondary"></div>
                      Secondary
                    </div>
                  </SelectItem>
                  <SelectItem value="accent">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-accent"></div>
                      Accent
                    </div>
                  </SelectItem>
                  <SelectItem value="muted">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-muted"></div>
                      Muted
                    </div>
                  </SelectItem>
                  <SelectItem value="destructive">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded bg-destructive"></div>
                      Destructive
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Custom Color Picker */}
          {sectionContent.background.type === 'solid' && (
            <div className="space-y-2">
              <Label htmlFor="solid-color">Custom Color</Label>
              <div className="flex gap-2">
                <Input
                  id="solid-color"
                  type="color"
                  value={sectionContent.background.solid_color || '#ffffff'}
                  onChange={(e) => handleBackgroundChange({ solid_color: e.target.value })}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  type="text"
                  value={sectionContent.background.solid_color || '#ffffff'}
                  onChange={(e) => handleBackgroundChange({ solid_color: e.target.value })}
                  placeholder="#ffffff"
                  className="flex-1"
                />
              </div>
            </div>
          )}

          {/* Gradient Configuration */}
          {sectionContent.background.type === 'gradient' && sectionContent.background.gradient && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gradient-type">Gradient Type</Label>
                  <Select
                    value={sectionContent.background.gradient.type}
                    onValueChange={(value: 'linear' | 'radial') =>
                      handleBackgroundChange({
                        gradient: { ...sectionContent.background.gradient!, type: value }
                      })
                    }
                  >
                    <SelectTrigger id="gradient-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="linear">Linear</SelectItem>
                      <SelectItem value="radial">Radial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {sectionContent.background.gradient.type === 'linear' && (
                  <div className="space-y-2">
                    <Label htmlFor="gradient-direction">Direction</Label>
                    <Select
                      value={sectionContent.background.gradient.direction || 'to right'}
                      onValueChange={(value) =>
                        handleBackgroundChange({
                          gradient: { ...sectionContent.background.gradient!, direction: value }
                        })
                      }
                    >
                      <SelectTrigger id="gradient-direction">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to right">To Right</SelectItem>
                        <SelectItem value="to left">To Left</SelectItem>
                        <SelectItem value="to bottom">To Bottom</SelectItem>
                        <SelectItem value="to top">To Top</SelectItem>
                        <SelectItem value="to bottom right">To Bottom Right</SelectItem>
                        <SelectItem value="to bottom left">To Bottom Left</SelectItem>
                        <SelectItem value="to top right">To Top Right</SelectItem>
                        <SelectItem value="to top left">To Top Left</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Gradient Stops */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Color Stops</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addGradientStop}
                    className="h-8 px-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Stop
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {sectionContent.background.gradient.stops.map((stop, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <Input
                        type="color"
                        value={stop.color}
                        onChange={(e) => handleGradientStopChange(index, 'color', e.target.value)}
                        className="w-12 h-8 p-1"
                      />
                      <Input
                        type="text"
                        value={stop.color}
                        onChange={(e) => handleGradientStopChange(index, 'color', e.target.value)}
                        className="flex-1"
                        placeholder="#ffffff"
                      />
                      <Input
                        type="number"
                        value={stop.position}
                        onChange={(e) => handleGradientStopChange(index, 'position', parseInt(e.target.value))}
                        min="0"
                        max="100"
                        className="w-16"
                      />
                      <span className="text-xs text-gray-500">%</span>
                      {sectionContent.background.gradient!.stops.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGradientStop(index)}
                          className="h-8 w-8 p-0 text-red-600"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Gradient Preview */}
              <div className="space-y-2">
                <Label>Preview</Label>
                <div
                  className="w-full h-16 rounded border"
                  style={{
                    background: sectionContent.background.gradient.type === 'linear'
                      ? `linear-gradient(${sectionContent.background.gradient.direction || 'to right'}, ${
                          sectionContent.background.gradient.stops
                            .sort((a, b) => a.position - b.position)
                            .map(stop => `${stop.color} ${stop.position}%`)
                            .join(', ')
                        })`
                      : `radial-gradient(circle, ${
                          sectionContent.background.gradient.stops
                            .sort((a, b) => a.position - b.position)
                            .map(stop => `${stop.color} ${stop.position}%`)
                            .join(', ')
                        })`
                  }}
                />
              </div>
            </div>
          )}

          {/* Image Background */}
          {sectionContent.background.type === 'image' && sectionContent.background.image && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="image-url">Image URL or Media ID</Label>
                <Input
                  id="image-url"
                  type="text"
                  value={sectionContent.background.image.object_key || ''}
                  onChange={(e) => handleBackgroundChange({
                    image: {
                      ...sectionContent.background.image!,
                      object_key: e.target.value,
                      media_id: e.target.value // For now, use the same value
                    }
                  })}
                  placeholder="Enter image URL or upload path"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image-position">Image Position</Label>
                <Select
                  value={sectionContent.background.image.position}
                  onValueChange={(value) =>
                    handleBackgroundChange({
                      image: { ...sectionContent.background.image!, position: value as any }
                    })
                  }
                >
                  <SelectTrigger id="image-position">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Image Overlay */}
              <div className="space-y-2">
                <Label htmlFor="overlay-type">Overlay</Label>
                <Select
                  value={sectionContent.background.image.overlay?.type || 'none'}
                  onValueChange={(value: 'none' | 'solid' | 'gradient') =>
                    handleBackgroundChange({
                      image: {
                        ...sectionContent.background.image!,
                        overlay: {
                          type: value,
                          ...(value === 'solid' && { color: '#000000', opacity: 0.5 })
                        }
                      }
                    })
                  }
                >
                  <SelectTrigger id="overlay-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="solid">Solid Color</SelectItem>
                    <SelectItem value="gradient">Gradient</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {sectionContent.background.image.overlay?.type === 'solid' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="overlay-color">Overlay Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="overlay-color"
                        type="color"
                        value={sectionContent.background.image.overlay.color || '#000000'}
                        onChange={(e) => handleBackgroundChange({
                          image: {
                            ...sectionContent.background.image!,
                            overlay: {
                              ...sectionContent.background.image!.overlay!,
                              color: e.target.value
                            }
                          }
                        })}
                        className="w-16 h-10 p-1"
                      />
                      <Input
                        type="text"
                        value={sectionContent.background.image.overlay.color || '#000000'}
                        onChange={(e) => handleBackgroundChange({
                          image: {
                            ...sectionContent.background.image!,
                            overlay: {
                              ...sectionContent.background.image!.overlay!,
                              color: e.target.value
                            }
                          }
                        })}
                        className="flex-1"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="overlay-opacity">Opacity</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="overlay-opacity"
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={sectionContent.background.image.overlay.opacity || 0.5}
                        onChange={(e) => handleBackgroundChange({
                          image: {
                            ...sectionContent.background.image!,
                            overlay: {
                              ...sectionContent.background.image!.overlay!,
                              opacity: parseFloat(e.target.value)
                            }
                          }
                        })}
                        className="flex-1"
                      />
                      <span className="text-sm text-gray-500 w-8">
                        {Math.round((sectionContent.background.image.overlay.opacity || 0.5) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
          </>
        )}
      </div>

      {/* Column Content Management */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Column Content</h3>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedColumns(new Set(Array.from({ length: sectionContent.responsive_columns.desktop }, (_, i) => i)))}
            >
              Expand All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpandedColumns(new Set())}
            >
              Collapse All
            </Button>
          </div>
        </div>

        <SortableContext
          items={sectionContent.column_blocks.flatMap((columnBlocks, columnIndex) =>
            columnBlocks.map((_, blockIndex) => `column-${columnIndex}-block-${blockIndex}`)
          )}
          strategy={verticalListSortingStrategy}
        >
          <div className={`grid gap-4 grid-cols-1 ${sectionContent.responsive_columns.desktop > 1 ? `lg:grid-cols-${Math.min(sectionContent.responsive_columns.desktop, 2)}` : ''}`}>
            {Array.from({ length: sectionContent.responsive_columns.desktop }, (_, columnIndex) => (
              <ColumnEditor
                key={columnIndex}
                columnIndex={columnIndex}
                blocks={getColumnBlocks(columnIndex)}
                onBlocksChange={(newBlocks) => handleColumnBlocksChange(columnIndex, newBlocks)}
                isExpanded={expandedColumns.has(columnIndex)}
                onToggleExpanded={() => toggleColumnExpanded(columnIndex)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Drag overlay for visual feedback during cross-column dragging */}
        <DragOverlay dropAnimation={dropAnimation}>
          {activeId && draggedBlock ? (
            <div className="p-2 border border-blue-300 dark:border-blue-600 rounded bg-blue-50 dark:bg-blue-900/50 shadow-lg opacity-90">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300 capitalize">
                  {getBlockDefinition(draggedBlock.block_type)?.label || draggedBlock.block_type}
                </span>
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                {draggedBlock.block_type === 'text' && (
                  <div dangerouslySetInnerHTML={{ __html: (draggedBlock.content.html_content || 'Empty text').substring(0, 30) + '...' }} />
                )}
                {draggedBlock.block_type === 'heading' && (
                  <div>H{draggedBlock.content.level || 1}: {(draggedBlock.content.text_content || 'Empty heading').substring(0, 20) + '...'}</div>
                )}
                {draggedBlock.block_type === 'image' && (
                  <div>Image: {draggedBlock.content.alt_text || 'No alt text'}</div>
                )}
                {draggedBlock.block_type === 'button' && (
                  <div>Button: {draggedBlock.content.text || 'No text'}</div>
                )}
                {draggedBlock.block_type === 'video_embed' && (
                  <div>Video: {draggedBlock.content.title || 'No title'}</div>
                )}
                {draggedBlock.block_type === 'posts_grid' && (
                  <div>Posts Grid: {draggedBlock.content.columns || 3} cols</div>
                )}
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>

        <div className="text-sm text-gray-500 mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <p><strong>✨ Enhanced Section Editor:</strong> You can now add, edit, reorder, and delete blocks within each column. Drag blocks between columns for flexible layouts. Each column can contain multiple blocks of different types. Use the expand/collapse controls to manage your workspace efficiently.</p>
        </div>
      </div>
    </DndContext>
  );
}
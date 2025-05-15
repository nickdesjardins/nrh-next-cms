// app/cms/blocks/components/SortableBlockItem.tsx
"use client";

import React from 'react';
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Block } from "@/utils/supabase/types";
import { GripVertical } from "lucide-react";

// Assuming EditableBlock is imported from its actual location
// For this example, let's define its expected props interface
interface EditableBlockProps {
  block: Block;
  onDelete: (blockId: number) => void;
  isEditing: boolean;
  onSetEditing: (isEditing: boolean) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  tempContent: any;
  onTempContentChange: (newContent: any) => void;
  // We'll add drag handle props if EditableBlock itself renders the handle
  // For now, the handle is rendered here.
}

// Re-import EditableBlock (adjust path as necessary)
// This component was previously part of BlockEditorArea.tsx,
// if you haven't extracted it, you'll need to do that or pass its content here.
// For simplicity, let's assume EditableBlock is a separate component.
// If EditableBlock was not extracted, you'd pass its rendering logic here.

// Placeholder for the actual EditableBlock component - you'll import your existing one
// For now, just to make this file type-check, let's use a simplified version of EditableBlock's props
// You should replace this with your actual EditableBlock component and its props.
const EditableBlock = ({
  block,
  isEditing,
  // ... other props from EditableBlock
  dragHandleProps // New prop for drag handle
}: EditableBlockProps & { dragHandleProps?: any }) => {
  // This is a simplified representation. Your actual EditableBlock will have its own rendering logic.
  // The key is that the dragHandleProps (attributes and listeners) should be spread onto the element
  // that acts as the drag handle, or the main draggable element.
  return (
    <div className="p-4 border rounded-lg bg-card shadow">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          {dragHandleProps && (
            <button {...dragHandleProps} className="cursor-grab p-1" aria-label="Drag to reorder">
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
          <span className="font-medium capitalize">{block.block_type}</span>
        </div>
        {/* ... other controls from your EditableBlock ... */}
      </div>
      {isEditing ? <p>Editing {block.block_type}...</p> : <p>Preview for {block.block_type}</p>}
    </div>
  );
};
// END Placeholder for EditableBlock


interface SortableBlockItemProps extends EditableBlockProps {
  // No new props needed specifically for SortableBlockItem itself,
  // as it passes through all props to EditableBlock
}


export function SortableBlockItem(props: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto', // Ensure dragging item is on top
    opacity: isDragging ? 0.8 : 1,
  };

  // Pass the drag handle props (attributes and listeners) to the EditableBlock
  // The EditableBlock component should then spread these onto its drag handle element.
  // If EditableBlock doesn't have a specific handle, spread them on its root.
  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      {/*
        Pass attributes and listeners to the element you want to be the drag handle.
        If the whole block is draggable, pass it to the root of EditableBlock.
        If there's a specific handle icon, pass it to that.
        Here, we pass it as a prop, assuming EditableBlock will use it.
      */}
      <EditableBlock {...props} dragHandleProps={{...attributes, ...listeners}} />
    </div>
  );
}
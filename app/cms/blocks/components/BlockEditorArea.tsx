// app/cms/blocks/components/BlockEditorArea.tsx
"use client";

import React, { useState, useTransition, useEffect, ComponentType } from "react"; // Ensure React is imported
import type { Block, BlockType } from "@/utils/supabase/types"; // Added SectionBlockContent
import { availableBlockTypes } from "@/utils/supabase/types";
import { getBlockDefinition, type SectionBlockContent } from "@/lib/blocks/blockRegistry"; // Added for dynamic editor loading
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  // DialogTrigger, // Not explicitly used for triggering, open state is controlled
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  createBlockForPage,
  createBlockForPost,
  updateBlock, // Added updateBlock
  updateMultipleBlockOrders,
} from "@/app/cms/blocks/actions";

// DND Kit imports
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

// Import the new SortableBlockItem and the extracted EditableBlock
import { SortableBlockItem } from "./SortableBlockItem"; // This will internally use your EditableBlock
import EditableBlock from "./EditableBlock"; // Import the actual EditableBlock

interface BlockEditorAreaProps {
  parentId: number;
  parentType: "page" | "post";
  initialBlocks: Block[];
  languageId: number;
}

interface NestedBlockData {
  block_type: BlockType;
  content: Record<string, any>;
  temp_id?: string;
}

interface EditingNestedBlockInfo {
  parentBlockId: string; // This is the string ID of the parent Section block
  columnIndex: number;
  blockIndexInColumn: number;
  blockData: NestedBlockData; // Type of the individual block within the column
}

export default function BlockEditorArea({ parentId, parentType, initialBlocks, languageId }: BlockEditorAreaProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => initialBlocks.sort((a, b) => a.order - b.order));
  const [isPending, startTransition] = useTransition();
  const [isSavingNested, startSavingNestedTransition] = useTransition();
  const [selectedBlockTypeToAdd, setSelectedBlockTypeToAdd] = useState<BlockType | "">("");

  const [editingBlockId, setEditingBlockId] = useState<number | null>(null);
  const [tempBlockContent, setTempBlockContent] = useState<any>(null);
  const [editingNestedBlockInfo, setEditingNestedBlockInfo] = useState<EditingNestedBlockInfo | null>(null);
  const [NestedBlockEditorComponent, setNestedBlockEditorComponent] = useState<ComponentType<any> | null>(null);
  const [tempNestedBlockContent, setTempNestedBlockContent] = useState<any>(null);


  // Update local state if initialBlocks prop changes (e.g., after parent form save)
   useEffect(() => {
    setBlocks(initialBlocks.sort((a, b) => a.order - b.order));
  }, [initialBlocks]);

  useEffect(() => {
    if (editingNestedBlockInfo) {
      const blockType = editingNestedBlockInfo.blockData.block_type;
      const blockDef = getBlockDefinition(blockType);

      if (blockDef && blockDef.editorComponentFilename) {
        import(`@/app/cms/blocks/editors/${blockDef.editorComponentFilename}`)
          .then(module => {
            setNestedBlockEditorComponent(() => module.default);
            // Initialize tempNestedBlockContent with a deep copy
            setTempNestedBlockContent(JSON.parse(JSON.stringify(editingNestedBlockInfo.blockData.content)));
          })
          .catch(err => {
            console.error(`Failed to load editor component for ${blockType}:`, err);
            setNestedBlockEditorComponent(null);
            setTempNestedBlockContent(null);
            // Optionally, close the modal or show an error
            setEditingNestedBlockInfo(null);
            alert(`Error: Could not load editor for ${blockDef.label || blockType}.`);
          });
      } else {
        console.warn(`No editor component filename defined for block type: ${blockType}`);
        setNestedBlockEditorComponent(null);
        setTempNestedBlockContent(null);
        setEditingNestedBlockInfo(null);
        alert(`Error: Editor not configured for ${blockType}.`);
      }
    } else {
      setNestedBlockEditorComponent(null);
      setTempNestedBlockContent(null);
    }
  }, [editingNestedBlockInfo]);

  const handleSaveNestedBlock = () => {
    if (!editingNestedBlockInfo || tempNestedBlockContent === null) {
      console.warn("Missing info for saving nested block", { editingNestedBlockInfo, tempNestedBlockContent });
      return;
    }

    startSavingNestedTransition(() => {
      const { parentBlockId, columnIndex, blockIndexInColumn } = editingNestedBlockInfo;

      // Create a deep copy of the blocks to modify
      const updatedBlocks = JSON.parse(JSON.stringify(blocks)) as Block[];

      const parentSectionBlockIndex = updatedBlocks.findIndex(b => String(b.id) === parentBlockId && b.block_type === 'section');

      if (parentSectionBlockIndex === -1) {
        console.error("Parent section block not found for saving nested block:", parentBlockId);
        alert("Error: Could not find the parent section block to save changes.");
        return;
      }

      const parentSectionBlock = updatedBlocks[parentSectionBlockIndex];
      // Ensure content is treated as SectionBlockContent
      const sectionContent = parentSectionBlock.content as SectionBlockContent;


      // Ensure column_blocks and the specific column exist
      if (!sectionContent.column_blocks || !sectionContent.column_blocks[columnIndex]) {
        console.error("Column blocks or specific column not found in parent section block:", sectionContent);
        alert("Error: Could not find the column structure to save changes.");
        return;
      }

      // Create a deep copy of the column_blocks to avoid direct state mutation issues
      const copiedColumnBlocks = JSON.parse(JSON.stringify(sectionContent.column_blocks)) as SectionBlockContent['column_blocks'];

      if (!copiedColumnBlocks[columnIndex] || !copiedColumnBlocks[columnIndex][blockIndexInColumn]) {
          console.error("Nested block not found at specified indices for saving:", { columnIndex, blockIndexInColumn });
          alert("Error: Could not find the nested block to save changes.");
          return;
      }

      // Update the content of the specific nested block
      copiedColumnBlocks[columnIndex][blockIndexInColumn].content = tempNestedBlockContent;

      // Update the parent section block's content
      parentSectionBlock.content = { ...sectionContent, column_blocks: copiedColumnBlocks };


      // Update the local 'blocks' state optimistically
      const newBlocksState = updatedBlocks.map(b =>
        b.id === parentSectionBlock.id ? parentSectionBlock : b
      ).sort((a,b) => a.order - b.order);
      setBlocks(newBlocksState);


      // Persist the change to the parentSectionBlock using updateBlock action
      startTransition(async () => {
        try {
          const result = await updateBlock(
            parentSectionBlock.id, // ID of the parent section block
            parentSectionBlock.content, // Its new content (which now includes the updated nested block)
            parentType === "page" ? parentId : null,
            parentType === "post" ? parentId : null
          );

          if (result && result.success && result.updatedBlock) {
            // Server confirmed save, update state with server's version of the block
            setBlocks(prevBlocks =>
              prevBlocks.map(b => (b.id === parentSectionBlock.id ? result.updatedBlock as Block : b)).sort((a, b) => a.order - b.order)
            );
            setEditingNestedBlockInfo(null); // Close modal
          } else if (result?.error) {
            alert(`Error saving nested block changes: ${result.error}`);
            // Revert optimistic update if the save failed by refetching or using original blocks
            // For simplicity, current optimistic update remains, but a robust solution might revert.
            console.error("Reverting optimistic update might be needed here.");
            setBlocks(blocks.sort((a,b)=>a.order-b.order)); // Basic revert to previous state
          } else {
            alert("An unknown error occurred while saving nested block changes.");
            setBlocks(blocks.sort((a,b)=>a.order-b.order));
          }
        } catch (error) {
          console.error("Failed to save nested block changes:", error);
          alert("A critical error occurred while saving nested block changes. Please try again.");
          setBlocks(blocks.sort((a,b)=>a.order-b.order));
        }
      });
    });
  };


  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddBlock = () => {
    if (!selectedBlockTypeToAdd) return;
    startTransition(async () => {
      const newOrder = blocks.length > 0 ? Math.max(...blocks.map(b => b.order)) + 1 : 0;
      let result;
      if (parentType === "page") {
        result = await createBlockForPage(parentId, languageId, selectedBlockTypeToAdd as BlockType, newOrder);
      } else if (parentType === "post") {
        result = await createBlockForPost(parentId, languageId, selectedBlockTypeToAdd as BlockType, newOrder);
      } else {
        console.error("Unknown parent type:", parentType);
        return;
      }
      if (result && result.success && result.newBlock) {
        setBlocks(prev => [...prev, result.newBlock!].sort((a,b) => a.order - b.order));
        setSelectedBlockTypeToAdd("");
      } else if (result?.error) {
        alert(`Error adding block: ${result.error}`);
      }
    });
  };

  const handleDeleteBlockClient = (blockId: number) => {
    // Server action `deleteBlock` is called from `EditableBlock` now.
    // This function updates local state.
     setBlocks(prev => prev.filter(b => b.id !== blockId));
     // Optionally, call the server action here if not handled by EditableBlock,
     // but it's better to keep server action calls close to the trigger.
  };

 const handleStartEdit = (block: Block) => {
    setEditingBlockId(block.id);
    setTempBlockContent(JSON.parse(JSON.stringify(block.content))); // Deep copy for editing
  };

  const handleTempContentChange = (newContent: any) => {
    setTempBlockContent(newContent);
  };

  const handleSaveEdit = async (blockId: number) => {
    if (tempBlockContent === null) {
      console.warn("No temporary content to save for block:", blockId);
      setEditingBlockId(null); // Still exit editing mode
      return;
    }

    startTransition(async () => {
      try {
        const result = await updateBlock(
          blockId,
          tempBlockContent,
          parentType === "page" ? parentId : null,
          parentType === "post" ? parentId : null
        );

        if (result && result.success && result.updatedBlock) {
          setBlocks(prevBlocks =>
            prevBlocks.map(b => (b.id === blockId ? result.updatedBlock as Block : b)).sort((a, b) => a.order - b.order)
          );
          setEditingBlockId(null);
          setTempBlockContent(null);
        } else if (result?.error) {
          alert(`Error updating block: ${result.error}`);
          // Consider not clearing editing state here, or providing more specific feedback
        } else {
          alert("An unknown error occurred while updating the block.");
        }
      } catch (error) {
        console.error("Failed to save block:", error);
        alert("A critical error occurred while saving the block. Please try again.");
        // Optionally, reset editing state to allow user to retry or cancel
        // setEditingBlockId(null);
        // setTempBlockContent(null);
      }
    });
  };

  const handleCancelEdit = () => {
    setEditingBlockId(null);
    setTempBlockContent(null);
  };

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      // Capture the current state of blocks to use for potential revert
      const originalBlocks = [...blocks]; // Create a shallow copy

      const oldIndex = originalBlocks.findIndex((item) => item.id === active.id);
      const newIndex = originalBlocks.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        console.error("Drag and drop error: item not found.", { activeId: active.id, overId: over.id });
        return; // Exit if items aren't found
      }

      // Calculate the new visual order
      const reorderedItemsArray = arrayMove(originalBlocks, oldIndex, newIndex);

      // Create the final list of items with updated 'order' properties for UI and DB
      const finalItemsWithUpdatedOrder = reorderedItemsArray.map((item, index) => ({
        ...item,
        order: index,
      }));

      // 1. Optimistically update the UI
      setBlocks(finalItemsWithUpdatedOrder);

      // 2. Prepare data for DB update
      const itemsToUpdateDb = finalItemsWithUpdatedOrder.map(item => ({
        id: item.id,
        order: item.order,
      }));

      // 3. Perform server update and handle potential revert
      startTransition(async () => {
        try {
          const result = await updateMultipleBlockOrders(
            itemsToUpdateDb,
            parentType === "page" ? parentId : null,
            parentType === "post" ? parentId : null
          );

          if (result?.error) {
            alert(`Error reordering blocks: ${result.error}`);
            // Revert to the state *before* this drag operation
            setBlocks(originalBlocks.sort((a, b) => a.order - b.order));
          }
          // If successful, the optimistic update is already in place.
        } catch (error) {
          console.error("Failed to reorder blocks:", error);
          alert("A critical error occurred while reordering the blocks. Please try again.");
          // Revert to the state *before* this drag operation as a fallback
          setBlocks(originalBlocks.sort((a, b) => a.order - b.order));
        }
      });
    }
  }

  const handleEditNestedBlock = (parentBlockIdStr: string, columnIndex: number, blockIndexInColumn: number) => {
    const parentSectionBlock = blocks.find(b => String(b.id) === parentBlockIdStr && b.block_type === 'section');

    if (parentSectionBlock) {
      const sectionContent = parentSectionBlock.content as SectionBlockContent;
      if (sectionContent.column_blocks &&
          sectionContent.column_blocks[columnIndex] &&
          sectionContent.column_blocks[columnIndex][blockIndexInColumn]) {
        const nestedBlockData = sectionContent.column_blocks[columnIndex][blockIndexInColumn];
        setEditingNestedBlockInfo({
          parentBlockId: parentBlockIdStr,
          columnIndex,
          blockIndexInColumn,
          blockData: nestedBlockData,
        });
      } else {
        console.error("Nested block not found at specified indices:", { parentBlockIdStr, columnIndex, blockIndexInColumn });
        alert("Error: Could not find the nested block to edit.");
      }
    } else {
      console.error("Parent section block not found:", parentBlockIdStr);
      alert("Error: Could not find the parent section block.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700">
        <Label htmlFor="add-block-select" className="mb-2 block font-medium">Add New Block</Label>
        <div className="flex gap-2">
          <Select value={selectedBlockTypeToAdd} onValueChange={(value) => setSelectedBlockTypeToAdd(value as BlockType)}>
            <SelectTrigger id="add-block-select" className="flex-grow bg-background">
              <SelectValue placeholder="Select block type..." />
            </SelectTrigger>
            <SelectContent>
              {availableBlockTypes.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAddBlock} disabled={isPending || !selectedBlockTypeToAdd}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Block
          </Button>
        </div>
      </div>

      {blocks.length === 0 && (
        <p className="text-muted-foreground text-center py-4">No blocks yet. Add one above to get started!</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div> {/* Relying on SortableBlockItem's mb-4 for consistent spacing */}
            {blocks.map((block) => (
              <SortableBlockItem
                key={block.id}
                block={block}
                // onDelete is now handled by EditableBlock directly calling server action
                // onUpdateContent is also handled by EditableBlock
                isEditing={editingBlockId === block.id}
                onSetEditing={(isEditing) => {
                    if (isEditing) handleStartEdit(block);
                    else handleCancelEdit();
                }}
                onSaveEdit={async () => {
                    // Server call is now initiated by handleSaveEdit
                    await handleSaveEdit(block.id);
                }}
                onCancelEdit={handleCancelEdit}
                tempContent={editingBlockId === block.id ? tempBlockContent : null}
                onTempContentChange={handleTempContentChange}
                // Pass the server action for delete to EditableBlock
                onDelete={async (blockIdToDelete) => {
                    startTransition(() => {
                        // Import deleteBlock directly here to avoid undefined error
                        import("@/app/cms/blocks/actions").then(({ deleteBlock }) => {
                            deleteBlock(blockIdToDelete, parentType === "page" ? parentId : null, parentType === "post" ? parentId : null)
                                .then((result) => {
                                    if (result && result.success) {
                                        setBlocks(prev => prev.filter(b => b.id !== blockIdToDelete));
                                    } else if (result?.error) {
                                        alert(`Error deleting block: ${result.error}`);
                                    }
                                });
                        });
                    });
                }}
                onEditNestedBlock={handleEditNestedBlock} // Pass the new handler
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {editingNestedBlockInfo && (
        <Dialog open={!!editingNestedBlockInfo} onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingNestedBlockInfo(null); // Also reset if closed via 'x' or overlay click
            setNestedBlockEditorComponent(null);
            setTempNestedBlockContent(null);
          }
        }}>
          <DialogContent className="sm:max-w-[625px] md:max-w-[725px] lg:max-w-[900px]">
            <DialogHeader>
              <DialogTitle>
                Editing: {getBlockDefinition(editingNestedBlockInfo.blockData.block_type)?.label || editingNestedBlockInfo.blockData.block_type.replace("_", " ")}
              </DialogTitle>
              <DialogDescription>
                Modify the content of this nested block. Changes will be saved to the parent Section block.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 min-h-[300px]">
              {NestedBlockEditorComponent && tempNestedBlockContent !== null ? (
                <NestedBlockEditorComponent
                  content={tempNestedBlockContent}
                  onChange={setTempNestedBlockContent}
                  // Some editors might need the full block or more context.
                  // For now, this is the common pattern.
                  // blockData={editingNestedBlockInfo.blockData} // Example if full data needed
                  // languageId={languageId} // Example if languageId needed
                />
              ) : (
                <p>Loading editor...</p>
              )}
              {/* Debugging info:
              <pre className="mt-4 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs overflow-auto max-h-[200px]">
                <strong>Temp Nested Content:</strong><br/>
                {JSON.stringify(tempNestedBlockContent, null, 2)}
              </pre>
              */}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditingNestedBlockInfo(null);
                // No need to reset components here, useEffect handles it
              }}>
                Cancel
              </Button>
              <Button onClick={handleSaveNestedBlock} disabled={isSavingNested || isPending}>
                {isSavingNested ? "Saving..." : "Save Nested Block"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

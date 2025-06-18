// app/cms/blocks/components/BlockEditorArea.tsx
"use client";

import React, { useState, useTransition, useEffect, ComponentType, useCallback, useRef } from "react";
import dynamic from 'next/dynamic';
import debounce from 'lodash.debounce';
import type { Block, BlockType } from "@/utils/supabase/types";
import { availableBlockTypes } from "@/utils/supabase/types";
import { getBlockDefinition, type SectionBlockContent } from "@/lib/blocks/blockRegistry";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
  updateBlock,
  updateMultipleBlockOrders,
} from "@/app/cms/blocks/actions";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { SortableBlockItem } from "./SortableBlockItem";
import EditableBlock from "./EditableBlock";

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
  parentBlockId: string;
  columnIndex: number;
  blockIndexInColumn: number;
  blockData: NestedBlockData;
}

export default function BlockEditorArea({ parentId, parentType, initialBlocks, languageId }: BlockEditorAreaProps) {
  const [blocks, setBlocks] = useState<Block[]>(() => initialBlocks.sort((a, b) => a.order - b.order));
  const lastSavedBlocks = useRef(blocks);
  const [isPending, startTransition] = useTransition();
  const [isSavingNested, startSavingNestedTransition] = useTransition();
  const [selectedBlockTypeToAdd, setSelectedBlockTypeToAdd] = useState<BlockType | "">("");
  const [activeBlock, setActiveBlock] = useState<Block | null>(null);
  const [editingNestedBlockInfo, setEditingNestedBlockInfo] = useState<EditingNestedBlockInfo | null>(null);
  const [NestedBlockEditorComponent, setNestedBlockEditorComponent] = useState<ComponentType<any> | null>(null);
  const [tempNestedBlockContent, setTempNestedBlockContent] = useState<any>(null);

  useEffect(() => {
    const sortedBlocks = initialBlocks.sort((a, b) => a.order - b.order);
    setBlocks(sortedBlocks);
    lastSavedBlocks.current = sortedBlocks;
  }, [initialBlocks]);

  const debouncedSave = useCallback(
    debounce(async (blockToSave: Block) => {
      const result = await updateBlock(
        blockToSave.id,
        blockToSave.content,
        parentType === "page" ? parentId : null,
        parentType === "post" ? parentId : null
      );

      if (result.success && result.updatedBlock) {
        // On success, update the last saved state ref
        lastSavedBlocks.current = blocks;
      } else {
        // On failure, revert the UI to the last known good state
        alert("Failed to save changes. Reverting.");
        setBlocks(lastSavedBlocks.current);
      }
    }, 1200),
    [parentId, parentType, blocks]
  );

  const handleContentChange = (blockId: number, newContent: any) => {
    const updatedBlock = {
      ...blocks.find(b => b.id === blockId)!,
      content: newContent,
    };
    setBlocks(prevBlocks => prevBlocks.map(b => b.id === blockId ? updatedBlock : b));
    debouncedSave(updatedBlock);
  };

  const DynamicTextBlockEditor = dynamic(() => import(/* webpackChunkName: "nested-text-block-editor" */ '@/app/cms/blocks/editors/TextBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicHeadingBlockEditor = dynamic(() => import(/* webpackChunkName: "nested-heading-block-editor" */ '@/app/cms/blocks/editors/HeadingBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicImageBlockEditor = dynamic(() => import(/* webpackChunkName: "nested-image-block-editor" */ '@/app/cms/blocks/editors/ImageBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicButtonBlockEditor = dynamic(() => import(/* webpackChunkName: "nested-button-block-editor" */ '@/app/cms/blocks/editors/ButtonBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicPostsGridBlockEditor = dynamic(() => import(/* webpackChunkName: "nested-posts-grid-block-editor" */ '@/app/cms/blocks/editors/PostsGridBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicVideoEmbedBlockEditor = dynamic(() => import(/* webpackChunkName: "nested-video-embed-block-editor" */ '@/app/cms/blocks/editors/VideoEmbedBlockEditor'), { loading: () => <p>Loading editor...</p> });
  const DynamicSectionBlockEditor = dynamic(() => import(/* webpackChunkName: "nested-section-block-editor" */ '@/app/cms/blocks/editors/SectionBlockEditor'), { loading: () => <p>Loading editor...</p> });

  useEffect(() => {
    if (editingNestedBlockInfo) {
      const blockType = editingNestedBlockInfo.blockData.block_type;
      let SelectedEditor: React.ComponentType<any> | null = null;

      try {
        switch (blockType) {
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
          case 'posts_grid':
            SelectedEditor = DynamicPostsGridBlockEditor;
            break;
          case 'video_embed':
            SelectedEditor = DynamicVideoEmbedBlockEditor;
            break;
          case 'section':
            SelectedEditor = DynamicSectionBlockEditor;
            break;
          default:
            console.warn(`No dynamic editor configured for nested block type: ${blockType}`);
            alert(`Error: Editor not configured for ${blockType}.`);
            setEditingNestedBlockInfo(null);
            return;
        }
        setNestedBlockEditorComponent(() => SelectedEditor);
        setTempNestedBlockContent(JSON.parse(JSON.stringify(editingNestedBlockInfo.blockData.content)));
      } catch (error) {
        console.error(`Failed to load editor component for ${blockType}:`, error);
        alert(`Error: Could not load editor for ${blockType}.`);
        setNestedBlockEditorComponent(null);
        setTempNestedBlockContent(null);
        setEditingNestedBlockInfo(null);
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
      const updatedBlocks = JSON.parse(JSON.stringify(blocks)) as Block[];
      const parentSectionBlockIndex = updatedBlocks.findIndex(b => String(b.id) === parentBlockId && b.block_type === 'section');

      if (parentSectionBlockIndex === -1) {
        console.error("Parent section block not found for saving nested block:", parentBlockId);
        alert("Error: Could not find the parent section block to save changes.");
        return;
      }

      const parentSectionBlock = updatedBlocks[parentSectionBlockIndex];
      const sectionContent = parentSectionBlock.content as SectionBlockContent;

      if (!sectionContent.column_blocks || !sectionContent.column_blocks[columnIndex]) {
        console.error("Column blocks or specific column not found in parent section block:", sectionContent);
        alert("Error: Could not find the column structure to save changes.");
        return;
      }

      const copiedColumnBlocks = JSON.parse(JSON.stringify(sectionContent.column_blocks)) as SectionBlockContent['column_blocks'];

      if (!copiedColumnBlocks[columnIndex] || !copiedColumnBlocks[columnIndex][blockIndexInColumn]) {
          console.error("Nested block not found at specified indices for saving:", { columnIndex, blockIndexInColumn });
          alert("Error: Could not find the nested block to save changes.");
          return;
      }

      copiedColumnBlocks[columnIndex][blockIndexInColumn].content = tempNestedBlockContent;
      parentSectionBlock.content = { ...sectionContent, column_blocks: copiedColumnBlocks };

      const newBlocksState = updatedBlocks.map(b =>
        b.id === parentSectionBlock.id ? parentSectionBlock : b
      ).sort((a,b) => a.order - b.order);
      setBlocks(newBlocksState);

      startTransition(async () => {
        const result = await updateBlock(
          parentSectionBlock.id,
          parentSectionBlock.content,
          parentType === "page" ? parentId : null,
          parentType === "post" ? parentId : null
        );

        if (result.success && result.updatedBlock) {
          lastSavedBlocks.current = blocks;
          setEditingNestedBlockInfo(null);
        } else {
          alert(`Error saving nested block changes: ${result.error}`);
          setBlocks(lastSavedBlocks.current);
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
        const newBlock = result.newBlock as Block;
        setBlocks(prev => [...prev, newBlock].sort((a,b) => a.order - b.order));
        lastSavedBlocks.current = [...blocks, newBlock].sort((a,b) => a.order - b.order);
        setSelectedBlockTypeToAdd("");
      } else if (result?.error) {
        alert(`Error adding block: ${result.error}`);
      }
    });
  };

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const activeBlock = blocks.find(b => b.id === active.id) || null;
    setActiveBlock(activeBlock);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    setActiveBlock(null);

    if (over && active.id !== over.id) {
      const originalBlocks = [...blocks];
      const oldIndex = originalBlocks.findIndex((item) => item.id === active.id);
      const newIndex = originalBlocks.findIndex((item) => item.id === over.id);

      if (oldIndex === -1 || newIndex === -1) {
        console.error("Drag and drop error: item not found.", { activeId: active.id, overId: over.id });
        return;
      }

      const reorderedItemsArray = arrayMove(originalBlocks, oldIndex, newIndex);
      const finalItemsWithUpdatedOrder = reorderedItemsArray.map((item, index) => ({
        ...item,
        order: index,
      }));

      setBlocks(finalItemsWithUpdatedOrder);

      const itemsToUpdateDb = finalItemsWithUpdatedOrder.map(item => ({
        id: item.id,
        order: item.order,
      }));

      startTransition(async () => {
        const result = await updateMultipleBlockOrders(
          itemsToUpdateDb,
          parentType === "page" ? parentId : null,
          parentType === "post" ? parentId : null
        );

        if (result?.error) {
          alert(`Error reordering blocks: ${result.error}`);
          setBlocks(originalBlocks);
        } else {
          lastSavedBlocks.current = finalItemsWithUpdatedOrder;
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
    <div className="space-y-6 w-full mx-auto px-6">
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
          <div>
            {blocks.map((block) => (
              <SortableBlockItem
                key={block.id}
                block={block}
                onContentChange={handleContentChange}
                onDelete={async (blockIdToDelete) => {
                    startTransition(async () => {
                        const result = await import("@/app/cms/blocks/actions").then(({ deleteBlock }) =>
                            deleteBlock(blockIdToDelete, parentType === "page" ? parentId : null, parentType === "post" ? parentId : null)
                        );
                        if (result && result.success) {
                            const newBlocks = blocks.filter(b => b.id !== blockIdToDelete);
                            setBlocks(newBlocks);
                            lastSavedBlocks.current = newBlocks;
                        } else if (result?.error) {
                            alert(`Error deleting block: ${result.error}`);
                        }
                    });
                }}
                onEditNestedBlock={handleEditNestedBlock}
              />
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
            {activeBlock ? (
                <div className="bg-white shadow-lg rounded-md">
                    <EditableBlock
                        block={activeBlock}
                        className="h-full"
                        onDelete={() => {}}
                        onContentChange={() => {}}
                    />
                </div>
            ) : null}
        </DragOverlay>
      </DndContext>

      {editingNestedBlockInfo && (
        <Dialog open={!!editingNestedBlockInfo} onOpenChange={(isOpen) => {
          if (!isOpen) {
            setEditingNestedBlockInfo(null);
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
              {NestedBlockEditorComponent && tempNestedBlockContent !== null && editingNestedBlockInfo ? (
                (() => {
                  const blockType = editingNestedBlockInfo.blockData.block_type;
                  if (blockType === "posts_grid") {
                    const fullBlockForEditor: Block = {
                      block_type: editingNestedBlockInfo.blockData.block_type,
                      content: tempNestedBlockContent,
                      id: (editingNestedBlockInfo.blockData as any).id || 0,
                      language_id: languageId,
                      order: (editingNestedBlockInfo.blockData as any).order || 0,
                      created_at: (editingNestedBlockInfo.blockData as any).created_at || new Date().toISOString(),
                      updated_at: (editingNestedBlockInfo.blockData as any).updated_at || new Date().toISOString(),
                      page_id: parentType === 'page' ? parentId : null,
                      post_id: parentType === 'post' ? parentId : null,
                    };
                    return <NestedBlockEditorComponent
                              block={fullBlockForEditor}
                              isNestedEditing={true}
                              onChange={setTempNestedBlockContent}
                           />;
                  } else {
                    return (
                      <NestedBlockEditorComponent
                        content={tempNestedBlockContent}
                        onChange={setTempNestedBlockContent}
                      />
                    );
                  }
                })()
              ) : (
                <p>Loading editor or missing data...</p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditingNestedBlockInfo(null);
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

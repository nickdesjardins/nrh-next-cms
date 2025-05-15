// app/cms/blocks/components/RichTextEditor.tsx
"use client";

import React, { useState, useCallback, useEffect } from 'react'; // Added useState, useCallback
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image'; // Tiptap Image Extension
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Undo, Redo, Pilcrow, Image as ImageIconLucide, // ImageIconLucide for the toolbar
  Search, CheckCircle, X as XIcon // For Media Library Modal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Media } from '@/utils/supabase/types';
import { createClient as createBrowserClient } from '@/utils/supabase/client';

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

interface RichTextEditorProps {
  initialContent: string;
  onChange: (htmlContent: string) => void;
  editable?: boolean;
}

// Media Library Modal Component (simplified version, could be extracted)
const MediaLibraryModal = ({ editor }: { editor: Editor | null }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState<Media[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const supabase = createBrowserClient();

  const fetchLibrary = useCallback(async () => {
    if (!isModalOpen) return; // Only fetch if modal is open
    setIsLoadingMedia(true);
    let query = supabase.from('media').select('*').order('created_at', { ascending: false }).limit(20);
    if (searchTerm) {
      query = query.ilike('file_name', `%${searchTerm}%`);
    }
    const { data, error } = await query;
    if (data) setMediaLibrary(data);
    else console.error("Error fetching media library:", error);
    setIsLoadingMedia(false);
  }, [isModalOpen, searchTerm, supabase]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]); // Dependencies: isModalOpen, searchTerm, supabase (via useCallback)

  const handleSelectMedia = (mediaItem: Media) => {
    if (editor && mediaItem.file_type?.startsWith("image/")) {
      const imageUrl = `${R2_BASE_URL}/${mediaItem.object_key}`;
      editor.chain().focus().setImage({ src: imageUrl, alt: mediaItem.description || mediaItem.file_name }).run();
    }
    setIsModalOpen(false);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="ghost" size="icon" title="Add Image" disabled={!editor?.isEditable}>
          <ImageIconLucide className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[650px] md:max-w-[800px] lg:max-w-[1000px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Image from Media Library</DialogTitle>
        </DialogHeader>
        <div className="relative mb-4">
          <Input
            type="search"
            placeholder="Search media by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
        {isLoadingMedia ? (
          <div className="flex-grow flex items-center justify-center"><p>Loading media...</p></div>
        ) : mediaLibrary.length === 0 ? (
          <div className="flex-grow flex items-center justify-center"><p>No media found.</p></div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 overflow-y-auto flex-grow pr-2">
            {mediaLibrary.filter(m => m.file_type?.startsWith("image/")).map((media) => ( // Filter for images
              <button
                key={media.id}
                type="button"
                className="relative aspect-square border rounded-md overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                onClick={() => handleSelectMedia(media)}
              >
                <img
                  src={`${R2_BASE_URL}/${media.object_key}`}
                  alt={media.description || media.file_name}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-white" />
                </div>
                 <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate text-center">
                    {media.file_name}
                </p>
              </button>
            ))}
          </div>
        )}
        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }
  const iconSize = "h-4 w-4";
  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-input bg-background rounded-t-md mb-0">
      <Button type="button" variant={editor.isActive('bold') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run()} title="Bold">
        <Bold className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('italic') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run()} title="Italic">
        <Italic className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('strike') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run()} title="Strikethrough">
        <Strikethrough className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('code') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editor.can().chain().focus().toggleCode().run()} title="Code">
        <Code className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('paragraph') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraph">
        <Pilcrow className={iconSize} />
      </Button>
      {[1, 2, 3, 4].map((level) => (
        <Button key={level} type="button" variant={editor.isActive('heading', { level }) ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run()} title={`Heading ${level}`} className="font-semibold w-8 h-8">
          H{level}
        </Button>
      ))}
      <Button type="button" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet List">
        <List className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered List">
        <ListOrdered className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Blockquote">
        <Quote className={iconSize} />
      </Button>
      
      {/* Add Image Button using MediaLibraryModal */}
      <MediaLibraryModal editor={editor} />

      <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo className={iconSize} />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo className={iconSize} />
      </Button>
    </div>
  );
};

export default function RichTextEditor({ initialContent, onChange, editable = true }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure StarterKit as needed
        // heading: { levels: [1, 2, 3, 4] },
      }),
      ImageExtension.configure({
        // inline: true, // If you want images to be inline
        // allowBase64: true, // If you were to support base64 uploads directly (not recommended for large images)
        HTMLAttributes: { // Default attributes for the <img> tag
            class: 'max-w-full h-auto rounded-md border my-4', // Example styling
          },
      }),
    ],
    content: initialContent,
    editable: editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        // Apply Tailwind prose classes for rich text styling
        // Ensure your globals.css has @tailwindcss/typography plugin enabled
        class: 'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none min-h-[150px] p-3 bg-background',
      },
    },
  });

  return (
    <div className="border border-input rounded-md shadow-sm">
      {editable && <MenuBar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

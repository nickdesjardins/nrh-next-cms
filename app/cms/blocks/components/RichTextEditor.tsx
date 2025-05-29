// app/cms/blocks/components/RichTextEditor.tsx
// User needs to run: npm install @tiptap/extension-color @tiptap/extension-text-style
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import { Mark, mergeAttributes } from '@tiptap/core'; // Added for FontSizeMark
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Undo, Redo, Pilcrow, Image as ImageIconLucide,
  Search, CheckCircle, X as XIcon, Palette, Baseline // Added Baseline icon
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../../../../components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '../../../../components/ui/dialog';
import { Input } from '../../../../components/ui/input';
import type { Media } from '../../../../utils/supabase/types';
import { createClient as createBrowserClient } from '../../../../utils/supabase/client';

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

interface RichTextEditorProps {
  initialContent: string;
  onChange: (htmlContent: string) => void;
  editable?: boolean;
}

// Custom Tiptap extension for Font Size
export interface FontSizeOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (className: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSizeMark = Mark.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      'data-font-size': {
        default: null,
        parseHTML: element => (element as HTMLElement).getAttribute('data-font-size'),
        renderHTML: attributes => {
          if (!attributes['data-font-size']) {
            return {};
          }
          return { class: attributes['data-font-size'] as string };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-font-size]',
        getAttrs: element => {
          const fontSizeClass = (element as HTMLElement).getAttribute('data-font-size');
          return fontSizeClass ? { 'data-font-size': fontSizeClass } : false;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },

  addCommands() {
    return {
      setFontSize: (className) => ({ commands }) => {
        if (!className) {
          return commands.setMark(this.name, { 'data-font-size': className });
        }
        return commands.setMark(this.name, { 'data-font-size': className });
      },
      unsetFontSize: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});
// End of FontSizeMark

const fontSizes = [
  { value: 'text-xs', label: 'X-Small', name: 'XS' },
  { value: 'text-sm', label: 'Small', name: 'S' },
  { value: 'text-base', label: 'Base', name: 'M' },
  { value: 'text-lg', label: 'Large', name: 'L' },
  { value: 'text-xl', label: 'X-Large', name: 'XL' },
];

const MediaLibraryModal = ({ editor }: { editor: Editor | null }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mediaLibrary, setMediaLibrary] = useState<Media[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const supabase = createBrowserClient();

  const fetchLibrary = useCallback(async () => {
    if (!isModalOpen) return;
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
  }, [fetchLibrary]);

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
            {mediaLibrary.filter(m => m.file_type?.startsWith("image/")).map((media) => (
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
  const themeColors = [
    { value: 'primary', label: 'Primary', swatchClass: 'bg-primary text-primary-foreground' },
    { value: 'secondary', label: 'Secondary', swatchClass: 'bg-secondary text-secondary-foreground' },
    { value: 'accent', label: 'Accent', swatchClass: 'bg-accent text-accent-foreground' },
    { value: 'muted', label: 'Muted', swatchClass: 'bg-muted-foreground text-muted' },
    { value: 'destructive', label: 'Destructive', swatchClass: 'bg-destructive text-destructive-foreground' },
    { value: 'background', label: 'Background', swatchClass: 'bg-background text-foreground' },
  ];

  const activeColor = themeColors.find(color => editor.isActive('textStyle', { color: `hsl(var(--${color.value}))` }));
  const activeFontSize = fontSizes.find(size => editor.isActive('fontSize', { 'data-font-size': size.value }));

  return (
    <div className="flex flex-wrap gap-1 p-2 border-b border-input bg-background rounded-t-md mb-0">
      <Button type="button" variant={editor.isActive('bold') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run() || !editor.isEditable} title="Bold">
        <Bold className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('italic') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run() || !editor.isEditable} title="Italic">
        <Italic className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('strike') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run() || !editor.isEditable} title="Strikethrough">
        <Strikethrough className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('code') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editor.can().chain().focus().toggleCode().run() || !editor.isEditable} title="Code">
        <Code className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('paragraph') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().setParagraph().run()} disabled={!editor.isEditable} title="Paragraph">
        <Pilcrow className={iconSize} />
      </Button>
      {[1, 2, 3, 4].map((level) => (
        <Button key={level} type="button" variant={editor.isActive('heading', { level }) ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run()} disabled={!editor.isEditable} title={`Heading ${level}`} className="font-semibold w-8 h-8">
          H{level}
        </Button>
      ))}
      <Button type="button" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={!editor.isEditable} title="Bullet List">
        <List className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={!editor.isEditable} title="Ordered List">
        <ListOrdered className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={!editor.isEditable} title="Blockquote">
        <Quote className={iconSize} />
      </Button>

      {/* Theme Color Dropdown Picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!editor?.isEditable}
            title="Text Color"
            className="flex items-center justify-center"
          >
            <Palette className={iconSize} />
            {activeColor ? (
              <div className={`${activeColor.swatchClass.split(' ')[0]} w-3 h-3 rounded-sm ml-1 border border-border`}></div>
            ) : (
              <div className="w-3 h-3 rounded-sm ml-1 border border-border bg-transparent"></div> // Default/no color swatch
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {themeColors.map(color => (
            <DropdownMenuItem
              key={color.value}
              onClick={() => editor.chain().focus().setColor(`hsl(var(--${color.value}))`).run()}
              className="flex items-center cursor-pointer"
            >
              <div className={`${color.swatchClass.split(' ')[0]} w-4 h-4 rounded-sm mr-2 border border-border`}></div>
              <span>{color.label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => editor.chain().focus().unsetColor().run()}
            className="flex items-center cursor-pointer"
          >
            <XIcon className={`${iconSize} mr-2`} />
            <span>Unset Color</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Font Size Dropdown Picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!editor?.isEditable}
            title="Font Size"
            className="flex items-center justify-center w-auto px-2" // Adjusted for text
          >
            <Baseline className={iconSize} />
            {activeFontSize ? (
              <span className="ml-1 text-xs font-semibold">{activeFontSize.name}</span>
            ) : (
              <span className="ml-1 text-xs font-semibold">M</span> // Default to M if no specific size is active
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {fontSizes.map(size => (
            <DropdownMenuItem
              key={size.value}
              onClick={() => editor.chain().focus().setFontSize(size.value).run()}
              className="flex items-center cursor-pointer"
            >
              <span className={`${size.value} mr-2`}>{size.label}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() => editor.chain().focus().unsetFontSize().run()}
            className="flex items-center cursor-pointer"
          >
            <XIcon className={`${iconSize} mr-2`} />
            <span>Reset Size</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MediaLibraryModal editor={editor} />

      <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || !editor.isEditable} title="Undo">
        <Undo className={iconSize} />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || !editor.isEditable} title="Redo">
        <Redo className={iconSize} />
      </Button>
    </div>
  );
};

export default function RichTextEditor({ initialContent, onChange, editable = true }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // heading: { levels: [1, 2, 3, 4] },
      }),
      ImageExtension.configure({
        HTMLAttributes: {
            class: 'max-w-full h-auto rounded-md border my-4',
          },
      }),
      TextStyle.configure(), // Explicitly adding TextStyle before Color
      Color.configure({ types: ['textStyle'] }), // Color depends on TextStyle
      FontSizeMark.configure({}), // Add our custom FontSizeMark
    ],
    content: initialContent,
    editable: editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
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

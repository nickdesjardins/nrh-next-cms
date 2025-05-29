// User needs to run: npm install @tiptap/extension-color @tiptap/extension-text-style
"use client";

import React, { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExtension from '@tiptap/extension-image';
import { Mark, mergeAttributes, Extension, Node } from '@tiptap/core'; // Added for FontSizeMark, GlobalStyleAttribute, and StyleTagNode
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import {
  Bold, Italic, Strikethrough, Code, List, ListOrdered, Quote, Undo, Redo, Pilcrow, Image as ImageIconLucide,
  Search, CheckCircle, X as XIcon, Palette, Baseline, FileCode
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

// Custom Tiptap Node for <style> Tags
const StyleTagNode = Node.create({
  name: 'styleTag',
  group: 'block', // Can be 'topNode' if it should only be at the root
  atom: true, // True if it's a single, indivisible block
  isolating: true, // Prevents content from outside from merging in
  defining: true, // Ensures this node type is preserved
  draggable: false, // Style blocks are usually not draggable

  addAttributes() {
    return {
      cssContent: {
        default: '',
        parseHTML: element => (element as HTMLElement).innerHTML,
        // renderHTML not strictly needed for cssContent if used directly in node's renderHTML
      },
      type: {
        default: 'text/css',
        parseHTML: element => (element as HTMLElement).getAttribute('type'),
        renderHTML: attributes => (attributes.type ? { type: attributes.type } : {}),
      },
      media: {
        default: null,
        parseHTML: element => (element as HTMLElement).getAttribute('media'),
        renderHTML: attributes => (attributes.media ? { media: attributes.media } : {}),
      },
      // Add other common style tag attributes like 'nonce' if needed
    };
  },

  parseHTML() {
    return [
      {
        tag: 'style',
        getAttrs: domNode => {
          const element = domNode as HTMLElement;
          const attrs: Record<string, any> = {
            cssContent: element.innerHTML,
            type: element.getAttribute('type'), // Default will be applied if null
          };
          const media = element.getAttribute('media');
          if (media !== null) attrs.media = media; // Only set if attribute exists
          // Capture other attributes here if defined in addAttributes
          return attrs;
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    // HTMLAttributes will contain resolved attributes like 'type', 'media' from addAttributes()
    // node.attrs.cssContent contains the raw CSS string

    const styleElement = document.createElement('style');
    
    // Apply all attributes from HTMLAttributes (which are from addAttributes definitions)
    // These are attributes of the <style> tag itself.
    Object.entries(HTMLAttributes).forEach(([key, value]) => {
      // Do not try to set cssContent as an attribute on the style tag
      if (key === 'cssContent') return;

      if (value !== null && value !== undefined) {
        styleElement.setAttribute(key, String(value));
      }
    });
    
    // Set the inner content of the <style> tag
    styleElement.innerHTML = node.attrs.cssContent;

    // Tiptap can handle returning a DOM element directly.
    return styleElement;
  },

  addNodeView() {
    return ({ node, editor, getPos }) => { // Added parameters for potential use
      const container = document.createElement('div');
      container.setAttribute('data-style-node-placeholder', 'true');
      container.style.border = '1px dashed #999';
      container.style.padding = '8px';
      container.style.margin = '1rem 0';
      container.style.fontFamily = 'monospace';
      container.style.fontSize = '0.9em';
      container.style.color = '#555';
      container.textContent = '[Custom CSS Block - Edit in Source View]';
      container.contentEditable = 'false'; // Crucial for atom nodes

      // Optional: Display a snippet of the CSS for context
      // if (node.attrs.cssContent) {
      //   const pre = document.createElement('pre');
      //   pre.style.maxHeight = '50px';
      //   pre.style.overflow = 'hidden';
      //   pre.style.whiteSpace = 'pre-wrap';
      //   pre.textContent = node.attrs.cssContent.substring(0, 100) + (node.attrs.cssContent.length > 100 ? '...' : '');
      //   container.appendChild(pre);
      // }

      return {
        dom: container,
        // update: (updatedNode) => { /* handle updates if necessary */ return false; }
      };
    };
  },
});

// Custom Tiptap Node for <div> Tags
const DivNode = Node.create({
  name: 'divBlock', // Unique name
  group: 'block',    // Belongs to the 'block' group
  content: 'block*', // Allows zero or more block nodes as content (e.g., nested divs, paragraphs, headings)
  defining: true,    // Helps Tiptap prioritize this node during parsing for 'div' tags
  draggable: true,   // Allows the div block to be dragged if a drag handle is provided by other extensions

  addOptions() {
    return {
      HTMLAttributes: {}, // Default HTML attributes for this node type
    };
  },

  // Explicitly declare common attributes to ensure they are recognized by Tiptap's schema
  addAttributes() {
    return {
      class: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('class'),
        renderHTML: (attributes: { class?: string | null }) => {
          return attributes.class ? { class: attributes.class } : {};
        },
      },
      style: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('style'),
        renderHTML: (attributes: { style?: string | null }) => {
          return attributes.style ? { style: attributes.style } : {};
        },
      },
      id: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('id'),
        renderHTML: (attributes: { id?: string | null }) => {
          return attributes.id ? { id: attributes.id } : {};
        },
      },
      // For any other attributes, the main parseHTML().getAttrs will capture them into node.attrs,
      // and renderHTML({ node }) will use mergeAttributes(this.options.HTMLAttributes, node.attrs)
      // to apply them. Declaring common ones here helps with schema recognition.
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div',
        priority: 51, // Ensure this rule runs before default paragraph (priority 50) for divs
        getAttrs: domNode => {
          const element = domNode as HTMLElement;
          const MappedAttributes: Record<string, any> = {};
          for (let i = 0; i < element.attributes.length; i++) {
            const attribute = element.attributes[i];
            // Exclude ProseMirror-specific attributes if they cause issues, though generally, they shouldn't be on source HTML.
            // if (!attribute.name.startsWith('data-pm-')) {
            MappedAttributes[attribute.name] = attribute.value;
            // }
          }
          return MappedAttributes;
        },
      },
    ];
  },

  renderHTML({ node }) {
    // node.attrs contains all attributes captured by getAttrs.
    // this.options.HTMLAttributes can provide default attributes for new DivNodes created via commands,
    // but for parsed nodes, node.attrs is king.
    return ['div', mergeAttributes(this.options.HTMLAttributes, node.attrs), 0]; // '0' renders content
  },
});
// End of DivNode

// Extension to preserve specified HTML attributes on various node types
const PreserveAllAttributesExtension = Extension.create({
  name: 'preserveAllAttributesExtension',

  addGlobalAttributes() {
    return [
      {
        types: [ // Ensure 'divBlock' is NOT listed here as DivNode handles its own attributes.
          'paragraph',
          'heading',
          'listItem',
          'blockquote',
          'codeBlock', // Added back as it's a common block element
          'bulletList', // ul
          'orderedList', // ol
          'textStyle', // span (though typically for inline, can have global attrs)
          // 'horizontalRule', // Example if you use it
          // 'image', // Example if you use it and want global attrs beyond what ImageExtension provides
        ],
        attributes: {
          style: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('style'),
            renderHTML: (attributes: { style?: string | null }) => {
              return attributes.style ? { style: attributes.style } : {};
            },
          },
          class: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('class'),
            renderHTML: (attributes: { class?: string | null }) => {
              return attributes.class ? { class: attributes.class } : {};
            },
          },
          id: {
            default: null,
            parseHTML: (element: HTMLElement) => element.getAttribute('id'),
            renderHTML: (attributes: { id?: string | null }) => {
              return attributes.id ? { id: attributes.id } : {};
            },
          },
          // Generic handler for data-* attributes
          dataAttributes: {
            default: null,
            parseHTML: (element: HTMLElement) => {
              const dataAttrs: Record<string, string> = {};
              for (let i = 0; i < element.attributes.length; i++) {
                const attr = element.attributes[i];
                if (attr.name.startsWith('data-')) {
                  dataAttrs[attr.name] = attr.value;
                }
              }
              return Object.keys(dataAttrs).length > 0 ? dataAttrs : null;
            },
            renderHTML: (attributes: { dataAttributes?: Record<string, string> | null }) => {
              // This will return an object like { "data-foo": "bar", "data-id": "123" }
              // Tiptap should then spread these as attributes on the rendered HTML element.
              return attributes.dataAttributes || {};
            },
          }
        },
      },
    ];
  },
});

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


const MenuBar = ({ editor, toggleSourceView, isSourceView }: { editor: Editor | null, toggleSourceView: () => void, isSourceView: boolean }) => {
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
      <Button type="button" variant={editor.isActive('bold') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBold().run()} disabled={!editor.can().chain().focus().toggleBold().run() || !editor.isEditable || isSourceView} title="Bold">
        <Bold className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('italic') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleItalic().run()} disabled={!editor.can().chain().focus().toggleItalic().run() || !editor.isEditable || isSourceView} title="Italic">
        <Italic className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('strike') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleStrike().run()} disabled={!editor.can().chain().focus().toggleStrike().run() || !editor.isEditable || isSourceView} title="Strikethrough">
        <Strikethrough className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('code') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleCode().run()} disabled={!editor.can().chain().focus().toggleCode().run() || !editor.isEditable || isSourceView} title="Code">
        <Code className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('paragraph') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().setParagraph().run()} disabled={!editor.isEditable || isSourceView} title="Paragraph">
        <Pilcrow className={iconSize} />
      </Button>
      {[1, 2, 3, 4].map((level) => (
        <Button key={level} type="button" variant={editor.isActive('heading', { level }) ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 }).run()} disabled={!editor.isEditable || isSourceView} title={`Heading ${level}`} className="font-semibold w-8 h-8">
          H{level}
        </Button>
      ))}
      <Button type="button" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBulletList().run()} disabled={!editor.isEditable || isSourceView} title="Bullet List">
        <List className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleOrderedList().run()} disabled={!editor.isEditable || isSourceView} title="Ordered List">
        <ListOrdered className={iconSize} />
      </Button>
      <Button type="button" variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} size="icon" onClick={() => editor.chain().focus().toggleBlockquote().run()} disabled={!editor.isEditable || isSourceView} title="Blockquote">
        <Quote className={iconSize} />
      </Button>

      {/* Theme Color Dropdown Picker */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!editor?.isEditable || isSourceView}
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
            disabled={!editor?.isEditable || isSourceView}
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

      <Button type="button" variant="ghost" size="icon" onClick={toggleSourceView} disabled={!editor.isEditable} title={isSourceView ? "Rich Text View" : "HTML Source View"}>
        <FileCode className={iconSize} />
      </Button>

      <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo() || !editor.isEditable || isSourceView} title="Undo">
        <Undo className={iconSize} />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo() || !editor.isEditable || isSourceView} title="Redo">
        <Redo className={iconSize} />
      </Button>
    </div>
  );
};

export default function RichTextEditor({ initialContent, onChange, editable = true }: RichTextEditorProps) {
  const [isSourceView, setIsSourceView] = useState(false);
  const [htmlSource, setHtmlSource] = useState(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
        // Ensure other StarterKit defaults are suitable.
        // If StarterKit's paragraph or other nodes conflict with DivNode's 'div' parsing,
        // you might need to disable them or adjust DivNode's priority.
      }),
      ImageExtension.configure({
        inline: false, // Allow images to be block elements
        allowBase64: true, // If you need to support base64 images
        HTMLAttributes: {
            class: 'max-w-full h-auto rounded-md border my-4',
          },
      }),
      TextStyle.configure(), // Explicitly adding TextStyle before Color
      Color.configure({ types: ['textStyle'] }), // Color depends on TextStyle
      FontSizeMark.configure({}), // Add our custom FontSizeMark
      DivNode.configure({}), // Add the new DivNode
      PreserveAllAttributesExtension.configure(), // Ensure this is configured
      StyleTagNode.configure(), // Ensure this is configured
    ],
    content: initialContent, // Use initialContent directly, will be synced by useEffect
    editable: editable && !isSourceView, // Editor not editable in source view
    onUpdate: ({ editor }) => {
      // This fires when changes are made *within* the Tiptap rich text view.
      const currentTiptapHtml = editor.getHTML();
      setHtmlSource(currentTiptapHtml);
      onChange(currentTiptapHtml);
    },
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert prose-sm sm:prose-base focus:outline-none min-h-[150px] p-3 bg-background',
      },
    },
  });

  useEffect(() => {
    // When initialContent prop changes:
    setHtmlSource(initialContent);
    if (editor && !isSourceView) {
      editor.commands.setContent(initialContent, false);
    }
    // If isSourceView is true, the textarea will automatically pick up the new htmlSource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent, editor]); // editor.setEditable is handled by useEditor's editable prop

  const toggleSourceView = () => {
    if (!editor) return;
    const newIsSourceView = !isSourceView;

    if (newIsSourceView) {
      // Switching FROM Rich Text TO Source View
      // htmlSource should already be up-to-date. The textarea will display it.
      // DO NOT call setHtmlSource(editor.getHTML()) here.
    } else {
      // Switching FROM Source View TO Rich Text View
      editor.commands.setContent(htmlSource, false);
    }
    setIsSourceView(newIsSourceView); // Set state after logic
  };

  const handleSourceChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newSource = event.target.value;
    setHtmlSource(newSource);
    onChange(newSource);
    if (editor) {
      editor.commands.setContent(newSource, false);
    }
  };

  return (
    <div className="border border-input rounded-md shadow-sm">
      {editable && <MenuBar editor={editor} toggleSourceView={toggleSourceView} isSourceView={isSourceView} />}
      {isSourceView && editable ? (
        <textarea
          value={htmlSource}
          onChange={handleSourceChange}
          className="w-full min-h-[150px] p-3 font-mono text-sm border-t border-input focus:outline-none bg-background text-foreground"
          disabled={!editable}
        />
      ) : (
        <EditorContent editor={editor} />
      )}
    </div>
  );
}

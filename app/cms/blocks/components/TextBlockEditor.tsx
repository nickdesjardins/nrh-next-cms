// app/cms/blocks/components/TextBlockEditor.tsx
"use client";

import React from 'react'; // Ensure React is imported for JSX
import { Label } from "@/components/ui/label";
import type { TextBlockContent } from "@/utils/supabase/types";
import RichTextEditor from "./RichTextEditor"; // Import the new Tiptap editor

interface TextBlockEditorProps {
  content: Partial<TextBlockContent>;
  onChange: (newContent: TextBlockContent) => void;
}

export default function TextBlockEditor({ content, onChange }: TextBlockEditorProps) {
  const handleContentChange = (htmlString: string) => {
    onChange({ html_content: htmlString });
  };

  return (
    <div className="space-y-2 p-3 border-t mt-2">
      <Label htmlFor={`text-block-editor-tiptap-${Math.random()}`} className="sr-only">Text Content</Label>
      <RichTextEditor
        initialContent={content.html_content || "<p></p>"} // Start with an empty paragraph if no content
        onChange={handleContentChange}
      />
    </div>
  );
}

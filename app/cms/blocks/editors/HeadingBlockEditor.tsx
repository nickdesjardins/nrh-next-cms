// app/cms/blocks/editors/HeadingBlockEditor.tsx
"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { HeadingBlockContent } from "@/utils/supabase/types";

interface HeadingBlockEditorProps {
  content: Partial<HeadingBlockContent>;
  onChange: (newContent: HeadingBlockContent) => void;
}

export default function HeadingBlockEditor({ content, onChange }: HeadingBlockEditorProps) {
  const idPrefix = React.useId();

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...content, text_content: event.target.value } as HeadingBlockContent);
  };

  const handleLevelChange = (value: string) => {
    onChange({ ...content, level: parseInt(value, 10) as HeadingBlockContent['level'] } as HeadingBlockContent);
  };

  return (
    <div className="space-y-3 p-3 border-t mt-2">
      <div>
        <Label htmlFor={`heading-text-${idPrefix}`}>Heading Text</Label>
        <Input
          id={`heading-text-${idPrefix}`}
          value={content.text_content || ""}
          onChange={handleTextChange}
          placeholder="Enter heading text"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor={`heading-level-${idPrefix}`}>Level</Label>
        <Select
            value={content.level?.toString() || "2"}
            onValueChange={handleLevelChange}
        >
            <SelectTrigger id={`heading-level-${idPrefix}`} className="mt-1">
                <SelectValue placeholder="Select level" />
            </SelectTrigger>
            <SelectContent>
                {[1, 2, 3, 4, 5, 6].map(level => (
                    <SelectItem key={level} value={level.toString()}>H{level}</SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
    </div>
  );
}
import React from "react";
import type { TextBlockContent } from "@/utils/supabase/types";

interface TextBlockRendererProps {
  content: TextBlockContent;
  languageId: number;
}

const TextBlockRenderer: React.FC<TextBlockRendererProps> = ({
  content,
  languageId,
}) => {
  return (
    <div
      className="my-4 prose dark:prose-invert max-w-none"
      dangerouslySetInnerHTML={{
        __html: content.html_content || "",
      }}
    />
  );
};

export default TextBlockRenderer;
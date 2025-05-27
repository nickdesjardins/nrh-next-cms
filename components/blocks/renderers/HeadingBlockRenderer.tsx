import React from "react";
import type { HeadingBlockContent } from "@/utils/supabase/types";

interface HeadingBlockRendererProps {
  content: HeadingBlockContent;
  languageId: number;
}

const HeadingBlockRenderer: React.FC<HeadingBlockRendererProps> = ({
  content,
  languageId,
}) => {
  // Ensure level is between 1 and 6, default to 2
  const level =
    typeof content.level === "number" &&
    content.level >= 1 &&
    content.level <= 6
      ? content.level
      : 2;
  const Tag: React.ElementType = `h${level}`;
  
  return (
    <Tag className="my-6 font-bold">
      {content.text_content}
    </Tag>
  );
};

export default HeadingBlockRenderer;
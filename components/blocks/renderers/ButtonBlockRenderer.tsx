import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ButtonBlockContent } from "@/utils/supabase/types";

interface ButtonBlockRendererProps {
  content: ButtonBlockContent;
  languageId: number;
}

const ButtonBlockRenderer: React.FC<ButtonBlockRendererProps> = ({
  content,
  languageId,
}) => {
  const isExternal =
    content.url?.startsWith("http") ||
    content.url?.startsWith("mailto:") ||
    content.url?.startsWith("tel:");
  const isAnchor = content.url?.startsWith("#");

  return (
    <div className="my-6 text-center">
      {!isExternal && !isAnchor && !!content.url ? (
        <Link href={content.url || "#"}>
          <Button
            asChild={!isExternal && !isAnchor && !!content.url}
            variant={content.variant || "default"}
            size={content.size || "default"}
          >
            {content.text || "Button"}
          </Button>
        </Link>
      ) : (
        <a
          href={content.url || "#"}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          <Button
            asChild={!isExternal && !isAnchor && !!content.url}
            variant={content.variant || "default"}
            size={content.size || "default"}
          >
            {content.text || "Button"}
          </Button>
        </a>
      )}
    </div>
  );
};

export default ButtonBlockRenderer;
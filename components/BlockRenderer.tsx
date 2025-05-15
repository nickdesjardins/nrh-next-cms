// app/components/BlockRenderer.tsx
import React from 'react';
import type { Block, ImageBlockContent, TextBlockContent, HeadingBlockContent, ButtonBlockContent } from "@/utils/supabase/types";
import { Button as UIButton } from '@/components/ui/button';
import Link from 'next/link'; // Import Link for button block

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

interface BlockRendererProps {
  blocks: Block[];
}

const BlockRenderer: React.FC<BlockRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <>
      {blocks.map((block) => {
        const content = block.content as any; 

        switch (block.block_type) {
          case "text":
            const textContent = content as TextBlockContent;
            return (
              <div
                key={block.id}
                className="my-4 prose dark:prose-invert max-w-none"
                dangerouslySetInnerHTML={{ __html: textContent.html_content || "" }}
              />
            );
          case "heading":
            const headingContent = content as HeadingBlockContent;
            // Ensure level is between 1 and 6, default to 2
            const level = typeof headingContent.level === 'number' && headingContent.level >= 1 && headingContent.level <= 6 ? headingContent.level : 2;
            const Tag: React.ElementType = `h${level}`;
            return (
              <Tag key={block.id} className="my-6 font-bold">
                {headingContent.text_content}
              </Tag>
            );
          case "image":
            const imageContent = content as ImageBlockContent; // Now expecting object_key
            if (!imageContent.media_id || !imageContent.object_key) { // Check for object_key
              return <div key={block.id} className="my-4 p-4 border rounded text-center text-muted-foreground italic">(Image block: Media not selected or object_key missing)</div>;
            }
            const displayImageUrl = `${R2_BASE_URL}/${imageContent.object_key}`;
            return (
              <figure key={block.id} className="my-6 text-center">
                <img
                  src={displayImageUrl}
                  alt={imageContent.alt_text || "Uploaded image"}
                  className="max-w-full h-auto rounded-md border mx-auto"
                  loading="lazy"
                />
                {imageContent.caption && (
                  <figcaption className="text-sm text-muted-foreground mt-2">
                    {imageContent.caption}
                  </figcaption>
                )}
              </figure>
            );
          case "button":
            const buttonContent = content as ButtonBlockContent;
            const isExternal = buttonContent.url?.startsWith('http') || buttonContent.url?.startsWith('mailto:') || buttonContent.url?.startsWith('tel:');
            const isAnchor = buttonContent.url?.startsWith('#');

            return (
              <div key={block.id} className="my-6 text-center">
                <UIButton
                  asChild={!isExternal && !isAnchor && !!buttonContent.url} // Use NextLink for internal paths
                  variant={buttonContent.variant || "default"}
                  size={buttonContent.size || "default"}
                >
                  {(!isExternal && !isAnchor && !!buttonContent.url) ? (
                    <Link href={buttonContent.url || "#"}>{buttonContent.text || "Button"}</Link>
                  ) : (
                    <a 
                      href={buttonContent.url || "#"} 
                      target={isExternal ? '_blank' : undefined} 
                      rel={isExternal ? 'noopener noreferrer' : undefined}
                    >
                      {buttonContent.text || "Button"}
                    </a>
                  )}
                </UIButton>
              </div>
            );
          default:
            return (
              <div key={block.id} className="my-4 p-4 border rounded bg-destructive/10 text-destructive">
                <p><strong>Unsupported block type:</strong> {block.block_type}</p>
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(content, null, 2)}</pre>
              </div>
            );
        }
      })}
    </>
  );
};

export default BlockRenderer;

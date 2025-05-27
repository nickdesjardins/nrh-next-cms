import React from "react";
import PostsGridBlock from "@/components/blocks/PostsGridBlock";
import type { PostsGridBlockContent, Block } from "@/utils/supabase/types";

interface PostsGridBlockRendererProps {
  content: PostsGridBlockContent;
  languageId: number;
  block: Block;
}

const PostsGridBlockRenderer: React.FC<PostsGridBlockRendererProps> = ({
  content,
  languageId,
  block,
}) => {
  return (
    <PostsGridBlock
      block={block}
      languageId={languageId}
    />
  );
};

export default PostsGridBlockRenderer;
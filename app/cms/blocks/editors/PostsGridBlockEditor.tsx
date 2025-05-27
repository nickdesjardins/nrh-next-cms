// app/cms/blocks/editors/PostsGridBlockEditor.tsx
import React from 'react';
import type { Block } from '@/utils/supabase/types';

interface PostsGridBlockEditorProps {
  block: Block;
}

const PostsGridBlockEditor: React.FC<PostsGridBlockEditorProps> = ({ block }) => {
  const { title, postsPerPage, columns, showPagination } = block.content as { title: string, postsPerPage: number, columns: number, showPagination: boolean };

  return (
    <div>
      <h4>Posts Grid Block</h4>
      <p>
        Displays a grid of posts.
      </p>
      <p>
        <strong>Title:</strong> {title || "Not set"} <br />
        <strong>Posts per page:</strong> {postsPerPage} <br />
        <strong>Columns:</strong> {columns} <br />
        <strong>Show Pagination:</strong> {showPagination ? 'Yes' : 'No'}
      </p>
      <p className="text-xs text-muted-foreground">
        (Frontend rendering and further configuration options will be implemented in subsequent steps.)
      </p>
    </div>
  );
};

export default PostsGridBlockEditor;
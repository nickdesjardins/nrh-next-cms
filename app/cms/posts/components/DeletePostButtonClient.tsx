// app/cms/posts/components/DeletePostButtonClient.tsx
"use client";

import React from 'react';
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";
import type { Post } from "@/utils/supabase/types"; // Assuming Post type is relevant, or just use postId
import { deletePost } from "../actions"; // Import the server action

interface DeletePostButtonClientProps {
  postId: number;
  postTitle: string; // For the confirmation message
}

export default function DeletePostButtonClient({ postId, postTitle }: DeletePostButtonClientProps) {
  // Bind the postId directly to the deletePost server action.
  const deletePostActionWithId = deletePost.bind(null, postId);

  const handleSelect = (event: Event) => {
    event.preventDefault(); // Prevent DropdownMenu from closing before confirm
    if (confirm(`Are you sure you want to delete the post "${postTitle}"? This action cannot be undone.`)) {
      // Find the form and submit it.
      const form = (event.currentTarget as HTMLElement)?.closest('form');
      if (form) {
        form.requestSubmit();
      } else {
        console.error("Form not found for delete post button.");
      }
    }
  };

  return (
    <form action={deletePostActionWithId} className="w-full">
      <button type="submit" className="w-full text-left">
        <DropdownMenuItem
          className="text-red-600 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-700/20 cursor-pointer"
          onSelect={handleSelect} // Now handleSelect is defined in a Client Component
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </button>
    </form>
  );
}
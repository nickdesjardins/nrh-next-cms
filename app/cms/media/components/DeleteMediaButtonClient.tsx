// app/cms/media/components/DeleteMediaButtonClient.tsx
"use client";

import React from 'react';
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";
import type { Media } from "@/utils/supabase/types";
import { deleteMediaItem } from "../actions"; // Import the server action

interface DeleteMediaButtonClientProps {
  mediaItem: Media;
  // You can add other props like onAfterDelete if needed
}

export default function DeleteMediaButtonClient({ mediaItem }: DeleteMediaButtonClientProps) {
  const deleteActionWithId = deleteMediaItem.bind(null, mediaItem.id, mediaItem.object_key);

  const handleSelect = (event: Event) => {
    event.preventDefault(); // Prevent DropdownMenu from closing before confirm
    if (confirm(`Are you sure you want to delete "${mediaItem.file_name}"? This will remove it from storage.`)) {
      // Find the form and submit it.
      // This assumes the button is a direct child of the form.
      // A more robust way might be to use a ref if the structure is complex,
      // or to call the server action directly using startTransition.
      const form = (event.currentTarget as HTMLElement)?.closest('form');
      if (form) {
        form.requestSubmit();
      } else {
        // Fallback or error if form not found, though with current structure it should be found.
        // For a more robust solution if form submission becomes tricky,
        // you could use useTransition here and call the server action directly:
        // startTransition(async () => {
        //   await deleteActionWithId(new FormData()); // Pass empty FormData if action doesn't use it
        // });
        console.error("Form not found for delete button.");
      }
    }
  };

  return (
    <form action={deleteActionWithId} className="w-full">
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
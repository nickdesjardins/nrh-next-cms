// app/cms/pages/components/DeletePageButtonClient.tsx
"use client";

import React from 'react';
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Trash2 } from "lucide-react";
import { deletePage } from "../actions"; // Server action

interface DeletePageButtonClientProps {
  pageId: number;
  pageTitle: string; // For the confirmation message
}

export default function DeletePageButtonClient({ pageId, pageTitle }: DeletePageButtonClientProps) {
  // Bind the pageId directly to the deletePage server action.
  const deletePageActionWithId = deletePage.bind(null, pageId);

  const handleSelect = (event: Event) => {
    event.preventDefault(); // Prevent DropdownMenu from closing before confirm
    if (confirm(`Are you sure you want to delete the page "${pageTitle}"? This action cannot be undone.`)) {
      // Find the form and submit it.
      const form = (event.currentTarget as HTMLElement)?.closest('form');
      if (form) {
        form.requestSubmit();
      } else {
        console.error("Form not found for delete page button.");
      }
    }
  };

  return (
    <form action={deletePageActionWithId} className="w-full">
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
// app/cms/media/page.tsx
import React from 'react';
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle, Image as ImageIcon, Trash2, Edit3, MoreHorizontal, FileText } from "lucide-react"; // Added FileText
import type { Media } from "@/utils/supabase/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator, // Added Separator
} from "@/components/ui/dropdown-menu";
import { deleteMediaItem } from "./actions";
import MediaUploadForm from "./components/MediaUploadForm";

// Client component for delete button with confirmation
function DeleteMediaButton({ mediaItem }: { mediaItem: Media }) {
  // Fix: action must be a function accepting FormData
  const deleteActionWithId = async (formData: FormData) => {
    await deleteMediaItem(mediaItem.id, mediaItem.object_key);
  };
  return (
    <form action={deleteActionWithId} className="w-full">
      <button type="submit" className="w-full text-left">
        <DropdownMenuItem
          className="text-red-600 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-700/20"
          onSelect={(e) => {
            e.preventDefault();
            if (!confirm(`Are you sure you want to delete "${mediaItem.file_name}"? This will remove it from storage.`)) {
                return;
            }
            (e.currentTarget as HTMLButtonElement).form?.requestSubmit();
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </button>
    </form>
  );
}


async function getMediaItems(): Promise<Media[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("media")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching media items:", error);
    return [];
  }
  return data || [];
}

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

export default async function CmsMediaLibraryPage() {
  const mediaItems = await getMediaItems();

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">Media Library</h1>
      </div>

      <MediaUploadForm />

      {mediaItems.length === 0 ? (
        <div className="text-center py-10 border rounded-lg mt-6">
          <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">No media found</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload some files to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 mt-6">
          {mediaItems.map((item) => (
            <div key={item.id} className="group relative border rounded-lg overflow-hidden shadow-sm aspect-square bg-muted/20">
              {item.file_type?.startsWith("image/") ? (
                <img
                  src={`${R2_BASE_URL}/${item.object_key}`}
                  alt={item.description || item.file_name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://placehold.co/300x300/eee/ccc?text=Error`;
                    (e.target as HTMLImageElement).classList.add('p-4', 'object-contain'); // Add padding for placeholder
                  }}
                />
              ) : (
                <div className="h-full w-full bg-muted flex flex-col items-center justify-center p-2">
                  <FileText className="h-12 w-12 text-muted-foreground mb-2" /> {/* Changed to FileText */}
                  <p className="text-xs text-center text-muted-foreground truncate w-full" title={item.file_name}>
                    {item.file_name}
                  </p>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="text-xs text-white truncate pt-1" title={item.file_name}>{item.file_name}</div>
                <div className="self-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="secondary" size="icon" className="text-white bg-black/40 hover:bg-black/60 h-7 w-7 rounded-full">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                            <Link href={`/cms/media/${item.id}/edit`} className="flex items-center cursor-pointer">
                                <Edit3 className="mr-2 h-4 w-4" /> Edit Details
                            </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DeleteMediaButton mediaItem={item} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

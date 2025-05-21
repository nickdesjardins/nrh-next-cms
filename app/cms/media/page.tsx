// app/cms/media/page.tsx
import React from 'react';
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle, Image as ImageIconLucideHost, Trash2, Edit3, MoreHorizontal, FileText } from "lucide-react";
import type { Media } from "@/utils/supabase/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem, // Keep this if other items use it, but DeleteMediaButtonClient will provide its own
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
// The deleteMediaItem server action is now called by DeleteMediaButtonClient
// import { deleteMediaItem } from "./actions"; // No longer directly used here for the button itself
import MediaUploadForm from "./components/MediaUploadForm";
import MediaImage from "./components/MediaImage";
import DeleteMediaButtonClient from "./components/DeleteMediaButtonClient"; // Import the new client component

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
          <ImageIconLucideHost className="mx-auto h-12 w-12 text-muted-foreground" />
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
                <MediaImage
                  src={`${R2_BASE_URL}/${item.object_key}`}
                  alt={item.description || item.file_name}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div className="h-full w-full bg-muted flex flex-col items-center justify-center p-2">
                  <FileText className="h-12 w-12 text-muted-foreground mb-2" />
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
                        {/* Use the new Client Component here */}
                        <DeleteMediaButtonClient mediaItem={item} />
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
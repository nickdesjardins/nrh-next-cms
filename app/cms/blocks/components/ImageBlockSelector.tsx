// app/cms/blocks/components/ImageBlockSelector.tsx
"use client";

import React, { useState, useEffect, useTransition } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ImageBlockContent, Media } from "@/utils/supabase/types";
import { createClient as createBrowserClient } from '@/utils/supabase/client';
import { ImageIcon, CheckCircle, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'; // Assuming shadcn/ui Dialog

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

interface ImageBlockSelectorProps {
  content: Partial<ImageBlockContent>; // content.media_id is the UUID string
  onChange: (newContent: ImageBlockContent) => void;
}

export default function ImageBlockSelector({ content, onChange }: ImageBlockSelectorProps) {
  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [mediaLibrary, setMediaLibrary] = useState<Media[]>([]);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();

  const supabase = createBrowserClient();

  // Fetch the currently selected media item details if media_id exists
  useEffect(() => {
    if (content.media_id) {
      const fetchMediaDetails = async () => {
        setIsLoadingMedia(true);
        const { data, error } = await supabase
          .from('media')
          .select('*')
          .eq('id', content.media_id!)
          .single();
        if (data) setSelectedMedia(data);
        else console.error("Error fetching selected media:", error);
        setIsLoadingMedia(false);
      };
      fetchMediaDetails();
    } else {
      setSelectedMedia(null);
    }
  }, [content.media_id, supabase]);

  // Fetch media library items when modal opens (or on search)
  useEffect(() => {
    if (isModalOpen) {
      const fetchLibrary = async () => {
        setIsLoadingMedia(true);
        let query = supabase.from('media').select('*').order('created_at', { ascending: false }).limit(20); // Add pagination later
        if (searchTerm) {
          query = query.ilike('file_name', `%${searchTerm}%`); // Simple search by filename
        }
        const { data, error } = await query;
        if (data) setMediaLibrary(data);
        else console.error("Error fetching media library:", error);
        setIsLoadingMedia(false);
      };
      fetchLibrary();
    }
  }, [isModalOpen, searchTerm, supabase]);


  const handleSelectMediaFromLibrary = (mediaItem: Media) => {
    setSelectedMedia(mediaItem);
    onChange({
      ...content,
      media_id: mediaItem.id,
      alt_text: content.alt_text || mediaItem.description || mediaItem.file_name, // Default alt text
      // caption: content.caption || "", // Keep existing caption or clear
    } as ImageBlockContent);
    setIsModalOpen(false);
  };

  const handleAltTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...content, media_id: selectedMedia?.id || null, alt_text: event.target.value } as ImageBlockContent);
  };

  const handleCaptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...content, media_id: selectedMedia?.id || null, caption: event.target.value } as ImageBlockContent);
  };

  const handleRemoveImage = () => {
    setSelectedMedia(null);
    onChange({ media_id: null, alt_text: "", caption: "" });
  };

  return (
    <div className="space-y-3 p-3 border-t mt-2">
      <Label>Image</Label>
      <div className="mt-1 p-3 border rounded-md bg-muted/30 min-h-[120px] flex flex-col items-center justify-center">
        {isLoadingMedia && !selectedMedia && <p>Loading image...</p>}
        {selectedMedia && selectedMedia.file_type?.startsWith("image/") ? (
          <div className="relative group w-full max-w-xs mx-auto">
            <img
              src={`${R2_BASE_URL}/${selectedMedia.object_key}`}
              alt={selectedMedia.description || selectedMedia.file_name}
              className="rounded-md object-contain max-h-40"
            />
             <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                onClick={handleRemoveImage}
                title="Remove Image"
            >
                <X className="h-3 w-3" />
            </Button>
          </div>
        ) : content.media_id && !selectedMedia && !isLoadingMedia ? (
           <p className="text-sm text-red-500">Could not load selected image (ID: {content.media_id}).</p>
        ) : (
          <ImageIcon className="h-16 w-16 text-muted-foreground" />
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="mt-3">
              {selectedMedia ? "Change Image" : "Select from Library"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] md:max-w-[800px] lg:max-w-[1000px] max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Media Library</DialogTitle>
            </DialogHeader>
            <div className="relative mb-4">
                <Input
                    type="search"
                    placeholder="Search media by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
            </div>
            {isLoadingMedia ? (
              <div className="flex-grow flex items-center justify-center"><p>Loading media...</p></div>
            ) : mediaLibrary.length === 0 ? (
              <div className="flex-grow flex items-center justify-center"><p>No media found matching your search.</p></div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 overflow-y-auto flex-grow pr-2">
                {mediaLibrary.map((media) => (
                  <button
                    key={media.id}
                    type="button"
                    className="relative aspect-square border rounded-md overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                    onClick={() => handleSelectMediaFromLibrary(media)}
                  >
                    {media.file_type?.startsWith("image/") ? (
                      <img
                        src={`${R2_BASE_URL}/${media.object_key}`}
                        alt={media.description || media.file_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full bg-muted flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-white" />
                    </div>
                    <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate text-center">
                        {media.file_name}
                    </p>
                  </button>
                ))}
              </div>
            )}
            <DialogFooter className="mt-4">
                {/* TODO: Add MediaUploadForm here directly or as a tab */}
                <p className="text-sm text-muted-foreground mr-auto">Upload new media on the main Media Library page.</p>
                <DialogClose asChild>
                    <Button type="button" variant="outline">Close</Button>
                </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <Label htmlFor={`image-alt-${Math.random()}`}>Alt Text (Accessibility)</Label>
        <Input
          id={`image-alt-${Math.random()}`}
          value={content.alt_text || ""}
          onChange={handleAltTextChange}
          placeholder="Descriptive alt text"
          className="mt-1"
          disabled={!selectedMedia}
        />
      </div>
      <div>
        <Label htmlFor={`image-caption-${Math.random()}`}>Caption (Optional)</Label>
        <Input
          id={`image-caption-${Math.random()}`}
          value={content.caption || ""}
          onChange={handleCaptionChange}
          placeholder="Optional image caption"
          className="mt-1"
          disabled={!selectedMedia}
        />
      </div>
    </div>
  );
}
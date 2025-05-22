// app/cms/blocks/components/ImageBlockSelector.tsx
"use client";

import React, { useState, useEffect } from 'react'; // Removed useTransition as it's not used here
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ImageBlockContent, Media } from "@/utils/supabase/types";
import { createClient as createBrowserClient } from '@/utils/supabase/client';
import { ImageIcon, CheckCircle, Search, X as XIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import MediaUploadForm from '@/app/cms/media/components/MediaUploadForm'; // Import the upload form
import { Separator } from '@/components/ui/separator'; // For visual separation

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

interface ImageBlockSelectorProps {
  content: Partial<ImageBlockContent>;
  onChange: (newContent: ImageBlockContent) => void;
}

export default function ImageBlockSelector({ content, onChange }: ImageBlockSelectorProps) {
  const [selectedMediaObjectKey, setSelectedMediaObjectKey] = useState<string | null | undefined>(content.object_key);
  const [isLoadingMediaDetails, setIsLoadingMediaDetails] = useState(false); // For fetching details if only ID is present

  const [mediaLibrary, setMediaLibrary] = useState<Media[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [supabase] = useState(() => createBrowserClient());

  // Effect to fetch media details (like object_key) if only media_id is present in content
  useEffect(() => {
    if (content.media_id && !content.object_key) {
      setIsLoadingMediaDetails(true);
      const fetchMediaDetails = async () => {
        const { data, error } = await supabase
          .from('media')
          .select('id, object_key, description, file_name') // Fetch needed fields
          .eq('id', content.media_id!)
          .single();
        if (data) {
          onChange({ // Update the parent form's content state
            media_id: data.id,
            object_key: data.object_key,
            alt_text: content.alt_text || data.description || data.file_name,
            caption: content.caption || "",
          });
          setSelectedMediaObjectKey(data.object_key);
        } else {
          console.error("Error fetching selected media details:", error);
          // Handle case where media_id is invalid or item deleted
          onChange({ media_id: content.media_id ?? null, object_key: null, alt_text: "Error: Media not found", caption: "" });
        }
        setIsLoadingMediaDetails(false);
      };
      fetchMediaDetails();
    } else if (content.object_key) {
        setSelectedMediaObjectKey(content.object_key);
    } else {
        setSelectedMediaObjectKey(null);
    }
  }, [content.media_id, content.object_key, supabase, onChange]);


  useEffect(() => {
    if (isModalOpen) {
      const fetchLibrary = async () => {
        setIsLoadingLibrary(true);
        let query = supabase.from('media').select('*').order('created_at', { ascending: false }).limit(20);
        if (searchTerm) {
          query = query.ilike('file_name', `%${searchTerm}%`);
        }
        const { data, error } = await query;
        if (data) setMediaLibrary(data);
        else console.error("Error fetching media library:", error);
        setIsLoadingLibrary(false);
      };
      fetchLibrary();
    }
  }, [isModalOpen, searchTerm, supabase]);

  const handleSelectMediaFromLibrary = (mediaItem: Media) => {
    setSelectedMediaObjectKey(mediaItem.object_key);
    onChange({
      media_id: mediaItem.id,
      object_key: mediaItem.object_key, // Store the object_key
      alt_text: content.alt_text || mediaItem.description || mediaItem.file_name,
      caption: content.caption || "",
    });
    setIsModalOpen(false);
  };

  const handleAltTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...content, media_id: content.media_id || null, object_key: selectedMediaObjectKey, alt_text: event.target.value });
  };

  const handleCaptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...content, media_id: content.media_id || null, object_key: selectedMediaObjectKey, caption: event.target.value });
  };

  const handleRemoveImage = () => {
    setSelectedMediaObjectKey(null);
    onChange({ media_id: null, object_key: null, alt_text: "", caption: "" });
  };

  const displayObjectKey = content.object_key || selectedMediaObjectKey;

  return (
    <div className="space-y-3 p-3 border-t mt-2">
      <Label>Image</Label>
      <div className="mt-1 p-3 border rounded-md bg-muted/30 min-h-[120px] flex flex-col items-center justify-center">
        {isLoadingMediaDetails && <p>Loading image details...</p>}
        {!isLoadingMediaDetails && displayObjectKey ? (
          <div className="relative group w-full max-w-xs mx-auto">
            <img
              src={`${R2_BASE_URL}/${displayObjectKey}`}
              alt={content.alt_text || "Selected image"}
              className="rounded-md object-contain max-h-40"
            />
            <Button
              type="button" variant="destructive" size="icon"
              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
              onClick={handleRemoveImage} title="Remove Image"
            > <XIcon className="h-3 w-3" /> </Button>
          </div>
        ) : !isLoadingMediaDetails && content.media_id ? (
            <p className="text-sm text-red-500">Image details (object_key) missing for Media ID: {content.media_id}. Try re-selecting.</p>
        ) : (
          <ImageIcon className="h-16 w-16 text-muted-foreground" />
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="mt-3">
              {displayObjectKey ? "Change Image" : "Select from Library"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] md:max-w-[800px] lg:max-w-[1000px] max-h-[90vh] flex flex-col">
            <DialogHeader><DialogTitle>Select or Upload Image</DialogTitle></DialogHeader>
            
            {/* Upload Form Section */}
            <div className="p-1"> {/* Reduced padding for the form wrapper */}
              <MediaUploadForm
                returnJustData={true}
                onUploadSuccess={(newMedia) => {
                  // Add to local library for immediate visibility (optional, but good UX)
                  setMediaLibrary(prev => [newMedia, ...prev.filter(m => m.id !== newMedia.id)]);
                  // Select the newly uploaded media for the block
                  handleSelectMediaFromLibrary(newMedia);
                  // The modal will be closed by handleSelectMediaFromLibrary
                }}
              />
            </div>

            <Separator className="my-4" />

            {/* Media Library Section */}
            <div className="flex flex-col flex-grow overflow-hidden">
              <h3 className="text-lg font-medium mb-3 text-center">Or Select from Library</h3>
              <div className="relative mb-2">
                  <Input type="search" placeholder="Search library..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              </div>
              {isLoadingLibrary ? <div className="flex-grow flex items-center justify-center"><p>Loading media...</p></div>
              : mediaLibrary.length === 0 ? <div className="flex-grow flex items-center justify-center"><p>No media found in library.</p></div>
              : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 overflow-y-auto flex-grow pr-2 pb-2">
                  {mediaLibrary.filter(m => m.file_type?.startsWith("image/")).map((media) => (
                    <button key={media.id} type="button"
                      className="relative aspect-square border rounded-md overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary"
                      onClick={() => handleSelectMediaFromLibrary(media)} >
                      <img src={`${R2_BASE_URL}/${media.object_key}`} alt={media.description || media.file_name} className="h-full w-full object-cover"/>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
                        <CheckCircle className="h-8 w-8 text-white" /></div>
                      <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate text-center">{media.file_name}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter className="mt-auto pt-4"> {/* Ensure footer is at the bottom */}
                <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div>
        <Label htmlFor={`image-alt-${content.media_id || 'new'}`}>Alt Text</Label>
        <Input id={`image-alt-${content.media_id || 'new'}`} value={content.alt_text || ""} onChange={handleAltTextChange} className="mt-1" disabled={!displayObjectKey} />
      </div>
      <div>
        <Label htmlFor={`image-caption-${content.media_id || 'new'}`}>Caption</Label>
        <Input id={`image-caption-${content.media_id || 'new'}`} value={content.caption || ""} onChange={handleCaptionChange} className="mt-1" disabled={!displayObjectKey} />
      </div>
    </div>
  );
}

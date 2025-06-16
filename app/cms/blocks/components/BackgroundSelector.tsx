// app/cms/blocks/components/BackgroundSelector.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from "@/components/ui/input";
import { Separator } from '@/components/ui/separator';
import { Checkbox } from "@/components/ui/checkbox";
import { ImageIcon, CheckCircle, Search, X as XIcon } from 'lucide-react';
import { createClient as createBrowserClient } from '@/utils/supabase/client';
import type { SectionBlockContent } from '@/lib/blocks/blockRegistry';
import type { Media } from '@/utils/supabase/types';
import MediaUploadForm from '@/app/cms/media/components/MediaUploadForm';

const R2_BASE_URL = process.env.NEXT_PUBLIC_R2_BASE_URL || "";

interface BackgroundSelectorProps {
  background: SectionBlockContent['background'];
  onChange: (newBackground: SectionBlockContent['background']) => void;
}

export default function BackgroundSelector({ background, onChange }: BackgroundSelectorProps) {
  const [mediaLibrary, setMediaLibrary] = useState<Media[]>([]);
  const [isLoadingLibrary, setIsLoadingLibrary] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const supabase = createBrowserClient();

  const backgroundType = background?.type || 'none';
  const selectedImage = background?.type === 'image' ? background.image : undefined;

  const fetchLibrary = useCallback(async () => {
    setIsLoadingLibrary(true);
    let query = supabase
      .from('media')
      .select('*, width, height, blur_data_url')
      .order('created_at', { ascending: false })
      .limit(50);

    if (searchTerm) {
      query = query.ilike('file_name', `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (data) {
      setMediaLibrary(data as Media[]);
    } else if (error) {
      console.error("Error fetching media library:", error);
    }
    setIsLoadingLibrary(false);
  }, [supabase, searchTerm]);

  useEffect(() => {
    if (isModalOpen) {
      fetchLibrary();
    }
  }, [isModalOpen, fetchLibrary]);

  const handleTypeChange = (type: SectionBlockContent['background']['type']) => {
    if (type === 'image') {
      onChange({
        type: 'image',
        image: {
          media_id: '',
          object_key: '',
          size: 'cover',
          position: 'center',
          overlay: undefined,
        }
      });
    } else if (type === 'gradient') {
      onChange({
        type: 'gradient',
        gradient: {
          type: 'linear',
          direction: 'to right',
          stops: [
            { color: '#3b82f6', position: 0 },
            { color: '#8b5cf6', position: 100 },
          ],
        },
      });
    } else {
      onChange({ type });
    }
  };

  const handleSelectMediaFromLibrary = (mediaItem: Media) => {
    onChange({
      type: 'image',
      image: {
        ...selectedImage,
        media_id: mediaItem.id,
        object_key: mediaItem.object_key,
        width: mediaItem.width ?? undefined,
        height: mediaItem.height ?? undefined,
        size: selectedImage?.size || 'cover',
        position: selectedImage?.position || 'center',
      },
    });
    setIsModalOpen(false);
  };
  
  const handleUploadSuccess = (newMedia: Media) => {
    setMediaLibrary(prev => [newMedia, ...prev.filter(m => m.id !== newMedia.id)]);
    handleSelectMediaFromLibrary(newMedia);
  };

  const handleRemoveImage = () => {
    onChange({
      type: 'image',
      image: {
        media_id: '',
        object_key: '',
        size: 'cover',
        position: 'center',
        overlay: undefined,
      }
    });
  };

  const handleImagePropertyChange = (prop: 'size' | 'position', value: string) => {
    if (background?.type === 'image' && background.image) {
      onChange({
        ...background,
        image: {
          ...background.image,
          [prop]: value,
        },
      });
    }
  };

  const handleOverlayToggle = (checked: boolean) => {
    if (background?.type === 'image' && background.image) {
      const newOverlay = checked
        ? {
            type: 'gradient' as const,
            gradient: {
              type: 'linear' as const,
              direction: 'to bottom',
              stops: [
                { color: 'rgba(0,0,0,0.5)', position: 0 },
                { color: 'rgba(0,0,0,0)', position: 100 },
              ],
            },
          }
        : undefined;

      onChange({
        ...background,
        image: {
          ...background.image,
          overlay: newOverlay,
        },
      });
    }
  };

  const handleBackgroundPropertyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onChange({
      ...background,
      [name]: value,
    });
  };

  const handleOverlayGradientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (background?.type === 'image' && background.image) {
      const { image } = background;
      const overlay = image.overlay;

      const currentGradient = overlay?.gradient || {
        type: 'linear' as const,
        direction: 'to bottom',
        stops: [
          { color: 'rgba(0,0,0,0.5)', position: 0 },
          { color: 'rgba(0,0,0,0)', position: 100 },
        ],
      };
      
      const updatedStops = currentGradient.stops.map(stop => {
        if (name === 'startColor' && stop.position === 0) {
          return { ...stop, color: value };
        }
        if (name === 'endColor' && stop.position === 100) {
          return { ...stop, color: value };
        }
        return stop;
      });

      const newGradient = {
        ...currentGradient,
        direction: name === 'direction' ? value : currentGradient.direction,
        stops: updatedStops,
      };

      onChange({
        ...background,
        image: {
          ...image,
          overlay: {
            type: 'gradient',
            gradient: newGradient,
          },
        },
      });
    }
  };

  const handleGradientChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    const currentGradient = background?.gradient || {
      type: 'linear',
      direction: 'to right',
      stops: [
        { color: '#3b82f6', position: 0 },
        { color: '#8b5cf6', position: 100 },
      ],
    };

    const updatedStops = currentGradient.stops.map(stop => {
      if (name === 'startColor' && stop.position === 0) {
        return { ...stop, color: value };
      }
      if (name === 'endColor' && stop.position === 100) {
        return { ...stop, color: value };
      }
      return stop;
    });

    const newGradient = {
      ...currentGradient,
      direction: name === 'direction' ? value : currentGradient.direction,
      stops: updatedStops,
    };

    onChange({
      ...background,
      type: 'gradient',
      gradient: newGradient,
    });
  };

  return (
    <div className="space-y-3">
      <Label>Background Type</Label>
      <Select value={backgroundType} onValueChange={handleTypeChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a background type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          <SelectItem value="theme">Theme Color</SelectItem>
          <SelectItem value="solid">Solid Color</SelectItem>
          <SelectItem value="gradient">Gradient</SelectItem>
          <SelectItem value="image">Image</SelectItem>
        </SelectContent>
      </Select>

      {backgroundType !== 'none' && (
        <div className="mt-3">
          <Label htmlFor="min_height_input">Minimum Height</Label>
          <Input
            id="min_height_input"
            name="min_height"
            value={background?.min_height || ''}
            onChange={handleBackgroundPropertyChange}
            placeholder="e.g., 400px, 50vh"
          />
        </div>
      )}

      {backgroundType === 'image' && (
        <>
          <div className="mt-3 p-3 border rounded-md bg-muted/30 min-h-[120px] flex flex-col items-center justify-center">
            {selectedImage?.object_key ? (
              <div className="relative group w-full">
                <Image
                  src={`${R2_BASE_URL}/${selectedImage.object_key}`}
                  alt="Selected background image"
                  width={selectedImage.width || 500}
                  height={selectedImage.height || 300}
                  sizes="100vw"
                  className="w-full h-auto object-contain rounded-md"
                />
                <Button
                  type="button" variant="destructive" size="icon"
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                  onClick={handleRemoveImage} title="Remove Image"
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <ImageIcon className="h-16 w-16 text-muted-foreground" />
            )}

            <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="mt-3">
                  {selectedImage?.object_key ? "Change Image" : "Select from Library"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[650px] md:max-w-[800px] lg:max-w-[1000px] max-h-[90vh] flex flex-col">
                <DialogHeader><DialogTitle>Select or Upload Background Image</DialogTitle></DialogHeader>
                
                <div className="p-1">
                  <MediaUploadForm
                    returnJustData={true}
                    onUploadSuccess={handleUploadSuccess}
                  />
                </div>

                <Separator className="my-4" />

                <div className="flex flex-col flex-grow overflow-hidden">
                  <h3 className="text-lg font-medium mb-3 text-center">Or Select from Library</h3>
                  <div className="relative mb-2">
                    <Input type="search" placeholder="Search library..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  </div>
                  {isLoadingLibrary ? (
                    <div className="flex-grow flex items-center justify-center"><p>Loading media...</p></div>
                  ) : mediaLibrary.length === 0 ? (
                    <div className="flex-grow flex items-center justify-center"><p>No media found.</p></div>
                  ) : (
                    <div className="flex flex-wrap gap-3 overflow-y-auto min-h-0 pr-2 pb-2">
                      {mediaLibrary.filter(m => m.file_type?.startsWith("image/")).map((media) => (
                        <button key={media.id} type="button"
                          className="relative aspect-square border rounded-md overflow-hidden group focus:outline-none focus:ring-2 focus:ring-primary min-w-0 w-1/3 sm:w-1/4 md:w-1/5 lg:w-1/6"
                          onClick={() => handleSelectMediaFromLibrary(media)}
                        >
                          <Image
                            src={`${R2_BASE_URL}/${media.object_key}`}
                            alt={media.description || media.file_name || "Media library image"}
                            width={media.width || 150}
                            height={media.height || 150}
                            className="absolute inset-0 w-full h-full object-cover"
                            placeholder={media.blur_data_url ? "blur" : "empty"}
                            blurDataURL={media.blur_data_url || undefined}
                            sizes="(max-width: 639px) 33vw, (max-width: 767px) 25vw, (max-width: 1023px) 20vw, 17vw"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center">
                            <CheckCircle className="h-8 w-8 text-white" />
                          </div>
                          <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-1 truncate text-center">{media.file_name}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter className="mt-auto pt-4">
                  <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
              <div>
                <Label>Image Size</Label>
                <Select
                  value={selectedImage?.size || 'cover'}
                  onValueChange={(value) => handleImagePropertyChange('size', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cover">Cover</SelectItem>
                    <SelectItem value="contain">Contain</SelectItem>
                    <SelectItem value="auto">Auto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Image Position</Label>
                <Select
                  value={selectedImage?.position || 'center'}
                  onValueChange={(value) => handleImagePropertyChange('position', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="top">Top</SelectItem>
                    <SelectItem value="bottom">Bottom</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>
          </div>

          <Separator className="my-4" />

          <div className="items-top flex space-x-2 mt-3">
              <Checkbox
                id="gradientOverlay"
                checked={!!selectedImage?.overlay}
                onCheckedChange={handleOverlayToggle}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="gradientOverlay"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Add Gradient Overlay
                </label>
              </div>
          </div>

          {selectedImage?.overlay && (
            <div className="mt-3 p-3 border rounded-md bg-muted/30 space-y-4">
              <div>
                <Label htmlFor="overlayGradientDirection">Direction</Label>
                <Input
                  id="overlayGradientDirection"
                  name="direction"
                  value={selectedImage.overlay.gradient?.direction || 'to bottom'}
                  onChange={handleOverlayGradientChange}
                  placeholder="e.g., to top left, 45deg, at circle"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="overlayGradientStartColor">Start Color</Label>
                  <Input
                    id="overlayGradientStartColor"
                    type="text"
                    name="startColor"
                    value={selectedImage.overlay.gradient?.stops?.[0]?.color || 'rgba(0,0,0,0.5)'}
                    onChange={handleOverlayGradientChange}
                    className="p-1 h-10"
                  />
                </div>
                <div className="flex-1">
                  <Label htmlFor="overlayGradientEndColor">End Color</Label>
                  <Input
                    id="overlayGradientEndColor"
                    type="text"
                    name="endColor"
                    value={selectedImage.overlay.gradient?.stops?.[1]?.color || 'rgba(0,0,0,0)'}
                    onChange={handleOverlayGradientChange}
                    className="p-1 h-10"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {backgroundType === 'gradient' && (
        <div className="mt-3 p-3 border rounded-md bg-muted/30 space-y-4">
          <div>
            <Label htmlFor="gradientDirection">Direction</Label>
            <Input
              id="gradientDirection"
              name="direction"
              value={background.gradient?.direction || 'to right'}
              onChange={handleGradientChange}
              placeholder="e.g., to top left, 45deg, at circle"
            />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="gradientStartColor">Start Color</Label>
              <div className="relative">
                <Input
                  id="gradientStartColor"
                  type="color"
                  name="startColor"
                  value={background.gradient?.stops?.[0]?.color || '#3b82f6'}
                  onChange={handleGradientChange}
                  className="p-1 h-10"
                />
              </div>
            </div>
            <div className="flex-1">
              <Label htmlFor="gradientEndColor">End Color</Label>
              <div className="relative">
                <Input
                  id="gradientEndColor"
                  type="color"
                  name="endColor"
                  value={background.gradient?.stops?.[1]?.color || '#8b5cf6'}
                  onChange={handleGradientChange}
                  className="p-1 h-10"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
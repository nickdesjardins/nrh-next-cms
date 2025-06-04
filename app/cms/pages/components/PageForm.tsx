// app/cms/pages/components/PageForm.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { Page, PageStatus, Language } from "@/utils/supabase/types";
import { useAuth } from "@/context/AuthContext";
// Remove: import { getActiveLanguagesClientSide } from "@/utils/supabase/client";

interface PageFormProps {
  page?: Page | null;
  formAction: (formData: FormData) => Promise<{ error?: string } | void>;
  actionButtonText?: string;
  isEditing?: boolean;
  availableLanguagesProp: Language[]; // New prop
}

export default function PageForm({
  page,
  formAction,
  actionButtonText = "Save Page",
  isEditing = false,
  availableLanguagesProp, // Use the new prop
}: PageFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const { user, isLoading: authLoading } = useAuth();

  const [title, setTitle] = useState(page?.title || "");
  const [slug, setSlug] = useState(page?.slug || "");
  const [languageId, setLanguageId] = useState<string>(
    page?.language_id?.toString() || ""
  );
  const [status, setStatus] = useState<PageStatus>(page?.status || "draft");
  const [metaTitle, setMetaTitle] = useState(page?.meta_title || "");
  const [metaDescription, setMetaDescription] = useState(
    page?.meta_description || ""
  );

  // Use the passed-in languages
  const [availableLanguages, setAvailableLanguages] = useState<Language[]>(availableLanguagesProp);
  // languagesLoading is no longer needed if languages are passed as props
  // const [languagesLoading, setLanguagesLoading] = useState(true); // Remove or set to false initially

  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    const successMessage = searchParams.get('success');
    const errorMessage = searchParams.get('error');
    if (successMessage) {
      setFormMessage({ type: 'success', text: successMessage });
    } else if (errorMessage) {
      setFormMessage({ type: 'error', text: errorMessage });
    }
  }, [searchParams]);

  // Initialize languageId if creating new page and languages are available
  useEffect(() => {
    if (!page?.language_id && availableLanguages.length > 0 && !languageId) {
      const defaultLang = availableLanguages.find(l => l.is_default) || availableLanguages[0];
      if (defaultLang) {
          setLanguageId(defaultLang.id.toString());
      }
    }
  }, [page?.language_id, availableLanguages, languageId]);


  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    if (!isEditing || !slug) {
      setSlug(newTitle.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, ""));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormMessage(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await formAction(formData);
      if (result?.error) {
        setFormMessage({ type: 'error', text: result.error });
      }
    });
  };

  // Removed languagesLoading from this condition
  if (authLoading) {
    return <div>Loading form...</div>;
  }

  if (!user) {
    return <div>Please log in to manage pages.</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full mx-auto px-6">
      {/* ... (rest of the form remains the same, but `availableLanguages` is now populated by the prop) ... */}
      {formMessage && (
        <div
          className={`p-3 rounded-md text-sm ${
            formMessage.type === 'success'
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-red-100 text-red-700 border border-red-200'
          }`}
        >
          {formMessage.text}
        </div>
      )}
      <div>
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          value={title}
          onChange={handleTitleChange}
          required
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          className="mt-1"
        />
        <p className="text-xs text-muted-foreground mt-1">URL-friendly identifier. Auto-generated from title if left empty on creation.</p>
      </div>

      <div>
        <Label htmlFor="language_id">Language</Label>
        {availableLanguages.length > 0 ? (
          <Select
            name="language_id"
            value={languageId}
            onValueChange={setLanguageId}
            required
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select language" />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang.id} value={lang.id.toString()}>
                  {lang.name} ({lang.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="text-sm text-muted-foreground mt-1">No languages available. Please add languages in CMS settings.</p>
        )}
      </div>

      <div>
        <Label htmlFor="status">Status</Label>
        <Select
          name="status"
          value={status}
          onValueChange={(value) => setStatus(value as PageStatus)}
          required
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="meta_title">Meta Title (SEO)</Label>
        <Input
          id="meta_title"
          name="meta_title"
          value={metaTitle}
          onChange={(e) => setMetaTitle(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="meta_description">Meta Description (SEO)</Label>
        <Textarea
          id="meta_description"
          name="meta_description"
          value={metaDescription}
          onChange={(e) => setMetaDescription(e.target.value)}
          className="mt-1"
          rows={3}
        />
      </div>

      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/cms/pages")}
          disabled={isPending}
        >
          Cancel
        </Button>
        {/* Ensure button is not disabled due to removed languagesLoading */}
        <Button type="submit" disabled={isPending || authLoading || availableLanguages.length === 0}>
          {isPending ? "Saving..." : actionButtonText}
        </Button>
      </div>
    </form>
  );
}
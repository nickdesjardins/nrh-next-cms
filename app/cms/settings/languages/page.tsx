// app/cms/settings/languages/page.tsx
import React from 'react';
import { createClient } from "@/utils/supabase/server";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal, PlusCircle, Trash2, Edit3, Languages as LanguagesIcon, ShieldAlert } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { deleteLanguage } from "./actions";
import type { Language } from "@/utils/supabase/types";

// Client component for delete button with confirmation
function DeleteLanguageButton({ language }: { language: Language }) {
  // Fix: Use a form action that matches the expected signature
  const isDefaultAndOnly = language.is_default; // Simplified, server action has more robust check

  async function handleDeleteAction(formData: FormData) {
    // Call the server action and ignore the return value (redirect will happen on success)
    await deleteLanguage(language.id);
  }

  return (
    <form action={handleDeleteAction} className="w-full">
      <button type="submit" className="w-full text-left" disabled={isDefaultAndOnly}>
        <DropdownMenuItem
          className={`hover:!bg-red-50 dark:hover:!bg-red-700/20 ${isDefaultAndOnly ? 'text-muted-foreground cursor-not-allowed hover:!text-muted-foreground' : 'text-red-600 hover:!text-red-600'}`}
          onSelect={(e) => {
            e.preventDefault();
            if (isDefaultAndOnly) {
                alert("Cannot delete the default language. Set another language as default first.");
                return;
            }
            if (!confirm(`Are you sure you want to delete "${language.name}"? This will delete ALL content associated with this language.`)) {
                return;
            }
            (e.currentTarget as HTMLButtonElement).form?.requestSubmit();
          }}
          disabled={isDefaultAndOnly}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
          {isDefaultAndOnly && (
            <span title="Cannot delete default language">
              <ShieldAlert className="ml-auto h-4 w-4 text-amber-500" />
            </span>
          )}
        </DropdownMenuItem>
      </button>
    </form>
  );
}

async function getLanguages(): Promise<Language[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("languages")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching languages:", error);
    return [];
  }
  return data || [];
}

export default async function CmsLanguagesListPage() {
  const languages = await getLanguages();
  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const successMessage = searchParams.get('success'); // For displaying messages from redirects

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-semibold">Manage Languages</h1>
        <Link href="/cms/settings/languages/new">
          <Button variant="default">
            <PlusCircle className="mr-2 h-4 w-4" /> Add New Language
          </Button>
        </Link>
      </div>

       {successMessage && (
        <div className="mb-4 p-3 rounded-md text-sm bg-green-100 text-green-700 border border-green-200">
          {successMessage}
        </div>
      )}

      {languages.length === 0 ? (
        <div className="text-center py-10 border rounded-lg">
          <LanguagesIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">No languages configured</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Add languages to support multilingual content.
          </p>
          <div className="mt-6">
            <Link href="/cms/settings/languages/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Add Language
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Name</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Created At</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {languages.map((lang) => (
                <TableRow key={lang.id}>
                  <TableCell className="font-medium">{lang.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{lang.code}</Badge>
                  </TableCell>
                  <TableCell>
                    {lang.is_default ? (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white">Default</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(lang.created_at!).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Language actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/cms/settings/languages/${lang.id}/edit`} className="flex items-center cursor-pointer">
                            <Edit3 className="mr-2 h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DeleteLanguageButton language={lang} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="mt-6 p-4 border border-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-lg">
        <div className="flex items-start">
            <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
                <h4 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Important Note on Deleting Languages</h4>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                Deleting a language is a destructive action. All content (pages, posts, blocks, navigation items) specifically associated with that language will be permanently deleted due to database cascade rules. Please ensure this is intended before proceeding. You cannot delete the current default language.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}

// app/cms/pages/page.tsx
import React from "react";
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
import { MoreHorizontal, PlusCircle, Trash2, Edit3, FileText, Languages as LanguageIcon } from "lucide-react"; // Added LanguageIcon
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { deletePage } from "./actions";
import type { Page, Language } from "@/utils/supabase/types";
import { getActiveLanguagesServerSide } from "@/utils/supabase/server";
import LanguageFilterSelect from "@/app/cms/components/LanguageFilterSelect"; // We will create this

// DeletePageButton remains a form submitting to a server action
function DeletePageButton({ pageId, pageSlug }: { pageId: number, pageSlug: string }) {
  // Add pageSlug for revalidation if needed, though deletePage action should handle its own revalidation
  // Wrap deletePage to match the expected signature for form action
  const handleDelete = async (formData: FormData) => {
    await deletePage(pageId);
  };
  return (
    <form action={handleDelete} className="w-full">
      <button type="submit" className="w-full text-left">
        <DropdownMenuItem
          className="text-red-600 hover:!text-red-600 hover:!bg-red-50 dark:hover:!bg-red-700/20 cursor-pointer"
          onSelect={(e) => { // Use onSelect for better control with DropdownMenu
            e.preventDefault(); // Prevent default closing
            if (confirm(`Are you sure you want to delete this page? This action cannot be undone.`)) {
              (e.currentTarget as HTMLButtonElement).form?.requestSubmit();
            }
          }}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </button>
    </form>
  );
}

// Updated to accept a languageId filter
async function getPagesWithDetails(filterLanguageId?: number): Promise<{ page: Page; languageCode: string }[]> {
  const supabase = createClient();
  const languages = await getActiveLanguagesServerSide(); // Fetch all for mapping
  const langMap = new Map(languages.map(l => [l.id, l.code]));

  let query = supabase
    .from("pages")
    .select("*, languages!inner(code)") // Join to get language code directly
    .order("created_at", { ascending: false });

  if (filterLanguageId) {
    query = query.eq("language_id", filterLanguageId);
  }

  const { data: pagesData, error } = await query;

  if (error) {
    console.error("Error fetching pages:", error);
    return [];
  }
  if (!pagesData) return [];

  return pagesData.map(p => {
    // Ensure 'languages' field from join is correctly accessed
    const langInfo = p.languages as unknown as { code: string } | null; // Type assertion based on join
    return {
      page: p as Page, // Cast to Page after processing join
      languageCode: langInfo?.code?.toUpperCase() || langMap.get(p.language_id)?.toUpperCase() || 'N/A',
    };
  });
}

interface CmsPagesListPageProps {
  searchParams?: Promise<{
    lang?: string; // Language ID as a string from query param
    success?: string; // For success messages
  }>;
}

export default async function CmsPagesListPage(props: CmsPagesListPageProps) {
  const searchParams = await props.searchParams;
  const allLanguages = await getActiveLanguagesServerSide();
  const selectedLangId = searchParams?.lang ? parseInt(searchParams.lang, 10) : undefined;

  // Validate selectedLangId if it exists
  const isValidLangId = selectedLangId ? allLanguages.some(l => l.id === selectedLangId) : true;
  const filterLangId = isValidLangId ? selectedLangId : undefined;

  const pagesWithDetails = await getPagesWithDetails(filterLangId);
  const successMessage = searchParams?.success;

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h1 className="text-2xl font-semibold">Manage Pages</h1>
        <div className="flex items-center gap-3">
          <LanguageFilterSelect
            allLanguages={allLanguages}
            currentFilterLangId={filterLangId}
            basePath="/cms/pages" // Path for constructing filter URLs
          />
          <Link href="/cms/pages/new">
            <Button variant="default">
              <PlusCircle className="mr-2 h-4 w-4" /> Create New Page
            </Button>
          </Link>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-3 rounded-md text-sm bg-green-100 text-green-700 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
          {decodeURIComponent(successMessage)}
        </div>
      )}

      {pagesWithDetails.length === 0 ? (
        <div className="text-center py-10 border rounded-lg dark:border-slate-700">
          <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-medium text-foreground">
            {filterLangId ? "No pages found for the selected language." : "No pages found."}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Get started by creating a new page.
          </p>
          <div className="mt-6">
            <Link href="/cms/pages/new">
              <Button>
                <PlusCircle className="mr-2 h-4 w-4" /> Create Page
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden dark:border-slate-700">
          <Table>
            <TableHeader>
              <TableRow className="dark:border-slate-700">
                <TableHead className="w-[300px] sm:w-[400px]">Title</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Language</TableHead>
                <TableHead className="hidden md:table-cell">Slug</TableHead>
                <TableHead className="hidden lg:table-cell">Last Updated</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagesWithDetails.map(({ page, languageCode }) => (
                <TableRow key={page.id} className="dark:border-slate-700">
                  <TableCell className="font-medium">{page.title}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        page.status === "published" ? "default" :
                        page.status === "draft" ? "secondary" : "destructive"
                      }
                      className={
                        page.status === "published" ? "bg-green-100 text-green-700 dark:bg-green-700/30 dark:text-green-300 dark:border-green-700/50" :
                        page.status === "draft" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-700/30 dark:text-yellow-300 dark:border-yellow-700/50" :
                        "bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600"
                      }
                    >
                      {page.status.charAt(0).toUpperCase() + page.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell><Badge variant="outline" className="dark:border-slate-600">{languageCode}</Badge></TableCell>
                  <TableCell className="text-muted-foreground text-xs hidden md:table-cell">/{page.slug}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {new Date(page.updated_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Page actions for {page.title}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/cms/pages/${page.id}/edit`} className="flex items-center cursor-pointer">
                            <Edit3 className="mr-2 h-4 w-4" /> Edit
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DeletePageButton pageId={page.id} pageSlug={page.slug} />
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

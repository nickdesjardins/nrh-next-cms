// app/cms/settings/languages/[id]/edit/page.tsx
import React from "react";
import { createClient } from "@/utils/supabase/server";
import LanguageForm from "../../components/LanguageForm";
import { updateLanguage } from "../../actions";
import type { Language } from "@/utils/supabase/types";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

async function getLanguageData(id: number): Promise<Language | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("languages")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching language for edit:", error);
    return null;
  }
  return data;
}

async function getAllLanguages(): Promise<Language[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from("languages").select("*");
    if (error) {
        console.error("Error fetching all languages for edit page form:", error);
        return [];
    }
    return data || [];
}

export default async function EditLanguagePage({ params }: { params: { id: string } }) {
  const languageId = parseInt(params.id, 10);
  if (isNaN(languageId)) {
    return notFound();
  }

  const [language, allLanguages] = await Promise.all([
      getLanguageData(languageId),
      getAllLanguages()
  ]);


  if (!language) {
    return notFound();
  }

  const updateLanguageWithId = updateLanguage.bind(null, languageId);

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6 flex items-center gap-3">
            <Link href="/cms/settings/languages">
                <Button variant="outline" size="icon">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
            </Link>
            <h1 className="text-2xl font-semibold">Edit Language: {language.name}</h1>
      </div>
      <LanguageForm
        language={language}
        formAction={updateLanguageWithId}
        actionButtonText="Update Language"
        isEditing={true}
        allLanguages={allLanguages}
      />
    </div>
  );
}

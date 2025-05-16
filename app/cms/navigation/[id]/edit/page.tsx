// app/cms/navigation/[id]/edit/page.tsx
import { createClient } from "@/utils/supabase/server";
import NavigationItemForm from "../../components/NavigationItemForm";
import { updateNavigationItem } from "../../actions";
import type { NavigationItem } from "@/utils/supabase/types";
import { notFound } from "next/navigation";

async function getNavigationItemData(id: number): Promise<NavigationItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("navigation_items")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching navigation item for edit:", error);
    return null;
  }
  return data;
}

export default async function EditNavigationItemPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const itemId = parseInt(params.id, 10);
  if (isNaN(itemId)) {
    return notFound();
  }

  const item = await getNavigationItemData(itemId);

  if (!item) {
    return notFound();
  }

  const updateItemWithId = updateNavigationItem.bind(null, itemId);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Navigation Item: {item.label}</h1>
      <NavigationItemForm
        item={item}
        formAction={updateItemWithId}
        actionButtonText="Update Item"
        isEditing={true}
      />
    </div>
  );
}

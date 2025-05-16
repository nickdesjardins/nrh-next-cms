// app/blog/[slug]/page.utils.ts
import { createClient } from "@/utils/supabase/server";
import type { Post as PostType, Block as BlockType, ImageBlockContent, Language } from "@/utils/supabase/types";

// Fetches post data by its language-specific slug.
// Includes logic to fetch object_key for image blocks.
export async function getPostDataBySlug(slug: string): Promise<(PostType & { blocks: BlockType[]; language_code: string; language_id: number; translation_group_id: string; }) | null> {
  const supabase = createClient();

  const { data: postData, error: postError } = await supabase
    .from("posts")
    .select(`
      *,
      languages!inner (id, code), 
      blocks (*)
    `)
    .eq("slug", slug) // Find the post by its unique slug for this language
    .eq("status", "published")
    .or(`published_at.is.null,published_at.lte.${new Date().toISOString()}`) // Check published_at
    .order('order', { foreignTable: 'blocks', ascending: true })
    .maybeSingle();

  if (postError || !postData) {
    if(postError) console.error(`Error fetching post data for slug '${slug}':`, postError);
    return null;
  }

  // Ensure language information is correctly extracted
  const langInfo = postData.languages as unknown as { id: number; code: string };
  if (!langInfo || !langInfo.id || !langInfo.code) {
      console.error(`Language information missing or incomplete for post slug '${slug}'. DB response:`, postData.languages);
      if (!postData.language_id) return null; 
      const {data: fallbackLang} = await supabase.from("languages").select("code").eq("id", postData.language_id).single();
      if (!fallbackLang) return null;
      Object.assign(langInfo, {id: postData.language_id, code: fallbackLang.code });
  }
  
  if (!postData.translation_group_id) {
      console.error(`Post with slug '${slug}' is missing a translation_group_id.`);
      return null;
  }

  let blocksWithMediaData: BlockType[] = postData.blocks || [];
  if (blocksWithMediaData.length > 0) {
    const imageBlockMediaIds = blocksWithMediaData
      .filter(block => block.block_type === 'image' && block.content?.media_id)
      .map(block => (block.content as ImageBlockContent).media_id)
      .filter(id => id !== null && typeof id === 'string') as string[];

    if (imageBlockMediaIds.length > 0) {
      const { data: mediaItems, error: mediaError } = await supabase
        .from('media').select('id, object_key').in('id', imageBlockMediaIds);
      if (mediaError) {
        console.error("SSG (Posts): Error fetching media items for blocks:", mediaError);
      } else if (mediaItems) {
        const mediaMap = new Map(mediaItems.map(m => [m.id, m.object_key]));
        blocksWithMediaData = blocksWithMediaData.map(block => {
          if (block.block_type === 'image' && block.content?.media_id) {
            const currentContent = block.content as ImageBlockContent;
            const objectKey = mediaMap.get(currentContent.media_id!);
            if (objectKey) {
              return { ...block, content: { ...currentContent, object_key: objectKey } };
            }
          }
          return block;
        });
      }
    }
  }

  return {
    ...postData,
    blocks: blocksWithMediaData,
    language_code: langInfo.code,
    language_id: langInfo.id, 
    translation_group_id: postData.translation_group_id,
  } as (PostType & { blocks: BlockType[]; language_code: string; language_id: number; translation_group_id: string; });
}

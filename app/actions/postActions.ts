'use server';

import { createClient } from '../../utils/supabase/server';
import type { PostWithMediaDimensions } from '../../utils/supabase/types'; // Ensure this path is correct

export async function fetchPaginatedPublishedPosts(languageId: number, page: number, limit: number): Promise<{ posts: PostWithMediaDimensions[], totalCount: number, error?: string }> {
  const supabase = createClient();
  const offset = (page - 1) * limit;

  const { data: posts, error, count } = await supabase
    .from('posts')
    // JOIN with media table to get dimensions and object_key
    .select('id, title, slug, excerpt, published_at, language_id, status, created_at, updated_at, translation_group_id, feature_image_id, feature_media_object:media!feature_image_id(object_key, width, height)', { count: 'exact' })
    .eq('status', 'published')
    .eq('language_id', languageId)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching paginated posts:", error);
    return { posts: [], totalCount: 0, error: error.message };
  }
 
  const processedPosts = posts.map(post => {
    // Process feature_media_object (which is an object or null from the query)
    const mediaObject = post.feature_media_object as unknown as { object_key: string; width?: number | null; height?: number | null } | null;
    const imageUrl = mediaObject?.object_key
      ? `${process.env.NEXT_PUBLIC_R2_BASE_URL}/${mediaObject.object_key}`
      : null;
 
    return {
      ...post,
      // Convert feature_media_object to array format to match the type
      feature_media_object: mediaObject ? [{ object_key: mediaObject.object_key }] : null,
      feature_image_url: imageUrl,
      // Add the dimensions from the media table
      feature_image_width: mediaObject?.width || null,
      feature_image_height: mediaObject?.height || null,
    };
  });
 
  return { posts: processedPosts as PostWithMediaDimensions[], totalCount: count || 0, error: undefined }; // Return error: undefined on success
}

// You could also move fetchInitialPublishedPosts here if it makes sense for organization
export async function fetchInitialPublishedPosts(languageId: number, limit: number): Promise<{ posts: PostWithMediaDimensions[], totalCount: number, error?: string | null }> {
  const supabase = createClient(); // This createClient is from utils/supabase/server
  const { data: posts, error, count } = await supabase
    .from('posts')
    // JOIN with media table to get dimensions and object_key
    .select('id, title, slug, excerpt, published_at, language_id, status, created_at, updated_at, translation_group_id, feature_image_id, feature_media_object:media!feature_image_id(object_key, width, height)', { count: 'exact' })
    .eq('status', 'published')
    .eq('language_id', languageId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching initial posts:", error);
    return { posts: [], totalCount: 0, error: error.message };
  }
 
  const processedPosts = posts.map(post => {
    const mediaObject = post.feature_media_object as unknown as { object_key: string; width?: number | null; height?: number | null } | null;
    const imageUrl = mediaObject?.object_key
      ? `${process.env.NEXT_PUBLIC_R2_BASE_URL}/${mediaObject.object_key}`
      : null;
 
    return {
      ...post,
      // Convert feature_media_object to array format to match the type
      feature_media_object: mediaObject ? [{ object_key: mediaObject.object_key }] : null,
      feature_image_url: imageUrl,
      // Add the dimensions from the media table
      feature_image_width: mediaObject?.width || null,
      feature_image_height: mediaObject?.height || null,
    };
  });
 
  return { posts: processedPosts as PostWithMediaDimensions[], totalCount: count || 0, error: null };
}
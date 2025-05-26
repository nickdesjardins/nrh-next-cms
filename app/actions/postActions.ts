'use server';

import { createClient } from '../../utils/supabase/server';
import type { Post } from '../../utils/supabase/types'; // Ensure this path is correct

export async function fetchPaginatedPublishedPosts(languageId: number, page: number, limit: number): Promise<{ posts: Post[], totalCount: number, error?: string }> {
  const supabase = createClient();
  const offset = (page - 1) * limit;

  const { data: posts, error, count } = await supabase
    .from('posts')
    // Query for feature_media_object similar to PostsGridBlock
    .select('id, title, slug, excerpt, published_at, language_id, status, created_at, updated_at, translation_group_id, feature_image_id, feature_media_object:media!feature_image_id(object_key)', { count: 'exact' })
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
    // The 'as unknown as ...' cast is to align with how PostsGridBlock handles it,
    // acknowledging the runtime structure vs. the current Post type.
    const mediaObject = post.feature_media_object as unknown as { object_key: string } | null;
    const imageUrl = mediaObject?.object_key
      ? `${process.env.NEXT_PUBLIC_R2_BASE_URL}/${mediaObject.object_key}`
      : null;
 
    return {
      ...post,
      // Ensure feature_media_object is passed through if needed by client, and feature_image_url is correctly derived
      feature_media_object: mediaObject, // Pass the (potentially casted) mediaObject
      feature_image_url: imageUrl,
    };
  });
 
  return { posts: processedPosts as Post[], totalCount: count || 0, error: undefined }; // Return error: undefined on success
}

// You could also move fetchInitialPublishedPosts here if it makes sense for organization
export async function fetchInitialPublishedPosts(languageId: number, limit: number): Promise<{ posts: Post[], totalCount: number, error?: string | null }> {
  const supabase = createClient(); // This createClient is from utils/supabase/server
  const { data: posts, error, count } = await supabase
    .from('posts')
    // Query for feature_media_object similar to PostsGridBlock and fetchPaginatedPublishedPosts
    .select('id, title, slug, excerpt, published_at, language_id, status, created_at, updated_at, translation_group_id, feature_image_id, feature_media_object:media!feature_image_id(object_key)', { count: 'exact' })
    .eq('status', 'published')
    .eq('language_id', languageId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching initial posts:", error);
    return { posts: [], totalCount: 0, error: error.message };
  }
 
  const processedPosts = posts.map(post => {
    const mediaObject = post.feature_media_object as unknown as { object_key: string } | null;
    const imageUrl = mediaObject?.object_key
      ? `${process.env.NEXT_PUBLIC_R2_BASE_URL}/${mediaObject.object_key}`
      : null;
 
    return {
      ...post,
      feature_media_object: mediaObject,
      feature_image_url: imageUrl,
    };
  });
 
  return { posts: processedPosts as Post[], totalCount: count || 0, error: null };
}
'use server';

import { createClient } from '../../utils/supabase/server';
import type { Post } from '../../utils/supabase/types'; // Ensure this path is correct

export async function fetchPaginatedPublishedPosts(languageId: number, page: number, limit: number): Promise<{ posts: Post[], totalCount: number, error?: string }> {
  const supabase = createClient();
  const offset = (page - 1) * limit;

  const { data: posts, error, count } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, published_at, language_id, status, created_at, updated_at, translation_group_id, feature_image_id, media ( object_key )', { count: 'exact' }) // Adjust fields as needed
    .eq('status', 'published')
    .eq('language_id', languageId)
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("Error fetching paginated posts:", error);
    // It's good practice to return a consistent shape, even on error
    return { posts: [], totalCount: 0, error: error.message };
  }

  // Log raw posts from Supabase to check 'media' relation
  if (posts && posts.length > 0) {
    console.log("fetchPaginatedPublishedPosts - Raw post from Supabase (sample):", JSON.stringify(posts[0], null, 2));
    console.log("fetchPaginatedPublishedPosts - Raw post media (sample):", JSON.stringify(posts[0]?.media, null, 2));
  }

  const processedPosts = posts.map(post => ({
    ...post,
    feature_image_url: post.media?.[0]?.object_key ? `${process.env.NEXT_PUBLIC_R2_BASE_URL}/${post.media[0].object_key}` : null,
  }));

  // Log processed posts to check 'feature_image_url'
  if (processedPosts && processedPosts.length > 0) {
    console.log("fetchPaginatedPublishedPosts - Processed post with feature_image_url (sample):", JSON.stringify(processedPosts[0], null, 2));
  }

  return { posts: processedPosts as Post[], totalCount: count || 0, error: undefined }; // Return error: undefined on success
}

// You could also move fetchInitialPublishedPosts here if it makes sense for organization
export async function fetchInitialPublishedPosts(languageId: number, limit: number): Promise<{ posts: Post[], totalCount: number, error?: string | null }> {
  const supabase = createClient(); // This createClient is from utils/supabase/server
  const { data: posts, error, count } = await supabase
    .from('posts')
    .select('id, title, slug, excerpt, published_at, language_id, status, created_at, updated_at, translation_group_id, feature_image_id, media ( object_key )', { count: 'exact' }) // Ensure all Post fields are selected
    .eq('status', 'published')
    .eq('language_id', languageId)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching initial posts:", error);
    return { posts: [], totalCount: 0, error: error.message };
  }
  const processedPosts = posts.map(post => ({
    ...post,
    feature_image_url: post.media?.[0]?.object_key ? `${process.env.NEXT_PUBLIC_R2_BASE_URL}/${post.media[0].object_key}` : null,
  }));
  return { posts: processedPosts as Post[], totalCount: count || 0, error: null };
}
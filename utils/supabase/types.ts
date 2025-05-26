// utils/supabase/types.ts
export type UserRole = 'ADMIN' | 'WRITER' | 'USER';

export interface Profile {
  id: string; // UUID
  updated_at?: string | null;
  username?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  website?: string | null;
  role: UserRole;
}

export interface Language {
  id: number;
  code: string;
  name: string;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export type PageStatus = 'draft' | 'published' | 'archived';

// --- Block Type Definitions ---
export const availableBlockTypes = ["text", "heading", "image", "button", "posts_grid"] as const;
export type BlockType = (typeof availableBlockTypes)[number];

export interface TextBlockContent {
  html_content: string;
}

export interface HeadingBlockContent {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text_content: string;
}

export interface ImageBlockContent {
  media_id: string | null;    // UUID of the media item from the 'media' table
  object_key?: string | null; // The actual R2 object key (e.g., "uploads/image.png")
  alt_text?: string;
  caption?: string;
  width?: number | null;      // Added width
  height?: number | null;     // Added height
}

export interface ButtonBlockContent {
  text: string;
  url: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
}

export interface PostsGridBlockContent {
  postsPerPage: number;
  columns: number;
  showPagination: boolean;
  title?: string;
}

export type SpecificBlockContent =
  | ({ type: "text" } & TextBlockContent)
  | ({ type: "heading" } & HeadingBlockContent)
  | ({ type: "image" } & ImageBlockContent)
  | ({ type: "button" } & ButtonBlockContent)
  | ({ type: "posts_grid" } & PostsGridBlockContent);

export interface Block {
  id: number;
  page_id?: number | null;
  post_id?: number | null;
  language_id: number;
  block_type: BlockType;
  content: Partial<ImageBlockContent> | Partial<TextBlockContent> | Partial<HeadingBlockContent> | Partial<ButtonBlockContent> | Partial<PostsGridBlockContent> | any;
  order: number;
  created_at: string;
  updated_at: string;
}
// --- End Block Type Definitions ---

export interface Page {
  id: number;
  language_id: number;
  author_id?: string | null;
  title: string;
  slug: string;
  status: PageStatus;
  meta_title?: string | null;
  meta_description?: string | null;
  created_at: string;
  updated_at: string;
  blocks?: Block[];
  translation_group_id: string; // Added
}

export interface Post {
  id: number;
  language_id: number;
  author_id?: string | null;
  title: string;
  slug: string;
  excerpt?: string | null;
  status: PageStatus;
  published_at?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  created_at: string;
  updated_at: string;
  blocks?: Block[];
  translation_group_id: string; // Added
  feature_image_id?: string | null;
  feature_image_url?: string | null;
  media?: { object_key: string; }[] | null; // General media items associated with the post
  feature_media_object?: { object_key: string }[] | null; // Media object(s) for feature_image_id, expected to be 0 or 1 item
}

export interface Media {
  id: string; // uuid
  uploader_id?: string | null;
  file_name: string;
  object_key: string;
  file_type?: string | null;
  size_bytes?: number | null;
  description?: string | null;
  width?: number | null;      // Added width
  height?: number | null;     // Added height
  created_at: string;
  updated_at: string;
}

export type MenuLocation = 'HEADER' | 'FOOTER' | 'SIDEBAR';

export interface NavigationItem {
  id: number;
  language_id: number;
  menu_key: MenuLocation;
  label: string;
  url: string;
  parent_id?: number | null;
  order: number;
  page_id?: number | null;
  created_at: string;
  updated_at: string;
  translation_group_id: string; // Added
}

export interface AuthUser {
    id: string;
    email?: string;
    created_at?: string;
    last_sign_in_at?: string;
}

export interface UserWithProfile {
    authUser: AuthUser;
    profile: Profile | null;
}

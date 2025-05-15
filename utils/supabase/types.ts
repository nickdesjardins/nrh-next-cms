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
export const availableBlockTypes = ["text", "heading", "image", "button"] as const;
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
}

export interface ButtonBlockContent {
  text: string;
  url: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg';
}

export type SpecificBlockContent = // Renamed from BlockContent to avoid conflict with Block.content
  | ({ type: "text" } & TextBlockContent)
  | ({ type: "heading" } & HeadingBlockContent)
  | ({ type: "image" } & ImageBlockContent)
  | ({ type: "button" } & ButtonBlockContent);

export interface Block {
  id: number;
  page_id?: number | null;
  post_id?: number | null;
  language_id: number;
  block_type: BlockType;
  content: Partial<ImageBlockContent> | Partial<TextBlockContent> | Partial<HeadingBlockContent> | Partial<ButtonBlockContent> | any; // Store specific content structure
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
  blocks?: Block[]; // For fetching blocks along with the page
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
  blocks?: Block[]; // For fetching blocks along with the post
}

export interface Media { // Ensure this is fully defined as per your schema
  id: string; // uuid
  uploader_id?: string | null;
  file_name: string;
  object_key: string; // This is crucial
  file_type?: string | null;
  size_bytes?: number | null;
  description?: string | null;
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

// Reminder: Generate full types with `npx supabase gen types typescript ...`

// It's highly recommended to generate the full database types using:
// npx supabase gen types typescript --project-id YOUR_PROJECT_ID --schema public > utils/supabase/database.types.ts
// And then import { Database } from './database.types'; in your Supabase client/server files.
// The types above are simplified. Your generated types will be more comprehensive.
// For example, Database['public']['Tables']['pages']['Row']
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
export const availableBlockTypes = ["text", "heading", "image", "button"] as const; // Add more as needed
export type BlockType = (typeof availableBlockTypes)[number];

// Content structure for each block type
export interface TextBlockContent {
  html_content: string; // For rich text, or simple text
}

export interface HeadingBlockContent {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text_content: string;
}

export interface ImageBlockContent {
  media_id: string | null; // UUID of the media item
  alt_text?: string;
  caption?: string;
}

export interface ButtonBlockContent {
  text: string;
  url: string;
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link'; // Example variants
  size?: 'default' | 'sm' | 'lg';
}

// Discriminated union for block content for type safety
export type BlockContent =
  | ({ type: "text" } & TextBlockContent)
  | ({ type: "heading" } & HeadingBlockContent)
  | ({ type: "image" } & ImageBlockContent)
  | ({ type: "button" } & ButtonBlockContent);
  // Add other block content types here

export interface Block {
  id: number; // bigint
  page_id?: number | null; // bigint
  post_id?: number | null; // bigint
  language_id: number; // bigint
  block_type: BlockType; // Use the defined BlockType
  content: any; // jsonb. Ideally, this would be BlockContent, but Supabase client might return it as `any` initially. We'll cast it.
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

export interface Media {
  id: string; // uuid
  uploader_id?: string | null;
  file_name: string;
  object_key: string;
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
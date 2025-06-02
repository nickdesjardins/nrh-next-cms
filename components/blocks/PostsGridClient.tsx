// components/blocks/PostsGridClient.tsx
'use client';

import React, { useState, useEffect } from 'react';
import type { PostWithMediaDimensions } from '../../utils/supabase/types';
import { AnimatedLink } from '@/components/transitions'; // Changed to AnimatedLink
import Image from 'next/image';
import { Button } from '../ui/button'; // Adjusted path

interface PostsGridClientProps {
  initialPosts: PostWithMediaDimensions[];
  initialPage: number;
  postsPerPage: number;
  totalCount: number;
  columns: number;
  languageId: number;
  showPagination: boolean;
  fetchAction: (languageId: number, page: number, limit: number) => Promise<{ posts: PostWithMediaDimensions[], totalCount: number, error?: string }>;
}

const PostsGridClient: React.FC<PostsGridClientProps> = ({
  initialPosts,
  initialPage,
  postsPerPage,
  totalCount,
  columns,
  languageId,
  showPagination,
  fetchAction,
}) => {
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [posts, setPosts] = useState<PostWithMediaDimensions[]>(initialPosts);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / postsPerPage);

  useEffect(() => {
    setPosts(initialPosts); // Sync if initialPosts change due to parent re-render
    setCurrentPage(initialPage);
  }, [initialPosts, initialPage]);

  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchAction(languageId, newPage, postsPerPage);

      if (result.error) {
        setError(result.error);
        setPosts([]);
      } else {
        setPosts(result.posts);
        setCurrentPage(newPage);
      }
    } catch (e: any) {
      setError(e.message || "Failed to fetch posts.");
      setPosts([]);
    }
    setIsLoading(false);
  };

  const columnClasses: { [key: number]: string } = {
    1: 'grid-cols-1',
    2: 'md:grid-cols-2',
    3: 'lg:grid-cols-3', // Default for 3 columns
    4: 'lg:grid-cols-4', // Example for 4 columns
  };
  const gridColsClass = columnClasses[columns] || columnClasses[3];


  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  return (
    <div>
      <div className={`grid ${gridColsClass} gap-6`}>
        {posts.map((post) => (
          <AnimatedLink href={`/blog/${post.slug}`} key={post.id} className="block group" prefetchOnHover={true}>
            <div className="border rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow bg-card text-card-foreground">
              {/* Basic Post Card Structure - Enhanced with Feature Image */}
              {post.feature_image_url && typeof post.feature_image_width === 'number' && typeof post.feature_image_height === 'number' && post.feature_image_width > 0 && post.feature_image_height > 0 ? (
                <div className="aspect-video overflow-hidden"> {/* Or other aspect ratio as desired, e.g., aspect-[16/9] or aspect-square */}
                  <Image
                    src={post.feature_image_url}
                    alt={`Feature image for ${post.title}`}
                    width={post.feature_image_width}
                    height={post.feature_image_height}
                    priority
                    className="h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
              ) : post.feature_image_url ? (
                <div className="aspect-video overflow-hidden bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-500">Image not available</span>
                </div>
              ) : null}
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-2 group-hover:text-primary">{post.title}</h3>
                {post.excerpt && <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{post.excerpt}</p>}
                <span className="text-xs text-primary group-hover:underline">Read more</span>
              </div>
            </div>
          </AnimatedLink>
        ))}
      </div>

      {showPagination && totalPages > 1 && (
        <div className="flex justify-center items-center mt-8 space-x-2">
          <Button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isLoading}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isLoading}
            variant="outline"
          >
            Next
          </Button>
        </div>
      )}
      {isLoading && <p className="text-center mt-4">Loading...</p>}
    </div>
  );
};

export default PostsGridClient;
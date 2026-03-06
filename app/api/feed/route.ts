import { NextRequest, NextResponse } from "next/server";
import { eq } from "@arkiv-network/sdk/query";
import { publicClient } from "../../lib/arkiv";
import { Post } from "../../types/api";
import { MediaService } from "../../services/media";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../../lib/api-helpers";

export const dynamic = 'force-dynamic';

// GET /api/feed - Get chronological feed of posts
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  try {
    // Query all posts
    const postsQuery = publicClient
      .buildQuery()
      .where(eq("type", "post"))
      .withPayload(true)
      .withAttributes(true)
      .limit(limit);

    const queryResult = await postsQuery.fetch();
    const postEntities = queryResult.entities || queryResult;

    if (!Array.isArray(postEntities)) {
      return createErrorResponse("Failed to fetch posts", 500);
    }

    // Process posts and fetch media data
    const posts: Post[] = [];

    for (const postEntity of postEntities) {
      try {
        const postData = JSON.parse(
          new TextDecoder().decode(postEntity.payload)
        );

        const mediaId = postData.media_id;
        const metadataEntityKey = postData.metadata_entity_key;
        const imageEntityKey = postData.image_entity_key;

        if (!mediaId || !metadataEntityKey || !imageEntityKey) {
          console.warn(`Post ${postEntity.key} missing media data, skipping`);
          continue;
        }

        // Fetch media data using the service
        const imageData = await MediaService.fetchPostMedia(
          metadataEntityKey,
          imageEntityKey
        );
        if (!imageData) {
          console.warn(`Image not found for post ${postEntity.key}, skipping`);
          continue;
        }

        const post: Post = {
          id: postEntity.key,
          owner: postData.owner,
          caption: postData.caption,
          media_id: mediaId,
          likes: postData.likes || [],
          comments: postData.comments || [],
          created_at: postData.created_at,
          updated_at: postData.updated_at,
          image: imageData,
        };

        posts.push(post);
      } catch (error) {
        console.error(`Error processing post ${postEntity.key}:`, error);
        // Continue with other posts
      }
    }

    // Sort by newest first
    posts.sort((a, b) => b.created_at - a.created_at);

    return createSuccessResponse({
      success: true,
      posts,
      total: posts.length,
    });
  } catch (error) {
    console.error("Feed retrieval failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve feed.";
    return createErrorResponse(message);
  }
}

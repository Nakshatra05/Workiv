import { NextRequest, NextResponse } from "next/server";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";
import { eq, and } from "@arkiv-network/sdk/query";
import { Comment } from "../../../types/api";
import {
  walletClient,
  publicClient,
  walletClientInitError,
} from "../../../lib/arkiv";

export const dynamic = 'force-dynamic';

// POST /api/post/comments - Add a comment to a post
export async function POST(request: NextRequest) {
  try {
    if (!walletClient) {
      return NextResponse.json(
        { message: walletClientInitError || "Wallet client not initialized" },
        { status: 500 }
      );
    }

    // Parse form data instead of JSON
    const formData = await request.formData();
    const post_id = formData.get("post_id") as string;
    const author = formData.get("author") as string;
    const content = formData.get("content") as string;
    const parent_comment_id = formData.get("parent_comment_id") as
      | string
      | null;

    // Validate required fields
    if (!post_id || !author || !content) {
      return NextResponse.json(
        { message: "Missing required fields: post_id, author, content" },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.trim().length === 0 || content.length > 1000) {
      return NextResponse.json(
        { message: "Comment content must be 1-1000 characters" },
        { status: 400 }
      );
    }

    // Verify the post exists (temporarily disabled for testing)
    /*
    try {
      const postEntity = await publicClient.getEntity(post_id as `0x${string}`);
      if (!postEntity) {
        return NextResponse.json(
          { message: "Post not found" },
          { status: 404 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { message: "Invalid post ID" },
        { status: 400 }
      );
    }
    */

    const timestamp = Date.now();
    const commentId = `comment_${timestamp}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Create comment entity
    const commentPayload = {
      id: commentId,
      post_id,
      author: author.trim(),
      content: content.trim(),
      created_at: timestamp,
      updated_at: timestamp,
      likes: [],
      replies: [],
      parent_comment_id: parent_comment_id || null,
    };

    const commentResult = await walletClient.createEntity({
      payload: jsonToPayload(commentPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "comment" },
        { key: "post_id", value: post_id },
        { key: "author", value: author.trim() },
        { key: "created_at", value: timestamp.toString() },
        ...(parent_comment_id
          ? [{ key: "parent_comment_id", value: parent_comment_id }]
          : []),
      ],
      expiresIn: ExpirationTime.fromDays(30), // Comments expire in 30 days
    });

    await walletClient.waitForTransactionReceipt({
      hash: commentResult.txHash,
    });

    return NextResponse.json({
      success: true,
      comment: {
        entity_key: commentResult.entityKey,
        ...commentPayload,
      },
    });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      {
        message: "Failed to create comment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET /api/post/comments?post_id=...&limit=10&offset=0
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("post_id");
  const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50); // Max 50 comments
  const offset = parseInt(searchParams.get("offset") || "0");

  if (!postId) {
    return NextResponse.json(
      { message: "post_id query parameter is required" },
      { status: 400 }
    );
  }

  try {
    // Query comments for the post
    const commentsQuery = publicClient
      .buildQuery()
      .where(eq("type", "comment"))
      .where(eq("post_id", postId))
      .withPayload(true)
      .withAttributes(true)
      .limit(limit * 2); // Fetch more to allow for client-side sorting

    const queryResult = await commentsQuery.fetch();
    const commentResults = queryResult.entities || queryResult;

    if (!Array.isArray(commentResults)) {
      return NextResponse.json(
        { message: "Failed to fetch comments" },
        { status: 500 }
      );
    }

    // Convert to Comment format and sort by created_at desc
    const comments: Comment[] = commentResults
      .map((result: any) => {
        const payload = JSON.parse(new TextDecoder().decode(result.payload));
        // Use result.key (entity key) for deletion, fallback to custom id if not available
        const entityKey = result.key || payload.id;
        return {
          id: entityKey,
          post_id: payload.post_id,
          author: payload.author,
          content: payload.content,
          created_at: payload.created_at,
          updated_at: payload.updated_at,
          likes: payload.likes || [],
          replies: payload.replies || [],
          parent_comment_id: payload.parent_comment_id || undefined,
        };
      })
      .sort((a, b) => b.created_at - a.created_at) // Sort by newest first
      .slice(offset, offset + limit); // Apply pagination

    return NextResponse.json({
      success: true,
      comments,
      pagination: {
        limit,
        offset,
        has_more: commentResults.length > offset + limit,
      },
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    return NextResponse.json(
      {
        message: "Failed to fetch comments",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PUT /api/post/comments - Update a comment
export async function PUT(request: NextRequest) {
  try {
    if (!walletClient) {
      return NextResponse.json(
        { message: walletClientInitError || "Wallet client not initialized" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const commentId = formData.get("comment_id") as string;
    const author = formData.get("author") as string;
    const content = formData.get("content") as string;

    if (!commentId || !author || !content) {
      return NextResponse.json(
        { message: "Missing required fields: comment_id, author, content" },
        { status: 400 }
      );
    }

    // Validate content length
    if (content.trim().length === 0 || content.length > 1000) {
      return NextResponse.json(
        { message: "Comment content must be 1-1000 characters" },
        { status: 400 }
      );
    }

    // Verify the comment exists and user is the author
    try {
      const commentEntity = await publicClient.getEntity(
        commentId as `0x${string}`
      );
      if (!commentEntity || !commentEntity.payload) {
        return NextResponse.json(
          { message: "Comment not found" },
          { status: 404 }
        );
      }

      const commentData = JSON.parse(
        new TextDecoder().decode(commentEntity.payload)
      );
      if (commentData.author !== author) {
        return NextResponse.json(
          { message: "You can only edit your own comments" },
          { status: 403 }
        );
      }
    } catch (error) {
      return NextResponse.json(
        { message: "Invalid comment ID" },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const updatedCommentPayload = {
      id: commentId,
      post_id: (formData.get("post_id") as string) || "", // Keep existing post_id
      author: author.trim(),
      content: content.trim(),
      created_at: timestamp, // Keep original created_at
      updated_at: timestamp,
      likes: [], // Keep existing likes
      replies: [], // Keep existing replies
      parent_comment_id: (formData.get("parent_comment_id") as string) || null,
    };

    const updateResult = await walletClient.updateEntity({
      entityKey: commentId as `0x${string}`,
      payload: jsonToPayload(updatedCommentPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "comment" },
        { key: "post_id", value: updatedCommentPayload.post_id },
        { key: "author", value: author.trim() },
        { key: "created_at", value: timestamp.toString() },
        { key: "updated_at", value: timestamp.toString() },
        ...(updatedCommentPayload.parent_comment_id
          ? [
              {
                key: "parent_comment_id",
                value: updatedCommentPayload.parent_comment_id,
              },
            ]
          : []),
      ],
      expiresIn: ExpirationTime.fromDays(30),
    });

    await walletClient.waitForTransactionReceipt({ hash: updateResult.txHash });

    return NextResponse.json({
      success: true,
      comment: {
        entity_key: commentId,
        ...updatedCommentPayload,
      },
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    return NextResponse.json(
      {
        message: "Failed to update comment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// DELETE /api/post/comments - Delete a comment
export async function DELETE(request: NextRequest) {
  try {
    if (!walletClient) {
      return NextResponse.json(
        { message: walletClientInitError || "Wallet client not initialized" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get("comment_id");
    const author = searchParams.get("author");

    if (!commentId || !author) {
      return NextResponse.json(
        { message: "comment_id and author query parameters are required" },
        { status: 400 }
      );
    }

    // Check if commentId is a valid hex string (entity key) or custom string ID
    let entityKey: `0x${string}`;
    
    if (commentId.startsWith("0x") && /^0x[a-fA-F0-9]+$/.test(commentId)) {
      // It's a valid entity key (hex string) - use it directly
      entityKey = commentId as `0x${string}`;
    } else {
      // It's a custom string ID, need to query by it
      console.log(`Looking up comment by custom ID: ${commentId} for author: ${author}`);
      
      const query = publicClient
        .buildQuery()
        .where(eq("type", "comment"))
        .where(eq("author", author))
        .withPayload(true)
        .withAttributes(true)
        .limit(50);

      const queryResult = await query.fetch();
      const comments = queryResult.entities || queryResult;

      if (!Array.isArray(comments)) {
        console.error("Query result is not an array:", queryResult);
        return NextResponse.json(
          { message: "Comment not found: Invalid query result." },
          { status: 404 }
        );
      }

      console.log(`Found ${comments.length} comments for author ${author}`);

      // Find the comment by custom id in payload
      const foundComment = comments.find((comment: any) => {
        if (!comment.payload) return false;
        try {
          const payload = JSON.parse(new TextDecoder().decode(comment.payload));
          return payload.id === commentId;
        } catch (e) {
          console.error("Error parsing comment payload:", e);
          return false;
        }
      });

      if (!foundComment) {
        console.error(`Comment with ID ${commentId} not found in query results`);
        return NextResponse.json(
          { message: `Comment not found: No comment with ID ${commentId} found for author ${author}.` },
          { status: 404 }
        );
      }

      // Extract entity key from result
      const extractedKey = foundComment.key;
      if (!extractedKey) {
        console.error("Comment found but no entity key available:", foundComment);
        return NextResponse.json(
          { message: "Comment entity key not found in query result." },
          { status: 404 }
        );
      }

      entityKey = extractedKey as `0x${string}`;
      console.log(`Found entity key for comment ${commentId}: ${entityKey}`);
    }

    // Verify the comment exists and user is the author
    const commentEntity = await publicClient.getEntity(entityKey);
    if (!commentEntity || !commentEntity.payload) {
      return NextResponse.json(
        { message: "Comment not found" },
        { status: 404 }
      );
    }

    const commentData = JSON.parse(
      new TextDecoder().decode(commentEntity.payload)
    );
    if (commentData.author !== author) {
      return NextResponse.json(
        { message: "You can only delete your own comments" },
        { status: 403 }
      );
    }

    const deleteResult = await walletClient.deleteEntity({
      entityKey: entityKey,
    });

    await walletClient.waitForTransactionReceipt({ hash: deleteResult.txHash });

    return NextResponse.json({
      success: true,
      message: "Comment deleted successfully",
      txHash: deleteResult.txHash,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    return NextResponse.json(
      {
        message: "Failed to delete comment",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

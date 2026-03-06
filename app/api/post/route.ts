import { NextRequest, NextResponse } from "next/server";

import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";

import { MimeType } from "@arkiv-network/sdk";

import { MediaMetadata } from "../../types/api";
import {
  walletClient,
  publicClient,
  walletClientInitError,
} from "../../lib/arkiv";
import {
  validateWalletClient,
  createErrorResponse,
  createSuccessResponse,
} from "../../lib/api-helpers";

export const dynamic = 'force-dynamic';
import { MediaService } from "../../services/media";

function generateMediaId(): string {
  // Generate a unique media ID using timestamp and random string
  return `media_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

function calculateExpirationBlock(ttlDays: number): number {
  // Approximate: assuming ~12 seconds per block on Arkiv
  const secondsPerBlock = 12;
  const blocksPerDay = (24 * 60 * 60) / secondsPerBlock;
  const currentBlock = Math.floor(Date.now() / (secondsPerBlock * 1000));
  return currentBlock + Math.floor(ttlDays * blocksPerDay);
}

type PostPayload = {
  image?: File;
  owner?: string;
  caption?: string;
};

type CompletePostPayload = Required<Pick<PostPayload, "owner" | "caption">> & {
  image: File;
};

const isValidBody = (body: PostPayload): body is CompletePostPayload => {
  return (
    typeof body.owner === "string" &&
    body.owner.length > 0 &&
    typeof body.caption === "string" &&
    body.image instanceof File
  );
};

export async function POST(request: NextRequest) {
  const walletValidation = validateWalletClient(
    walletClient,
    walletClientInitError
  );
  if (walletValidation) return walletValidation;

  // walletClient is now guaranteed to be non-null
  const client = walletClient!;

  try {
    const formData = await request.formData();
    const image = formData.get("image") as File;
    const owner = formData.get("owner") as string;
    const caption = formData.get("caption") as string;

    const body: PostPayload = { image, owner, caption };

    if (!isValidBody(body)) {
      return NextResponse.json(
        { message: "image (File), owner, and caption are required." },
        { status: 400 }
      );
    }

    // Validate image
    if (image.size > 25 * 1024 * 1024) {
      // 25MB limit
      return NextResponse.json(
        { message: "Image too large (max 25MB)." },
        { status: 400 }
      );
    }

    if (
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
        image.type
      )
    ) {
      return NextResponse.json(
        { message: "Only JPEG, PNG, GIF, and WebP images are supported." },
        { status: 400 }
      );
    }

    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const mediaId = generateMediaId();
    const ttlDays = 7; // 7 days default
    const expirationBlock = calculateExpirationBlock(ttlDays);

    // Store the image directly (no chunking for now)
    const imageResult = await client.createEntity({
      payload: imageBuffer,
      contentType: image.type as MimeType,
      attributes: [
        { key: "type", value: "image" },
        { key: "media_id", value: mediaId },
        { key: "filename", value: image.name },
      ],
      expiresIn: ExpirationTime.fromDays(ttlDays),
    });
    await client.waitForTransactionReceipt({ hash: imageResult.txHash });

    // Create metadata
    const metadata = {
      media_id: mediaId,
      filename: image.name,
      content_type: image.type,
      file_size: imageBuffer.length,
      checksum: "", // Checksum not needed without chunking
      created_at: new Date(),
      expiration_block: expirationBlock,
      btl_days: ttlDays,
    };

    // Store metadata
    const metadataResult = await client.createEntity({
      payload: jsonToPayload(metadata),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "image_metadata" },
        { key: "media_id", value: mediaId },
        { key: "filename", value: image.name },
        { key: "content_type", value: image.type },
      ],
      expiresIn: ExpirationTime.fromDays(ttlDays),
    });
    await client.waitForTransactionReceipt({
      hash: metadataResult.txHash,
    });

    // Create post entity
    const timestamp = Date.now();
    const postPayload = {
      owner: body.owner,
      caption: body.caption.trim(),
      media_id: mediaId,
      metadata_entity_key: metadataResult.entityKey,
      image_entity_key: imageResult.entityKey,
      likes: [],
      comments: [],
      created_at: timestamp,
      updated_at: timestamp,
      version: 1,
    };

    const postResult = await client.createEntity({
      payload: jsonToPayload(postPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "post" },
        { key: "owner", value: body.owner },
        { key: "media_id", value: mediaId },
      ],
      expiresIn: ExpirationTime.fromDays(30), // Posts live longer than images
    });
    await client.waitForTransactionReceipt({ hash: postResult.txHash });

    return NextResponse.json(
      {
        success: true,
        postId: postResult.entityKey,
        mediaId,
        txHash: postResult.txHash,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Post creation failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create post.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("id");

  if (!postId) {
    return NextResponse.json(
      { message: "Post ID is required as 'id' query parameter." },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch the post entity
    const postEntity = await publicClient.getEntity(postId as `0x${string}`);
    if (!postEntity || !postEntity.payload) {
      return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    const postData = JSON.parse(new TextDecoder().decode(postEntity.payload));
    const mediaId = postData.media_id;
    const metadataEntityKey = postData.metadata_entity_key;
    const imageEntityKey = postData.image_entity_key;

    if (!mediaId || !metadataEntityKey || !imageEntityKey) {
      return createErrorResponse(
        "Post has no associated media, metadata, or image.",
        400
      );
    }

    // Fetch media data using the service
    const imageData = await MediaService.fetchPostMedia(
      metadataEntityKey,
      imageEntityKey
    );
    if (!imageData) {
      return createErrorResponse("Image not found.", 404);
    }

    return createSuccessResponse({
      success: true,
      post: {
        id: postId,
        owner: postData.owner,
        caption: postData.caption,
        media_id: mediaId,
        likes: postData.likes || [],
        comments: postData.comments || [],
        created_at: postData.created_at,
        updated_at: postData.updated_at,
        image: imageData,
      },
    });
  } catch (error) {
    console.error("Post retrieval failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve post.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

// PUT /api/post - Update post caption only
export async function PUT(request: NextRequest) {
  const walletValidation = validateWalletClient(
    walletClient,
    walletClientInitError
  );
  if (walletValidation) return walletValidation;

  // walletClient is now guaranteed to be non-null
  const client = walletClient!;

  try {
    const formData = await request.formData();
    const postId = formData.get("post_id") as string;
    const owner = formData.get("owner") as string;
    const caption = formData.get("caption") as string;

    if (!postId || !owner || !caption) {
      return NextResponse.json(
        { message: "post_id, owner, and caption are required." },
        { status: 400 }
      );
    }

    // Validate caption length
    if (caption.trim().length === 0 || caption.length > 500) {
      return NextResponse.json(
        { message: "Caption must be 1-500 characters." },
        { status: 400 }
      );
    }

    // Fetch existing post to verify ownership and get current data
    const existingPost = await publicClient.getEntity(postId as `0x${string}`);
    if (!existingPost || !existingPost.payload) {
      return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    const postData = JSON.parse(new TextDecoder().decode(existingPost.payload));

    // Verify ownership
    if (postData.owner !== owner) {
      return NextResponse.json(
        { message: "You can only edit your own posts." },
        { status: 403 }
      );
    }

    // Update only the caption and updated_at timestamp
    const updatedPostPayload = {
      ...postData,
      caption: caption.trim(),
      updated_at: Date.now(),
      version: (postData.version || 1) + 1,
    };

    const updateResult = await client.updateEntity({
      entityKey: postId as `0x${string}`,
      payload: jsonToPayload(updatedPostPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "post" },
        { key: "owner", value: owner },
        { key: "media_id", value: postData.media_id },
      ],
      expiresIn: ExpirationTime.fromDays(30),
    });

    await client.waitForTransactionReceipt({ hash: updateResult.txHash });

    return NextResponse.json({
      success: true,
      postId,
      txHash: updateResult.txHash,
      message: "Post caption updated successfully.",
    });
  } catch (error) {
    console.error("Post update failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update post.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

// DELETE /api/post - Delete a post
export async function DELETE(request: NextRequest) {
  const walletValidation = validateWalletClient(
    walletClient,
    walletClientInitError
  );
  if (walletValidation) return walletValidation;

  // walletClient is now guaranteed to be non-null
  const client = walletClient!;

  const { searchParams } = new URL(request.url);
  const postId = searchParams.get("post_id");
  const owner = searchParams.get("owner");

  if (!postId || !owner) {
    return NextResponse.json(
      { message: "post_id and owner query parameters are required." },
      { status: 400 }
    );
  }

  try {
    // Fetch existing post to verify ownership
    const existingPost = await publicClient.getEntity(postId as `0x${string}`);
    if (!existingPost || !existingPost.payload) {
      return NextResponse.json({ message: "Post not found." }, { status: 404 });
    }

    const postData = JSON.parse(new TextDecoder().decode(existingPost.payload));

    // Verify ownership
    if (postData.owner !== owner) {
      return NextResponse.json(
        { message: "You can only delete your own posts." },
        { status: 403 }
      );
    }

    const deleteResult = await client.deleteEntity({
      entityKey: postId as `0x${string}`,
    });

    await client.waitForTransactionReceipt({ hash: deleteResult.txHash });

    return NextResponse.json({
      success: true,
      message: "Post deleted successfully.",
      txHash: deleteResult.txHash,
    });
  } catch (error) {
    console.error("Post deletion failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete post.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

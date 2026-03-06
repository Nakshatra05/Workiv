import { NextRequest, NextResponse } from "next/server";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";
import { eq } from "@arkiv-network/sdk/query";
import { MimeType } from "@arkiv-network/sdk";
import { Story } from "../../types/api";
import {
  walletClient,
  publicClient,
  walletClientInitError,
} from "../../lib/arkiv";

export const dynamic = 'force-dynamic';

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

// POST /api/stories - Create a new story
export async function POST(request: NextRequest) {
  try {
    if (!walletClient) {
      return NextResponse.json(
        { message: walletClientInitError || "Wallet client not initialized" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const media = formData.get("media") as File;
    const author = formData.get("author") as string;
    const content = formData.get("content") as string;
    const expirationTime = (formData.get("expiration_time") as string) || "24h";

    if (!media || !author) {
      return NextResponse.json(
        { message: "media (File) and author are required." },
        { status: 400 }
      );
    }

    // Validate expiration time
    if (!["1min", "5min", "24h"].includes(expirationTime)) {
      return NextResponse.json(
        { message: "expiration_time must be one of: 1min, 5min, 24h." },
        { status: 400 }
      );
    }

    // Validate media
    if (media.size > 25 * 1024 * 1024) {
      // 25MB limit
      return NextResponse.json(
        { message: "Media too large (max 25MB)." },
        { status: 400 }
      );
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "video/mp4",
      ].includes(media.type)
    ) {
      return NextResponse.json(
        {
          message:
            "Only images (JPEG, PNG, GIF, WebP) and MP4 videos are supported.",
        },
        { status: 400 }
      );
    }

    const mediaBuffer = Buffer.from(await media.arrayBuffer());
    const mediaId = generateMediaId();
    
    // Calculate expiration time based on user selection
    let ttlMinutes: number;
    let ttlHours: number;
    
    switch (expirationTime) {
      case "1min":
        ttlMinutes = 1;
        ttlHours = 1 / 60; // Convert to hours for ExpirationTime
        break;
      case "5min":
        ttlMinutes = 5;
        ttlHours = 5 / 60; // Convert to hours for ExpirationTime
        break;
      case "24h":
      default:
        ttlMinutes = 24 * 60;
        ttlHours = 24;
        break;
    }
    
    const expiresAt = Date.now() + ttlMinutes * 60 * 1000;

    // Store the media directly (no chunking for stories)
    const mediaResult = await walletClient.createEntity({
      payload: mediaBuffer,
      contentType: media.type as MimeType,
      attributes: [
        { key: "type", value: "story_media" },
        { key: "media_id", value: mediaId },
        { key: "filename", value: media.name },
      ],
      expiresIn: ttlHours >= 1 
        ? ExpirationTime.fromHours(ttlHours)
        : ExpirationTime.fromMinutes(ttlMinutes),
    });
    await walletClient.waitForTransactionReceipt({ hash: mediaResult.txHash });

    // Create metadata
    const metadata = {
      media_id: mediaId,
      filename: media.name,
      content_type: media.type,
      file_size: mediaBuffer.length,
      checksum: "", // Checksum not needed without chunking
      created_at: new Date(),
      expires_at: expiresAt,
      ttl_minutes: ttlMinutes,
      ttl_hours: ttlHours,
    };

    // Store metadata
    const metadataResult = await walletClient.createEntity({
      payload: jsonToPayload(metadata),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "story_metadata" },
        { key: "media_id", value: mediaId },
        { key: "filename", value: media.name },
        { key: "content_type", value: media.type },
      ],
      expiresIn: ttlHours >= 1 
        ? ExpirationTime.fromHours(ttlHours)
        : ExpirationTime.fromMinutes(ttlMinutes),
    });
    await walletClient.waitForTransactionReceipt({
      hash: metadataResult.txHash,
    });

    // Create story entity
    const timestamp = Date.now();
    const storyId = `story_${timestamp}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    const storyPayload = {
      id: storyId,
      author: author.trim(),
      media_id: mediaId,
      content: content?.trim() || "",
      created_at: timestamp,
      expires_at: expiresAt,
      views: [],
      type: media.type.startsWith("video/") ? "video" : "image",
    };

    const storyResult = await walletClient.createEntity({
      payload: jsonToPayload(storyPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "story" },
        { key: "author", value: author.trim() },
        { key: "media_id", value: mediaId },
        { key: "created_at", value: timestamp.toString() },
        { key: "expires_at", value: expiresAt.toString() },
      ],
      expiresIn: ttlHours >= 1 
        ? ExpirationTime.fromHours(ttlHours)
        : ExpirationTime.fromMinutes(ttlMinutes),
    });
    await walletClient.waitForTransactionReceipt({ hash: storyResult.txHash });

    return NextResponse.json(
      {
        success: true,
        storyId: storyResult.entityKey,
        entityKey: storyResult.entityKey,
        explorerUrl: `https://explorer.mendoza.hoodi.arkiv.network/entity/${storyResult.entityKey}`,
        mediaId,
        expiresAt,
        txHash: storyResult.txHash,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Story creation failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create story.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

// GET /api/stories - Get active stories
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const author = searchParams.get("author");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  try {
    const now = Date.now();

    // Build query based on parameters
    let query = publicClient.buildQuery().where(eq("type", "story"));

    if (author) {
      query = query.where(eq("author", author));
    }

    // Only get non-expired stories
    const storiesQuery = query
      .withPayload(true)
      .withAttributes(true)
      .limit(limit);

    const queryResult = await storiesQuery.fetch();
    const storyResults = queryResult.entities || queryResult;

    if (!Array.isArray(storyResults)) {
      return NextResponse.json(
        { message: "Failed to fetch stories" },
        { status: 500 }
      );
    }

    // Convert to Story format and filter expired stories, fetch media data
    const stories: Story[] = [];
    
    for (const result of storyResults) {
      try {
        const payload = JSON.parse(new TextDecoder().decode(result.payload));
        const entityKey = result.key || payload.id;
        const expiresAt = payload.expires_at;
        
        // Skip expired stories
        if (expiresAt <= now) continue;
        
        const mediaId = payload.media_id;
        if (!mediaId) continue;

        // Fetch metadata for this story's media
        try {
          const metadataQuery = publicClient
            .buildQuery()
            .where(eq("type", "story_metadata"))
            .where(eq("media_id", mediaId))
            .withPayload(true)
            .limit(1);

          const metadataResult = await metadataQuery.fetch();
          const metadataEntities = metadataResult.entities || metadataResult;

          if (!Array.isArray(metadataEntities) || metadataEntities.length === 0) {
            console.warn(`Story ${entityKey}: metadata not found for media_id ${mediaId}`);
            continue;
          }

          const metadata = JSON.parse(
            new TextDecoder().decode(metadataEntities[0].payload)
          );

          // Fetch the media
          const mediaQuery = publicClient
            .buildQuery()
            .where(eq("type", "story_media"))
            .where(eq("media_id", mediaId))
            .withPayload(true)
            .limit(1);

          const mediaResult = await mediaQuery.fetch();
          const mediaEntities = mediaResult.entities || mediaResult;

          if (!Array.isArray(mediaEntities) || mediaEntities.length === 0 || !mediaEntities[0].payload) {
            console.warn(`Story ${entityKey}: media not found for media_id ${mediaId}`);
            continue;
          }

          // Convert to base64 data URL
          const mediaBuffer = Buffer.from(mediaEntities[0].payload);
          const mediaBase64 = mediaBuffer.toString("base64");
          const mediaDataUrl = `data:${metadata.content_type};base64,${mediaBase64}`;

          stories.push({
            id: entityKey,
            author: payload.author,
            media_id: mediaId,
            content: payload.content,
            created_at: payload.created_at,
            expires_at: expiresAt,
            views: payload.views || [],
            type: payload.type || "image",
            media: {
              dataUrl: mediaDataUrl,
              filename: metadata.filename,
              contentType: metadata.content_type,
              fileSize: metadata.file_size,
            },
          });
        } catch (mediaError) {
          console.error(`Error fetching media for story ${entityKey}:`, mediaError);
          // Continue with other stories even if one fails
          continue;
        }
      } catch (error) {
        console.error("Error processing story result:", error);
        // Continue with other stories
        continue;
      }
    }

    // Sort by newest first
    stories.sort((a, b) => b.created_at - a.created_at);

    // Group by author for story rings UI
    const storiesByAuthor = stories.reduce((acc, story) => {
      if (!acc[story.author]) {
        acc[story.author] = [];
      }
      acc[story.author].push(story);
      return acc;
    }, {} as Record<string, Story[]>);

    return NextResponse.json({
      success: true,
      stories,
      storiesByAuthor,
      total: stories.length,
    });
  } catch (error) {
    console.error("Story retrieval failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve stories.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

// DELETE /api/stories - Delete a story (author only)
export async function DELETE(request: NextRequest) {
  try {
    if (!walletClient) {
      return NextResponse.json(
        { message: walletClientInitError || "Wallet client not initialized" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const storyId = searchParams.get("story_id");
    const author = searchParams.get("author");

    if (!storyId || !author) {
      return NextResponse.json(
        { message: "story_id and author query parameters are required." },
        { status: 400 }
      );
    }

    // Check if storyId is a valid hex string (entity key) or custom string ID
    let entityKey: `0x${string}`;
    
    if (storyId.startsWith("0x") && /^0x[a-fA-F0-9]+$/.test(storyId)) {
      // It's a valid entity key (hex string) - use it directly
      entityKey = storyId as `0x${string}`;
    } else {
      // It's a custom string ID, need to query by it
      console.log(`Looking up story by custom ID: ${storyId} for author: ${author}`);
      
      const query = publicClient
        .buildQuery()
        .where(eq("type", "story"))
        .where(eq("author", author))
        .withPayload(true)
        .withAttributes(true)
        .limit(50);

      const queryResult = await query.fetch();
      const stories = queryResult.entities || queryResult;

      if (!Array.isArray(stories)) {
        console.error("Query result is not an array:", queryResult);
        return NextResponse.json(
          { message: "Story not found: Invalid query result." },
          { status: 404 }
        );
      }

      console.log(`Found ${stories.length} stories for author ${author}`);

      // Find the story by custom id in payload
      const foundStory = stories.find((story: any) => {
        if (!story.payload) return false;
        try {
          const payload = JSON.parse(new TextDecoder().decode(story.payload));
          return payload.id === storyId;
        } catch (e) {
          console.error("Error parsing story payload:", e);
          return false;
        }
      });

      if (!foundStory) {
        console.error(`Story with ID ${storyId} not found in query results`);
        return NextResponse.json(
          { message: `Story not found: No story with ID ${storyId} found for author ${author}.` },
          { status: 404 }
        );
      }

      // Extract entity key from result
      const extractedKey = foundStory.key;
      if (!extractedKey) {
        console.error("Story found but no entity key available:", foundStory);
        return NextResponse.json(
          { message: "Story entity key not found in query result." },
          { status: 404 }
        );
      }

      entityKey = extractedKey as `0x${string}`;
      console.log(`Found entity key for story ${storyId}: ${entityKey}`);
    }

    // Fetch existing story to verify ownership
    const existingStory = await publicClient.getEntity(entityKey);
    if (!existingStory || !existingStory.payload) {
      return NextResponse.json(
        { message: "Story not found." },
        { status: 404 }
      );
    }

    const storyData = JSON.parse(
      new TextDecoder().decode(existingStory.payload)
    );

    // Verify ownership
    if (storyData.author !== author) {
      return NextResponse.json(
        { message: "You can only delete your own stories." },
        { status: 403 }
      );
    }

    const deleteResult = await walletClient.deleteEntity({
      entityKey: entityKey,
    });

    await walletClient.waitForTransactionReceipt({ hash: deleteResult.txHash });

    return NextResponse.json({
      success: true,
      message: "Story deleted successfully.",
      txHash: deleteResult.txHash,
    });
  } catch (error) {
    console.error("Story deletion failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete story.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

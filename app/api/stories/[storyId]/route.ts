import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "@arkiv-network/sdk";
import { mendoza } from "@arkiv-network/sdk/chains";
import { eq } from "@arkiv-network/sdk/query";
import { Story } from "../../../types/api";
import { publicClient } from "../../../lib/arkiv";

// GET /api/stories/[storyId] - Get a specific story with media
export async function GET(
  request: NextRequest,
  { params }: { params: { storyId: string } }
) {
  const storyId = params.storyId;

  if (!storyId) {
    return NextResponse.json(
      { message: "Story ID is required." },
      { status: 400 }
    );
  }

  try {
    // 1. Fetch the story entity
    const storyEntity = await publicClient.getEntity(storyId as `0x${string}`);
    if (!storyEntity || !storyEntity.payload) {
      return NextResponse.json(
        { message: "Story not found." },
        { status: 404 }
      );
    }

    const storyData = JSON.parse(new TextDecoder().decode(storyEntity.payload));

    // Check if story has expired
    if (storyData.expires_at <= Date.now()) {
      return NextResponse.json(
        { message: "Story has expired." },
        { status: 404 }
      );
    }

    const mediaId = storyData.media_id;

    if (!mediaId) {
      return NextResponse.json(
        { message: "Story has no associated media." },
        { status: 400 }
      );
    }

    // 2. Fetch metadata
    const metadataQuery = publicClient
      .buildQuery()
      .where(eq("type", "story_metadata"))
      .where(eq("media_id", mediaId))
      .withPayload(true)
      .limit(1);

    const metadataResult = await metadataQuery.fetch();
    const metadataEntities = metadataResult.entities || metadataResult;

    if (!Array.isArray(metadataEntities) || metadataEntities.length === 0) {
      return NextResponse.json(
        { message: "Story metadata not found." },
        { status: 404 }
      );
    }

    const metadata = JSON.parse(
      new TextDecoder().decode(metadataEntities[0].payload)
    );

    // 3. Fetch the media
    const mediaQuery = publicClient
      .buildQuery()
      .where(eq("type", "story_media"))
      .where(eq("media_id", mediaId))
      .withPayload(true)
      .limit(1);

    const mediaResult = await mediaQuery.fetch();
    const mediaEntities = mediaResult.entities || mediaResult;

    if (
      !Array.isArray(mediaEntities) ||
      mediaEntities.length === 0 ||
      !mediaEntities[0].payload
    ) {
      return NextResponse.json(
        { message: "Story media not found." },
        { status: 404 }
      );
    }

    // 4. Convert to base64 data URL
    const mediaBuffer = Buffer.from(mediaEntities[0].payload);
    const mediaBase64 = mediaBuffer.toString("base64");
    const mediaDataUrl = `data:${metadata.content_type};base64,${mediaBase64}`;

    const story: Story = {
      id: storyData.id,
      author: storyData.author,
      media_id: mediaId,
      content: storyData.content,
      created_at: storyData.created_at,
      expires_at: storyData.expires_at,
      views: storyData.views || [],
      type: storyData.type || "image",
    };

    return NextResponse.json({
      success: true,
      story: {
        ...story,
        media: {
          dataUrl: mediaDataUrl,
          filename: metadata.filename,
          contentType: metadata.content_type,
          fileSize: metadata.file_size,
        },
      },
    });
  } catch (error) {
    console.error("Story retrieval failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve story.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

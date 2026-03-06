import { NextRequest, NextResponse } from "next/server";
import { eq } from "@arkiv-network/sdk/query";
import { publicClient } from "../../lib/arkiv";
import { createErrorResponse, createSuccessResponse } from "../../lib/api-helpers";

export const dynamic = 'force-dynamic';

// GET /api/stats - Get platform statistics
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();

    // Query profiles count
    const profilesQuery = publicClient
      .buildQuery()
      .where(eq("type", "profile"))
      .withAttributes(true)
      .limit(1000); // Max limit to get all profiles

    const profilesResult = await profilesQuery.fetch();
    const profileEntities = Array.isArray(profilesResult.entities) 
      ? profilesResult.entities 
      : Array.isArray(profilesResult) 
        ? profilesResult 
        : [];

    // Query posts count
    const postsQuery = publicClient
      .buildQuery()
      .where(eq("type", "post"))
      .withAttributes(true)
      .limit(1000); // Max limit to get all posts

    const postsResult = await postsQuery.fetch();
    const postEntities = Array.isArray(postsResult.entities)
      ? postsResult.entities
      : Array.isArray(postsResult)
        ? postsResult
        : [];

    // Calculate feed refresh latency (time taken to fetch this data)
    const latency = ((Date.now() - startTime) / 1000).toFixed(1);

    return NextResponse.json({
      success: true,
      stats: {
        profilesCount: profileEntities.length,
        postsCount: postEntities.length,
        feedLatency: `${latency}s`,
      },
    });
  } catch (error) {
    console.error("Stats retrieval failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve stats.";
    return createErrorResponse(message);
  }
}


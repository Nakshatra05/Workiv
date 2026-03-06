import { NextRequest, NextResponse } from "next/server";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";
import {
  walletClient,
  publicClient,
  walletClientInitError,
} from "../../../lib/arkiv";
import {
  validateWalletClient,
  createErrorResponse,
  createSuccessResponse,
} from "../../../lib/api-helpers";

export const dynamic = 'force-dynamic';

// POST - Flag a job listing
export async function POST(request: NextRequest) {
  const walletValidation = validateWalletClient(walletClient, walletClientInitError);
  if (walletValidation) return walletValidation;

  const client = walletClient!;

  try {
    const formData = await request.formData();
    const jobId = formData.get("job_id") as string;
    const flagger = formData.get("flagger") as string;

    if (!jobId || !flagger) {
      return createErrorResponse("job_id and flagger are required", 400);
    }

    // Get existing job
    const entity = await publicClient.getEntity(jobId as `0x${string}`);
    if (!entity || !entity.payload) {
      return createErrorResponse("Job listing not found", 404);
    }

    const existingPayload = JSON.parse(new TextDecoder().decode(entity.payload));
    
    // Check if user already flagged
    const flags = existingPayload.flags || [];
    if (flags.includes(flagger)) {
      return createErrorResponse("You have already flagged this listing", 400);
    }

    // Can't flag your own listing
    if (existingPayload.owner === flagger) {
      return createErrorResponse("You cannot flag your own listing", 400);
    }

    // Add flag
    flags.push(flagger);

    // Update payload
    const updatedPayload = {
      ...existingPayload,
      flags,
      updated_at: Date.now(),
      version: (existingPayload.version || 1) + 1,
    };

    // Calculate remaining TTL (approximate)
    const createdAt = existingPayload.created_at || Date.now();
    const expirationDays = existingPayload.expiration_days || 30;
    const expiresAt = createdAt + (expirationDays * 24 * 60 * 60 * 1000);
    const remainingMs = expiresAt - Date.now();
    const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));

    const result = await client.createEntity({
      payload: jsonToPayload(updatedPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "post" },
        { key: "owner", value: existingPayload.owner },
        { key: "media_id", value: existingPayload.media_id },
        { key: "previous_version", value: jobId },
        { key: "flag_count", value: String(flags.length) },
      ],
      expiresIn: ExpirationTime.fromDays(remainingDays),
    });

    await client.waitForTransactionReceipt({ hash: result.txHash });

    return createSuccessResponse({
      flagged: true,
      flagCount: flags.length,
      txHash: result.txHash,
    });
  } catch (error) {
    console.error("Flag operation failed:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to flag listing",
      500
    );
  }
}

// GET - Get flag count for a job listing
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("job_id");

  if (!jobId) {
    return createErrorResponse("job_id is required", 400);
  }

  try {
    const entity = await publicClient.getEntity(jobId as `0x${string}`);
    if (!entity || !entity.payload) {
      return createErrorResponse("Job listing not found", 404);
    }

    const payload = JSON.parse(new TextDecoder().decode(entity.payload));
    const flags = payload.flags || [];

    return createSuccessResponse({
      flagCount: flags.length,
      isFlagged: flags.length > 0,
    });
  } catch (error) {
    console.error("Get flags failed:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to get flag info",
      500
    );
  }
}

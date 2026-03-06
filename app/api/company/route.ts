import { NextRequest, NextResponse } from "next/server";
import { ExpirationTime, jsonToPayload } from "@arkiv-network/sdk/utils";
import { eq } from "@arkiv-network/sdk/query";
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
import { CompanyProfile } from "../../types/api";

export const dynamic = 'force-dynamic';

type CompanyPayload = {
  owner: string;
  name: string;
  description: string;
  industry: string;
  website?: string;
  logo?: string;
  location: string;
  size: "1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+";
  founded_year?: number;
  linkedin_url?: string;
  twitter_url?: string;
};

// GET - Fetch company profile by wallet or ID
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");
  const id = searchParams.get("id");

  if (!wallet && !id) {
    return createErrorResponse("Either wallet or id query parameter is required", 400);
  }

  try {
    let company: CompanyProfile | null = null;

    if (id) {
      // Fetch by entity ID
      const entity = await publicClient.getEntity(id as `0x${string}`);
      if (entity && entity.payload) {
        const payload = JSON.parse(new TextDecoder().decode(entity.payload));
        company = { id, ...payload };
      }
    } else if (wallet) {
      // Search by wallet
      const query = publicClient
        .buildQuery()
        .where(eq("type", "company_profile"))
        .where(eq("owner", wallet))
        .withPayload(true)
        .limit(1);

      const result = await query.fetch();
      if (result.entities && result.entities.length > 0) {
        const entity = result.entities[0];
        const payload = JSON.parse(new TextDecoder().decode(entity.payload));
        company = { id: entity.key, ...payload };
      }
    }

    if (!company) {
      return createErrorResponse("Company profile not found", 404);
    }

    return createSuccessResponse({ company });
  } catch (error) {
    console.error("Failed to fetch company profile:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to fetch company profile",
      500
    );
  }
}

// POST - Create company profile
export async function POST(request: NextRequest) {
  const walletValidation = validateWalletClient(walletClient, walletClientInitError);
  if (walletValidation) return walletValidation;

  const client = walletClient!;

  try {
    const formData = await request.formData();
    const body: CompanyPayload = {
      owner: formData.get("owner") as string,
      name: formData.get("name") as string,
      description: formData.get("description") as string,
      industry: formData.get("industry") as string,
      website: (formData.get("website") as string) || undefined,
      logo: (formData.get("logo") as string) || undefined,
      location: formData.get("location") as string,
      size: formData.get("size") as CompanyPayload["size"],
      founded_year: formData.get("founded_year") 
        ? parseInt(formData.get("founded_year") as string) 
        : undefined,
      linkedin_url: (formData.get("linkedin_url") as string) || undefined,
      twitter_url: (formData.get("twitter_url") as string) || undefined,
    };

    // Validate required fields
    if (!body.owner || !body.name || !body.description || !body.industry || !body.location || !body.size) {
      return createErrorResponse("owner, name, description, industry, location, and size are required", 400);
    }

    // Check if company profile already exists for this wallet
    const existingQuery = publicClient
      .buildQuery()
      .where(eq("type", "company_profile"))
      .where(eq("owner", body.owner))
      .limit(1);

    const existingResult = await existingQuery.fetch();
    if (existingResult.entities && existingResult.entities.length > 0) {
      return createErrorResponse("Company profile already exists for this wallet. Use PUT to update.", 409);
    }

    const timestamp = Date.now();
    const companyPayload = {
      ...body,
      created_at: timestamp,
      updated_at: timestamp,
      version: 1,
    };

    const result = await client.createEntity({
      payload: jsonToPayload(companyPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "company_profile" },
        { key: "owner", value: body.owner },
        { key: "name", value: body.name },
        { key: "industry", value: body.industry },
      ],
      expiresIn: ExpirationTime.fromDays(365), // Company profiles last 1 year
    });

    await client.waitForTransactionReceipt({ hash: result.txHash });

    return NextResponse.json(
      {
        success: true,
        companyId: result.entityKey,
        txHash: result.txHash,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Company profile creation failed:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to create company profile",
      500
    );
  }
}

// PUT - Update company profile
export async function PUT(request: NextRequest) {
  const walletValidation = validateWalletClient(walletClient, walletClientInitError);
  if (walletValidation) return walletValidation;

  const client = walletClient!;

  try {
    const formData = await request.formData();
    const companyId = formData.get("company_id") as string;
    const owner = formData.get("owner") as string;

    if (!companyId || !owner) {
      return createErrorResponse("company_id and owner are required", 400);
    }

    // Fetch existing company
    const entity = await publicClient.getEntity(companyId as `0x${string}`);
    if (!entity || !entity.payload) {
      return createErrorResponse("Company profile not found", 404);
    }

    const existingPayload = JSON.parse(new TextDecoder().decode(entity.payload));
    if (existingPayload.owner !== owner) {
      return createErrorResponse("You can only update your own company profile", 403);
    }

    // Update fields
    const updatedPayload = {
      ...existingPayload,
      name: (formData.get("name") as string) || existingPayload.name,
      description: (formData.get("description") as string) || existingPayload.description,
      industry: (formData.get("industry") as string) || existingPayload.industry,
      website: formData.has("website") ? (formData.get("website") as string) || undefined : existingPayload.website,
      logo: formData.has("logo") ? (formData.get("logo") as string) || undefined : existingPayload.logo,
      location: (formData.get("location") as string) || existingPayload.location,
      size: (formData.get("size") as string) || existingPayload.size,
      founded_year: formData.has("founded_year") 
        ? parseInt(formData.get("founded_year") as string) || undefined 
        : existingPayload.founded_year,
      linkedin_url: formData.has("linkedin_url") ? (formData.get("linkedin_url") as string) || undefined : existingPayload.linkedin_url,
      twitter_url: formData.has("twitter_url") ? (formData.get("twitter_url") as string) || undefined : existingPayload.twitter_url,
      updated_at: Date.now(),
      version: (existingPayload.version || 1) + 1,
    };

    const result = await client.createEntity({
      payload: jsonToPayload(updatedPayload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "company_profile" },
        { key: "owner", value: owner },
        { key: "name", value: updatedPayload.name },
        { key: "industry", value: updatedPayload.industry },
        { key: "previous_version", value: companyId },
      ],
      expiresIn: ExpirationTime.fromDays(365),
    });

    await client.waitForTransactionReceipt({ hash: result.txHash });

    return createSuccessResponse({
      companyId: result.entityKey,
      txHash: result.txHash,
    });
  } catch (error) {
    console.error("Company profile update failed:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Failed to update company profile",
      500
    );
  }
}

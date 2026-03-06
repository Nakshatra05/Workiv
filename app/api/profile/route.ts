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
import { ProfilePayload, CompleteProfilePayload } from "../../types/api";

export const dynamic = 'force-dynamic';

const isValidBody = (body: ProfilePayload): body is CompleteProfilePayload => {
  return (
    typeof body.wallet === "string" &&
    body.wallet.length > 0 &&
    typeof body.displayName === "string" &&
    body.displayName.trim().length > 0 &&
    typeof body.bio === "string" &&
    typeof body.avatar === "string" &&
    body.avatar.trim().length > 0
  );
};

const EXPIRATION_CHOICES = {
  oneMonth: () => ExpirationTime.fromMonths(1),
  threeMonths: () => ExpirationTime.fromMonths(3),
  sixMonths: () => ExpirationTime.fromMonths(6),
} as const;

export async function POST(request: NextRequest) {
  const walletValidation = validateWalletClient(
    walletClient,
    walletClientInitError
  );
  if (walletValidation) return walletValidation;

  // walletClient is now guaranteed to be non-null
  const client = walletClient!;

  let body: ProfilePayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!isValidBody(body)) {
    return NextResponse.json(
      { message: "wallet, displayName, bio, and avatar are required." },
      { status: 400 }
    );
  }

  const timestamp = Date.now();
  const expirationKey = body.expiresInKey ?? "sixMonths";
  const expirationFactory =
    EXPIRATION_CHOICES[expirationKey as keyof typeof EXPIRATION_CHOICES] ??
    EXPIRATION_CHOICES.sixMonths;
  const expiresIn = expirationFactory();

  const payload = {
    wallet: body.wallet,
    displayName: body.displayName.trim(),
    bio: body.bio.trim(),
    avatar: body.avatar.trim(),
    createdAt: timestamp,
    updatedAt: timestamp,
    version: 1,
  };

  try {
    const result = await client.createEntity({
      payload: jsonToPayload(payload),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "profile" },
        { key: "wallet", value: body.wallet },
      ],
      expiresIn,
    });

    return NextResponse.json({
      ...result,
      explorerUrl: `https://explorer.mendoza.hoodi.arkiv.network/entity/${result.entityKey}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Arkiv profile creation failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create profile.";
    return createErrorResponse(message);
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { message: "Wallet address is required as 'wallet' query parameter." },
      { status: 400 }
    );
  }

  try {
    // Query for profile by wallet address
    const profileQuery = publicClient
      .buildQuery()
      .where(eq("type", "profile"))
      .where(eq("wallet", wallet))
      .withPayload(true)
      .withAttributes(true)
      .limit(1);

    const queryResult = await profileQuery.fetch();
    const profileEntities = queryResult.entities || queryResult;

    if (!Array.isArray(profileEntities) || profileEntities.length === 0) {
      return NextResponse.json(
        { message: "Profile not found." },
        { status: 404 }
      );
    }

    const profileEntity = profileEntities[0];
    const profileData = JSON.parse(
      new TextDecoder().decode(profileEntity.payload)
    );

    return NextResponse.json({
      success: true,
      profile: {
        id: profileEntity.key,
        ...profileData,
      },
    }, { status: 200 });
  } catch (error) {
    console.error("Profile retrieval failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to retrieve profile.";
    return createErrorResponse(message);
  }
}

export async function PUT(request: NextRequest) {
  const walletValidation = validateWalletClient(
    walletClient,
    walletClientInitError
  );
  if (walletValidation) return walletValidation;

  // walletClient is now guaranteed to be non-null
  const client = walletClient!;

  let body: Partial<ProfilePayload>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.wallet || typeof body.wallet !== "string") {
    return NextResponse.json(
      { message: "wallet is required." },
      { status: 400 }
    );
  }

  try {
    // First, find the existing profile
    const profileQuery = publicClient
      .buildQuery()
      .where(eq("type", "profile"))
      .where(eq("wallet", body.wallet))
      .withPayload(true)
      .withAttributes(true)
      .limit(1);

    const queryResult = await profileQuery.fetch();
    const profileEntities = queryResult.entities || queryResult;

    if (!Array.isArray(profileEntities) || profileEntities.length === 0) {
      return NextResponse.json(
        { message: "Profile not found." },
        { status: 404 }
      );
    }

    const existingProfile = profileEntities[0];
    const existingData = JSON.parse(
      new TextDecoder().decode(existingProfile.payload)
    );

    // Update the profile data
    const updatedData = {
      ...existingData,
      displayName: body.displayName?.trim() ?? existingData.displayName,
      bio: body.bio?.trim() ?? existingData.bio,
      avatar: body.avatar?.trim() ?? existingData.avatar,
      updatedAt: Date.now(),
      version: (existingData.version || 1) + 1,
    };

    // Validate updated data
    if (
      !updatedData.displayName ||
      updatedData.displayName.trim().length === 0 ||
      !updatedData.avatar ||
      updatedData.avatar.trim().length === 0
    ) {
      return NextResponse.json(
        { message: "displayName and avatar cannot be empty." },
        { status: 400 }
      );
    }

    // Delete the old profile entity
    const deleteResult = await client.deleteEntity({
      entityKey: existingProfile.key as `0x${string}`,
    });
    await client.waitForTransactionReceipt({ hash: deleteResult.txHash });

    // Create new profile entity with updated data
    const expirationKey = body.expiresInKey ?? "sixMonths";
    const expirationFactory =
      EXPIRATION_CHOICES[expirationKey as keyof typeof EXPIRATION_CHOICES] ??
      EXPIRATION_CHOICES.sixMonths;
    const expiresIn = expirationFactory();

    const createResult = await client.createEntity({
      payload: jsonToPayload(updatedData),
      contentType: "application/json",
      attributes: [
        { key: "type", value: "profile" },
        { key: "wallet", value: body.wallet },
      ],
      expiresIn,
    });

    return NextResponse.json(
      {
        success: true,
        profileId: createResult.entityKey,
        txHash: createResult.txHash,
        message: "Profile updated successfully.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Profile update failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to update profile.";
    return createErrorResponse(message);
  }
}

export async function DELETE(request: NextRequest) {
  const walletValidation = validateWalletClient(
    walletClient,
    walletClientInitError
  );
  if (walletValidation) return walletValidation;

  // walletClient is now guaranteed to be non-null
  const client = walletClient!;

  const { searchParams } = new URL(request.url);
  const wallet = searchParams.get("wallet");

  if (!wallet) {
    return NextResponse.json(
      { message: "Wallet address is required as 'wallet' query parameter." },
      { status: 400 }
    );
  }

  try {
    // Find all profiles for this wallet address
    const profileQuery = publicClient
      .buildQuery()
      .where(eq("type", "profile"))
      .where(eq("wallet", wallet))
      .withPayload(true)
      .withAttributes(true)
      .limit(100); // Increased limit to get all profiles

    const queryResult = await profileQuery.fetch();
    const profileEntities = queryResult.entities || queryResult;

    if (!Array.isArray(profileEntities) || profileEntities.length === 0) {
      return NextResponse.json(
        { message: "No profiles found for this wallet address." },
        { status: 404 }
      );
    }

    // Delete all profiles associated with this wallet sequentially
    // to avoid "replacement transaction underpriced" errors from concurrent transactions
    const deleteResults = [];
    for (const profileEntity of profileEntities) {
      const deleteResult = await client.deleteEntity({
        entityKey: profileEntity.key as `0x${string}`,
      });
      // Wait for transaction to be confirmed before proceeding to next deletion
      await client.waitForTransactionReceipt({ hash: deleteResult.txHash });
      deleteResults.push(deleteResult);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${profileEntities.length} profile(s).`,
      deletedCount: profileEntities.length,
      txHashes: deleteResults.map((result) => result.txHash),
    });
  } catch (error) {
    console.error("Profile deletion failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete profiles.";
    return createErrorResponse(message);
  }
}

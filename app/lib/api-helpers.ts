import { NextResponse } from "next/server";

export function validateWalletClient(
  walletClient: any,
  error: string | null
): NextResponse | null {
  if (!walletClient) {
    return NextResponse.json(
      { message: error ?? "Server wallet is not configured." },
      { status: 500 }
    );
  }
  return null;
}

export function createErrorResponse(message: string, status = 500) {
  return NextResponse.json({ message }, { status });
}

export function createSuccessResponse(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

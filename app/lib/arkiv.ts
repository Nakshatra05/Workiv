import {
  createWalletClient,
  createPublicClient,
  http,
} from "@arkiv-network/sdk";
import { privateKeyToAccount } from "@arkiv-network/sdk/accounts";
import { mendoza } from "@arkiv-network/sdk/chains";

export const normalizePrivateKey = (
  value?: string | null
): `0x${string}` | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    return trimmed as `0x${string}`;
  }
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return `0x${trimmed}` as `0x${string}`;
  }
  return null;
};

const rawPrivateKey = process.env.ARKIV_PRIVATE_KEY;
export const normalizedPrivateKey = normalizePrivateKey(rawPrivateKey);

export let walletClientInitError: string | null = null;

if (!rawPrivateKey) {
  walletClientInitError =
    "ARKIV_PRIVATE_KEY is not set. API endpoints will fail until configured.";
  console.warn(walletClientInitError);
} else if (!normalizedPrivateKey) {
  walletClientInitError =
    "ARKIV_PRIVATE_KEY must be a 32-byte hex string (with or without 0x prefix).";
  console.error(walletClientInitError);
}

export const walletClient =
  normalizedPrivateKey &&
  createWalletClient({
    chain: mendoza,
    transport: http(),
    account: privateKeyToAccount(normalizedPrivateKey),
  });

export const publicClient = createPublicClient({
  chain: mendoza,
  transport: http(),
});

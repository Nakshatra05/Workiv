"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { createWalletClient, custom } from "@arkiv-network/sdk";
import { mendoza } from "@arkiv-network/sdk/chains";

// Define Ethereum provider interface to avoid dependency on @metamask/providers
interface EthereumProvider {
  request(args: { method: string; params?: any[] }): Promise<any>;
  on(event: string, handler: (...args: any[]) => void): void;
  removeListener(event: string, handler: (...args: any[]) => void): void;
}

type WalletContextValue = {
  account: string | null;
  shortAccount: string | null;
  walletClient: ReturnType<typeof createWalletClient> | null;
  isConnecting: boolean;
  connectError: string | null;
  connectWallet: () => Promise<boolean>;
};

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

const STORAGE_KEY = "workiv-account";

const getEthereumProvider = (): EthereumProvider => {
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("MetaMask is required to connect.");
  }
  return (window as any).ethereum as EthereumProvider;
};

const ensureArkivNetwork = async (provider: EthereumProvider) => {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: "0xe0087f840" }],
    });
  } catch (error: any) {
    if (error?.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xe0087f840",
            chainName: "Arkiv Mendoza Testnet",
            nativeCurrency: {
              name: "ETH",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://mendoza.hoodi.arkiv.network/rpc"],
            blockExplorerUrls: ["https://explorer.mendoza.hoodi.arkiv.network"],
          },
        ],
      });
    } else {
      throw error;
    }
  }
};

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletClient, setWalletClient] = useState<ReturnType<
    typeof createWalletClient
  > | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const connectWallet = useCallback(async () => {
    setConnectError(null);
    setIsConnecting(true);
    try {
      const provider = getEthereumProvider();
      await ensureArkivNetwork(provider);
      const accounts = (await provider.request({
        method: "eth_requestAccounts",
      })) as string[];

      if (!accounts || accounts.length === 0) {
        throw new Error("No wallet accounts returned.");
      }

      const client = createWalletClient({
        chain: mendoza,
        transport: custom(provider),
      });

      setWalletClient(client);
      setAccount(accounts[0]);
      window.localStorage.setItem(STORAGE_KEY, accounts[0]);
      return true;
    } catch (error) {
      console.error("Wallet connection failed:", error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to connect wallet. Please try again.";
      setConnectError(message);
      return false;
    } finally {
      setIsConnecting(false);
    }
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const provider = (window as any).ethereum as EthereumProvider | undefined;
    if (!provider) return;

    const handleAccountsChanged = (accounts: unknown) => {
      if (
        !Array.isArray(accounts) ||
        !accounts.every((acc) => typeof acc === "string")
      )
        return;
      const stringAccounts = accounts as string[];
      if (!stringAccounts.length) {
        setAccount(null);
        setWalletClient(null);
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }
      setAccount(stringAccounts[0]);
      window.localStorage.setItem(STORAGE_KEY, stringAccounts[0]);
    };

    provider.on?.("accountsChanged", handleAccountsChanged);

    const attemptAutoConnect = async () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      try {
        // Use eth_accounts instead of eth_requestAccounts to avoid MetaMask prompt
        // Only check if accounts are already connected
        const accounts = (await provider.request({
          method: "eth_accounts",
        })) as string[];

        if (!accounts || !accounts.length) {
          window.localStorage.removeItem(STORAGE_KEY);
          return;
        }

        // Check if the stored account matches one of the connected accounts
        if (!accounts.includes(stored)) {
          window.localStorage.removeItem(STORAGE_KEY);
          return;
        }

        // Don't call ensureArkivNetwork during auto-connect to avoid MetaMask popup
        // Network switching will happen when user explicitly connects
        const client = createWalletClient({
          chain: mendoza,
          transport: custom(provider),
        });

        setWalletClient(client);
        setAccount(accounts[0]);
      } catch (error) {
        console.error("Auto-connect failed:", error);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    };

    attemptAutoConnect();

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
    };
  }, []);

  const shortAccount = useMemo(() => {
    if (!account) return null;
    return `${account.slice(0, 6)}...${account.slice(-4)}`;
  }, [account]);

  return (
    <WalletContext.Provider
      value={{
        account,
        shortAccount,
        walletClient,
        isConnecting,
        connectError,
        connectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return context;
};

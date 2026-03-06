"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "@/context/WalletContext";
import { CreatePostModal } from "@/components/CreatePostModal";

type HeaderBarProps = {
  connectedLabel?: string;
  disconnectedLabel?: string;
  connectingLabel?: string;
  onConnected?: () => void;
  onConnectSuccess?: () => void;
  showCopyPill?: boolean;
  showButton?: boolean;
  showButtonWhenConnected?: boolean;
};

export function HeaderBar({
  connectedLabel = "Wallet connected",
  disconnectedLabel = "Connect wallet",
  connectingLabel = "Connecting...",
  onConnected,
  onConnectSuccess,
  showCopyPill = true,
  showButton = true,
  showButtonWhenConnected = false,
}: HeaderBarProps) {
  const {
    account,
    shortAccount,
    connectWallet,
    isConnecting,
  } = useWallet();
  
  const pathname = usePathname();
  const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);

  const handlePrimary = useCallback(async () => {
    if (account) {
      onConnected?.();
      return;
    }
    const success = await connectWallet();
    if (success) {
      onConnectSuccess?.();
    }
  }, [account, connectWallet, onConnected, onConnectSuccess]);

  const shouldShowButton =
    showButton && (!account || showButtonWhenConnected);

  const buttonLabel = account
    ? connectedLabel
    : isConnecting
      ? connectingLabel
      : disconnectedLabel;

  const buttonDisabled = account ? false : isConnecting;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-[32px] border-2 border-[var(--ink)] bg-[var(--surface)] px-6 py-4 shadow-[10px_10px_0_rgba(0,0,0,0.18)]">
        <Link href="/" className="neo-pill text-lg font-semibold uppercase tracking-wide hover:scale-105 transition-transform">
          Workiv
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <nav className="flex flex-wrap items-center gap-2">
          <Link
            href="/feed"
            className="neo-pill text-xs font-semibold transition-transform hover:scale-105 bg-[var(--surface)] text-[var(--ink)]"
          >
            Jobs
          </Link>
            <Link
              href="/profile"
              className={`neo-pill text-xs font-semibold transition-transform hover:scale-105 ${
                pathname === "/feed"
                  ? "bg-[var(--surface)] text-[var(--ink)]"
                  : pathname === "/profile"
                    ? "bg-[var(--accent)] text-[var(--ink)]"
                    : "bg-[var(--surface)] text-[var(--ink)]"
              }`}
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={() => {
                if (account) {
                  setIsCreatePostModalOpen(true);
                } else {
                  connectWallet();
                }
              }}
              className="neo-pill text-xs font-semibold transition-transform hover:scale-105 bg-[var(--surface)] text-[var(--ink)]"
            >
              Post Job
            </button>
            <Link
              href="/stories"
              className={`neo-pill text-xs font-semibold transition-transform hover:scale-105 ${
                pathname === "/feed"
                  ? "bg-[var(--surface)] text-[var(--ink)]"
                  : pathname === "/stories"
                    ? "bg-[var(--accent)] text-[var(--ink)]"
                    : "bg-[var(--surface)] text-[var(--ink)]"
              }`}
            >
              Featured
            </Link>
          </nav>
        {showCopyPill && shortAccount && (
          <button
            type="button"
            className="neo-pill text-sm font-semibold"
            onClick={() => {
              if (!account) return;
              navigator.clipboard
                ?.writeText(account)
                .catch((err) => console.error("Copy failed:", err));
            }}
          >
            {shortAccount}
          </button>
        )}
        {shouldShowButton && (
          <button
            type="button"
            className="neo-button bg-[var(--accent)] text-[var(--ink)] disabled:opacity-60"
            onClick={handlePrimary}
            disabled={buttonDisabled}
          >
            {buttonLabel}
          </button>
        )}
        </div>
      </header>
      <CreatePostModal
        isOpen={isCreatePostModalOpen}
        onClose={() => setIsCreatePostModalOpen(false)}
        onPostCreated={() => {
          setIsCreatePostModalOpen(false);
          // Trigger a custom event to refresh feed if needed
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("postCreated"));
          }
        }}
      />
    </>
  );
}


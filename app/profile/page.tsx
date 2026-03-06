"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWallet } from "@/context/WalletContext";
import { HeaderBar } from "@/components/HeaderBar";
import { Toast } from "@/components/Toast";
import { profileApi } from "@/lib/api-client";

export const dynamic = 'force-dynamic';

export default function ProfilePage() {
  const router = useRouter();
  const { account, shortAccount, connectError } = useWallet();

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("Looking for opportunities in the decentralized ecosystem");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [expiryChoice, setExpiryChoice] = useState("sixMonths");
  const [submitting, setSubmitting] = useState(false);
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(
    null
  );
  const [entityKey, setEntityKey] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [showGoToFeed, setShowGoToFeed] = useState(false);
  const [showTransition, setShowTransition] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [existingProfile, setExistingProfile] = useState<any | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);
  const hasCheckedProfile = useRef(false);


  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setSubmissionMessage("Image too large (max 25MB)");
      return;
    }

    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      setSubmissionMessage("Only JPEG, PNG, GIF, and WebP images are supported");
      return;
    }

    setAvatarFile(file);
    setSubmissionMessage(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setSubmissionMessage(null);
      setEntityKey(null);

      if (!account) {
        setSubmissionMessage("Connect your wallet before creating a profile.");
        return;
      }

      if (!displayName.trim()) {
        setSubmissionMessage("Username is required.");
        return;
      }

      if (!avatarFile) {
        setSubmissionMessage("Please select an avatar image.");
        return;
      }

      setSubmitting(true);
      try {
        // Convert image to base64 data URL
        const avatarDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(avatarFile);
        });

        const timestamp = Date.now();
        const requestBody = {
          wallet: account,
          displayName: displayName.trim(),
          bio: bio.trim(),
          avatar: avatarDataUrl,
          expiresInKey: expiryChoice,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
        };

        const response = await fetch("/api/profile", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          throw new Error(errorBody?.message || "Failed to create profile.");
        }

        const data = (await response.json()) as {
          entityKey: string;
          txHash: string;
          explorerUrl?: string;
        };

        setEntityKey(data.entityKey);
        setExplorerUrl(data.explorerUrl || `https://explorer.mendoza.hoodi.arkiv.network/entity/${data.entityKey}`);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("workiv-latest-entity", data.entityKey);
        }
        setSubmissionMessage(
          `Profile created successfully! Tx: ${data.txHash}`
        );
        
        // Refresh profile to show dashboard
        setTimeout(async () => {
          try {
            const response = await profileApi.getProfileByWallet(account);
            if (response.success && response.profile) {
              setExistingProfile(response.profile);
              setEntityKey(null);
              setExplorerUrl(null);
              setShowGoToFeed(false);
              setAvatarFile(null);
              setAvatarPreview(null);
            }
          } catch (error) {
            console.error("Failed to refresh profile:", error);
          }
        }, 2000);
      } catch (error) {
        console.error("Profile submission failed:", error);
        const message =
          error instanceof Error
            ? error.message
            : "Unable to create profile. Please try again.";
        setSubmissionMessage(message);
      } finally {
        setSubmitting(false);
      }
    },
    [account, avatarFile, bio, displayName, expiryChoice]
  );

  const handleGoToFeed = useCallback(() => {
    setShowTransition(true);
    setTimeout(() => {
      router.push("/feed");
    }, 1200);
  }, [router]);

  // Check if profile already exists
  useEffect(() => {
    // Reset check flag when account changes or component mounts
    hasCheckedProfile.current = false;
    
    const checkExistingProfile = async () => {
      // Prevent multiple checks
      if (hasCheckedProfile.current) {
        return;
      }

      if (!account) {
        setCheckingProfile(false);
        hasCheckedProfile.current = true; // Mark as checked even without account
        return;
      }

      hasCheckedProfile.current = true;

      try {
        setCheckingProfile(true);
        const response = await profileApi.getProfileByWallet(account);
        
        if (response.success && response.profile) {
          // Profile exists, show dashboard
          setExistingProfile(response.profile);
          setCheckingProfile(false);
        } else {
          // Profile doesn't exist, allow creation
          setExistingProfile(null);
          setCheckingProfile(false);
        }
      } catch (error) {
        // If profile not found (404), allow creation
        setExistingProfile(null);
        setCheckingProfile(false);
      }
    };

    checkExistingProfile();
  }, [account]);

  const handleDeleteProfile = useCallback(async () => {
    if (!account || !existingProfile) return;

    if (!confirm("Are you sure you want to delete your profile? This action cannot be undone.")) {
      return;
    }

    setDeletingProfile(true);
    try {
      const response = await profileApi.deleteProfile(account);
      if (response.success) {
        setToastMessage("Profile deleted successfully!");
        setExistingProfile(null);
        setTimeout(() => {
          router.push("/");
        }, 2000);
      } else {
        setToastMessage(response.message || "Failed to delete profile");
      }
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : "Failed to delete profile");
    } finally {
      setDeletingProfile(false);
    }
  }, [account, existingProfile, router]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] px-6 py-12 text-[var(--ink)]">
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="info"
          duration={3000}
          onClose={() => setToastMessage(null)}
        />
      )}
      {showTransition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md">
          <div className="neo-card flex flex-col items-center gap-4 p-8 text-center">
            <div className="h-14 w-14 animate-spin rounded-full border-4 border-[var(--ink)] border-t-transparent" />
            <p className="text-lg font-semibold text-[var(--ink)]">
              finalizing profile...
            </p>
            <p className="text-sm text-[var(--muted-ink)]">
              Hang tight while we launch your job board dashboard.
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto flex max-w-4xl flex-col gap-8">
        <HeaderBar
          connectedLabel="Wallet connected"
          disconnectedLabel="Connect wallet"
          connectingLabel="Connecting..."
          showCopyPill
        />

        <header className="neo-card flex flex-col gap-3 p-8">
          <div className="flex flex-wrap items-center gap-3">
            <p className="neo-pill inline-flex bg-[var(--accent)] text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ink)]">
              Professional profile
            </p>
          </div>
          <h1 className="text-4xl font-black">Create your Workiv identity</h1>
          <p className="text-lg text-[var(--muted-ink)]">
            Connect your wallet, claim your professional identity, and push your profile
            to Arkiv as a verifiable entity.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2 text-sm text-[var(--muted-ink)]">
            {account ? (
              <span className="neo-pill bg-[var(--surface)] text-[var(--ink)]">
                Connected: {shortAccount}
              </span>
            ) : (
              <span>Use the nav button above to connect your wallet.</span>
            )}
            {connectError && (
              <span className="text-red-600 font-semibold">{connectError}</span>
            )}
          </div>
        </header>

        {checkingProfile ? (
          <div className="neo-card p-8 text-center">
            <div className="h-14 w-14 mx-auto mb-4 animate-spin rounded-full border-4 border-[var(--ink)] border-t-transparent" />
            <p className="text-lg font-semibold text-[var(--ink)]">
              Checking for existing profile...
            </p>
          </div>
        ) : existingProfile ? (
          <>
            {/* Profile Dashboard */}
            <div className="neo-card space-y-6 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <p className="neo-pill inline-flex bg-[var(--accent)] text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ink)]">
                    Profile Dashboard
                  </p>
                  <h1 className="text-4xl font-black mt-3">Your Workiv Profile</h1>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteProfile}
                  disabled={deletingProfile}
                  className="neo-button bg-red-500 text-white disabled:opacity-50"
                >
                  {deletingProfile ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Deleting...
                    </span>
                  ) : (
                    "Delete Profile"
                  )}
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="neo-card bg-[var(--surface)] p-6 space-y-4">
                  <h3 className="text-lg font-semibold uppercase tracking-wide">
                    Profile Details
                  </h3>
                  
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Username
                    </label>
                    <p className="text-lg font-semibold text-[var(--ink)] mt-1">
                      {existingProfile.displayName}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Bio
                    </label>
                    <p className="text-base text-[var(--ink)] mt-1">
                      {existingProfile.bio || "No bio set"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Avatar
                    </label>
                    {existingProfile.avatar ? (
                      <p className="text-xs text-[var(--muted-ink)] mt-1">
                        Image uploaded
                      </p>
                    ) : (
                      <p className="text-sm text-[var(--muted-ink)] mt-1">
                        No avatar set
                      </p>
                    )}
                    {existingProfile.avatar && (
                      <div className="mt-3 rounded-xl overflow-hidden border-2 border-[var(--ink)] shadow-[4px_4px_0_rgba(0,0,0,0.18)] max-w-xs">
                        <img
                          src={existingProfile.avatar}
                          alt={existingProfile.displayName}
                          className="w-full h-auto object-cover max-h-64"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Wallet Address
                    </label>
                    <p className="text-sm text-[var(--muted-ink)] font-mono mt-1">
                      {existingProfile.wallet || account}
                    </p>
                  </div>
                </div>

                <div className="neo-card bg-[var(--surface)] p-6 space-y-4">
                  <h3 className="text-lg font-semibold uppercase tracking-wide">
                    Metadata
                  </h3>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Entity Key
                    </label>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-[var(--muted-ink)] font-mono break-all">
                        {existingProfile.id || "N/A"}
                      </p>
                      {existingProfile.id && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(existingProfile.id);
                            setToastMessage("Entity key copied!");
                          }}
                          className="neo-pill text-xs bg-[var(--accent)] text-[var(--ink)]"
                        >
                          Copy
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Explorer Link
                    </label>
                    {existingProfile.id && (
                      <a
                        href={`https://explorer.mendoza.hoodi.arkiv.network/entity/${existingProfile.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neo-pill bg-[var(--accent)] text-xs font-semibold inline-flex items-center gap-2 hover:scale-105 transition-transform mt-2"
                      >
                        🔗 View on Explorer
                      </a>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Created At
                    </label>
                    <p className="text-sm text-[var(--ink)] mt-1">
                      {existingProfile.createdAt
                        ? formatDate(existingProfile.createdAt)
                        : "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Last Updated
                    </label>
                    <p className="text-sm text-[var(--ink)] mt-1">
                      {existingProfile.updatedAt
                        ? formatDate(existingProfile.updatedAt)
                        : "N/A"}
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                      Version
                    </label>
                    <p className="text-sm text-[var(--ink)] mt-1">
                      {existingProfile.version || 1}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="neo-card space-y-6 p-8">
            <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Username
            </label>
            <input
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              placeholder="Name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Bio
            </label>
            <textarea
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Avatar Image
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
            />
            {avatarPreview && (
              <div className="mt-4 rounded-xl overflow-hidden border-2 border-[var(--ink)] shadow-[6px_6px_0_rgba(0,0,0,0.18)] max-w-xs">
                <img
                  src={avatarPreview}
                  alt="Avatar preview"
                  className="w-full h-auto object-cover max-h-64"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Profile lifetime
            </label>
            <select
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              value={expiryChoice}
              onChange={(event) => setExpiryChoice(event.target.value)}
            >
              <option value="oneMonth">1 month</option>
              <option value="threeMonths">3 months</option>
              <option value="sixMonths">6 months</option>
            </select>
            <p className="mt-2 text-sm text-[var(--muted-ink)]">
              Adjust how long this entity should live on Arkiv. You can extend it
              later via an update call if needed.
            </p>
          </div>

          <button
            type="submit"
            className={`neo-button bg-[var(--accent)] text-[var(--ink)] disabled:opacity-50 ${
              submitting ? "animate-pulse" : ""
            }`}
            disabled={submitting || !avatarFile}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
                Uploading...
              </span>
            ) : (
              "Create profile entity"
            )}
          </button>

          {submissionMessage && (
            <p className="text-sm font-semibold text-[var(--ink)]">
              {submissionMessage}
            </p>
          )}
          {entityKey && explorerUrl && (
            <div className="neo-card p-4 bg-[var(--accent)] border-2 border-[var(--ink)] shadow-[6px_6px_0_rgba(0,0,0,0.18)] space-y-3">
              <p className="text-sm font-semibold text-[var(--ink)]">
                Profile entity created!
              </p>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="neo-pill bg-[var(--surface)] text-xs font-semibold inline-flex items-center gap-2 hover:scale-105 transition-transform"
              >
                🔗 View on Explorer
                <span className="text-[var(--muted-ink)] font-mono">
                  {entityKey.slice(0, 6)}...{entityKey.slice(-4)}
                </span>
              </a>
              {showGoToFeed && (
                <button
                  type="button"
                  onClick={handleGoToFeed}
                  className="neo-button bg-[var(--surface)] text-[var(--ink)] w-full mt-3"
                >
                  Go to Feed
                </button>
              )}
            </div>
          )}
            </form>

            <div className="flex items-center justify-between text-sm">
              <Link
                href="/"
                className="text-sm font-semibold uppercase tracking-[0.2em]"
              >
                ← Back to landing
              </Link>
              <span className="text-[var(--muted-ink)]">
                Profiles live for the duration you choose. Extend or update anytime
                with the entity key.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


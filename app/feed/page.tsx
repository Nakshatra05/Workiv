"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeaderBar } from "@/components/HeaderBar";
import { CommentsSection } from "@/components/CommentsSection";
import { ApplyToJobModal } from "@/components/ApplyToJobModal";
import { Toast } from "@/components/Toast";
import { feedApi, postApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { Post } from "@/app/types/api";

export const dynamic = 'force-dynamic';

function FeedContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { account, connectWallet } = useWallet();
  const [entityKey, setEntityKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("info");
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    const fromQuery = searchParams.get("entity");
    if (fromQuery) {
      setEntityKey(fromQuery);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem("workiv-latest-entity", fromQuery);
      }
      router.replace("/feed");
      return;
    }

    if (typeof window !== "undefined") {
      const stored = window.sessionStorage.getItem("workiv-latest-entity");
      if (stored) {
        setEntityKey(stored);
      }
    }
  }, [router, searchParams]);

  // Load feed function
  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      const response = await feedApi.getFeed(20);
      if (response.success && response.posts) {
        setPosts(response.posts);
      } else if (response.data?.posts) {
        setPosts(response.data.posts);
      } else {
        setError(response.message || "Failed to load feed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load feed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load initial feed
  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  // Listen for post created event to refresh feed
  useEffect(() => {
    const handlePostCreated = () => {
      loadFeed();
    };

    window.addEventListener("postCreated", handlePostCreated);
    return () => {
      window.removeEventListener("postCreated", handlePostCreated);
    };
  }, [loadFeed]);

  // Subscribe to real-time feed updates
  useEffect(() => {
    const unsubscribe = feedApi.subscribeRealtime(
      (newPost) => {
        setPosts((prev) => {
          // Avoid duplicates
          const exists = prev.some((p) => p.id === newPost.id);
          if (exists) return prev;
          // Add new post at the beginning
          return [newPost, ...prev];
        });
      },
      (error) => {
        console.error("Real-time feed error:", error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  const trimmedEntity = useMemo(() => {
    if (!entityKey || entityKey.length < 10) return entityKey;
    return `${entityKey.slice(0, 6)}...${entityKey.slice(-4)}`;
  }, [entityKey]);

  const handleCopy = async () => {
    if (
      !entityKey ||
      typeof navigator === "undefined" ||
      !navigator.clipboard
    ) {
      return;
    }
    try {
      await navigator.clipboard.writeText(entityKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Copy failed:", error);
    }
  };

  const handleLike = async (postId: string) => {
    if (!account) {
      alert("Please connect your wallet to like posts");
      return;
    }
    // TODO: Implement like functionality via API
    console.log("Like post:", postId);
  };

  const handleDeletePost = useCallback(async (postId: string) => {
    if (!account) return;

    setDeleting(true);
    try {
      await postApi.deletePost(postId, account);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setPostToDelete(null);
      setToastMessage("Post deleted successfully!");
      setToastType("success");
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to delete post");
      setToastType("error");
    } finally {
      setDeleting(false);
    }
  }, [account]);

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  return (
    <div className="min-h-screen bg-[var(--page-bg)] px-6 py-12 text-[var(--ink)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <HeaderBar
          connectedLabel="Wallet connected"
          disconnectedLabel="Connect wallet"
          connectingLabel="Connecting..."
          showCopyPill
          showButton={false}
        />

        <header className="neo-card flex flex-col gap-4 p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {trimmedEntity && (
              <button
                type="button"
                onClick={handleCopy}
                className="neo-pill bg-[var(--surface)] text-xs font-semibold uppercase tracking-[0.3em] text-[var(--ink)]"
                title="Copy entity key"
              >
                {copied ? "copied!" : trimmedEntity}
              </button>
            )}
          </div>
          <h1 className="text-4xl font-black">Job Board</h1>
          <p className="text-lg text-[var(--muted-ink)]">
            Browse decentralized job listings powered by Arkiv.
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Link href="/" className="neo-pill bg-[var(--surface)]">
              ← Back home
            </Link>
            <Link href="/profile" className="neo-pill bg-[var(--surface)]">
              My Profile
            </Link>
            <Link href="/stories" className="neo-pill bg-[var(--surface)]">
              Featured Jobs
            </Link>
          </div>
        </header>

        {loading && (
          <div className="neo-card p-8 text-center">
            <p className="text-lg text-[var(--muted-ink)]">Loading jobs...</p>
          </div>
        )}

        {error && (
          <div className="neo-card p-8">
            <p className="text-red-600 font-semibold">Error: {error}</p>
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="neo-card p-8 text-center">
            <p className="text-lg text-[var(--muted-ink)]">
              No jobs posted yet. Be the first to post one!
            </p>
          </div>
        )}

        <div className="space-y-4">
          {posts.map((post) => (
            <article
              key={post.id}
              className="neo-card flex flex-col gap-3 p-4 md:p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="neo-pill text-xs font-semibold">
                    {post.owner.slice(0, 6)}...{post.owner.slice(-4)}
                  </div>
                  <span className="text-xs text-[var(--muted-ink)]">
                    {formatDate(post.created_at)}
                  </span>
                </div>
                {account === post.owner && (
                  <div className="flex items-center gap-2">
                    {postToDelete === post.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleDeletePost(post.id)}
                          disabled={deleting}
                          className="text-xs text-red-600 font-semibold disabled:opacity-50"
                        >
                          {deleting ? "Deleting..." : "Confirm"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPostToDelete(null)}
                          disabled={deleting}
                          className="text-xs text-[var(--muted-ink)] font-semibold disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-red-600 font-semibold"
                        onClick={() => setPostToDelete(post.id)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>

              {post.image?.dataUrl && (
                <div className="w-full flex justify-center">
                  <div className="max-w-md w-full rounded-xl overflow-hidden border-2 border-[var(--ink)] shadow-[4px_4px_0_rgba(0,0,0,0.18)]">
                    <img
                      src={post.image.dataUrl}
                      alt={post.caption || "Job listing image"}
                      className="w-full h-auto object-cover max-h-96"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {account === post.owner && (
                  <button
                    type="button"
                    onClick={async () => {
                      const newCaption = prompt("Edit job description:", post.caption);
                      if (newCaption && newCaption !== post.caption) {
                        try {
                          await postApi.updatePost(post.id, post.owner, newCaption);
                          setPosts((prev) =>
                            prev.map((p) =>
                              p.id === post.id ? { ...p, caption: newCaption } : p
                            )
                          );
                        } catch (err) {
                          alert(err instanceof Error ? err.message : "Failed to update job");
                        }
                      }
                    }}
                    className="text-xs text-[var(--ink)] font-semibold self-start"
                  >
                    Edit description
                  </button>
                )}
                <p className="text-sm text-[var(--ink)]">{post.caption}</p>

                <div className="flex items-center gap-4 text-sm">
                  <button
                    type="button"
                    onClick={() => handleLike(post.id)}
                    className="neo-pill bg-[var(--surface)] text-xs"
                  >
                    💼 {post.likes?.length || 0} saved
                  </button>
                  <span className="text-[var(--muted-ink)]">
                    📝 {post.comments?.length || 0} applications
                  </span>
                </div>

                {/* Apply to Job Button - only show if not the job owner */}
                {account !== post.owner && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!account) {
                        connectWallet();
                        return;
                      }
                      setSelectedJob({ id: post.id, title: post.caption });
                      setApplyModalOpen(true);
                    }}
                    className="neo-button bg-[var(--accent)] text-[var(--ink)] font-semibold w-full mt-2"
                  >
                    🚀 Apply to this Job
                  </button>
                )}

                <CommentsSection postId={post.id} />
              </div>
            </article>
          ))}
        </div>
      </div>

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          duration={3000}
          onClose={() => setToastMessage(null)}
        />
      )}

      {selectedJob && (
        <ApplyToJobModal
          isOpen={applyModalOpen}
          onClose={() => {
            setApplyModalOpen(false);
            setSelectedJob(null);
          }}
          jobId={selectedJob.id}
          jobTitle={selectedJob.title}
          onApplicationSubmitted={() => {
            setToastMessage("Application submitted successfully!");
            setToastType("success");
            loadFeed(); // Refresh to update application count
          }}
        />
      )}
    </div>
  );
}

export default function FeedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--page-bg)] px-6 py-12 flex items-center justify-center">
          <div className="neo-card p-8 text-center">
            <p className="text-lg text-[var(--muted-ink)]">Loading feed...</p>
          </div>
        </div>
      }
    >
      <FeedContent />
    </Suspense>
  );
}

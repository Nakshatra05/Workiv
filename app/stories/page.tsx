"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HeaderBar } from "@/components/HeaderBar";
import { CreateStoryModal } from "@/components/CreateStoryModal";
import { ApplyToJobModal } from "@/components/ApplyToJobModal";
import { CommentsSection } from "@/components/CommentsSection";
import { storiesApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { Story } from "@/app/types/api";

export const dynamic = 'force-dynamic';

export default function StoriesPage() {
  const { account, connectWallet } = useWallet();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateStoryModalOpen, setIsCreateStoryModalOpen] = useState(false);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<{ id: string; title: string } | null>(null);

  const loadStories = useCallback(async () => {
    try {
      setLoading(true);
      const response = await storiesApi.getStories(undefined, 50);
      if (response.success && response.stories) {
        setStories(response.stories);
      } else if (response.data?.stories) {
        setStories(response.data.stories);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

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
          <h1 className="text-4xl font-black">Featured Jobs</h1>
          <p className="text-lg text-[var(--muted-ink)]">
            Highlighted opportunities on Workiv
          </p>
          <div className="flex flex-wrap gap-4 text-sm items-center">
            <Link href="/" className="neo-pill bg-[var(--surface)]">
              ← Back home
            </Link>
            <Link href="/feed" className="neo-pill bg-[var(--surface)]">
              All Jobs
            </Link>
            <Link href="/profile" className="neo-pill bg-[var(--surface)]">
              Profile
            </Link>
            {account && (
              <button
                type="button"
                onClick={() => setIsCreateStoryModalOpen(true)}
                className="neo-pill bg-[var(--accent)] text-[var(--ink)] font-semibold"
              >
                Feature a Job
              </button>
            )}
          </div>
        </header>

        {loading && (
          <div className="neo-card p-8 text-center">
            <p className="text-lg text-[var(--muted-ink)]">Loading featured jobs...</p>
          </div>
        )}

        {error && (
          <div className="neo-card p-8">
            <p className="text-red-600 font-semibold">Error: {error}</p>
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="neo-card p-8 text-center">
            <p className="text-lg text-[var(--muted-ink)]">
              No featured jobs yet. Be the first to highlight one!
            </p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {stories
            .filter((story) => story.expires_at > Date.now())
            .map((story) => (
              <article
                key={story.id}
                className="neo-card flex flex-col gap-4 p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="neo-pill text-xs font-semibold">
                    {story.author.slice(0, 6)}...{story.author.slice(-4)}
                  </div>
                  <span className="text-xs text-[var(--muted-ink)]">
                    {formatDate(story.created_at)}
                  </span>
                </div>

                {story.media?.dataUrl && (
                  <div className="w-full rounded-2xl overflow-hidden border-2 border-[var(--ink)] shadow-[6px_6px_0_rgba(0,0,0,0.18)]">
                    <img
                      src={story.media.dataUrl}
                      alt={story.content || "Featured Job"}
                      className="w-full h-auto object-cover max-h-64"
                    />
                  </div>
                )}

                {story.content && (
                  <p className="text-sm text-[var(--ink)]">{story.content}</p>
                )}

                <div className="text-xs text-[var(--muted-ink)]">
                  {(() => {
                    const remainingMs = story.expires_at - Date.now();
                    const remainingMinutes = Math.floor(remainingMs / (1000 * 60));
                    const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
                    
                    if (remainingMs < 0) return "Expired";
                    if (remainingMinutes < 60) {
                      return `Expires in ${remainingMinutes}min${remainingMinutes !== 1 ? 's' : ''}`;
                    }
                    return `Expires in ${remainingHours}h${remainingHours !== 1 ? 's' : ''}`;
                  })()}
                </div>

                {story.id && story.id.startsWith("0x") && (
                  <a
                    href={`https://explorer.mendoza.hoodi.arkiv.network/entity/${story.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neo-pill bg-[var(--surface)] text-xs font-semibold inline-flex items-center gap-2 self-start hover:scale-105 transition-transform"
                  >
                    🔗 Explorer
                    <span className="text-[var(--muted-ink)] font-mono">
                      {story.id.slice(0, 6)}...{story.id.slice(-4)}
                    </span>
                  </a>
                )}

                <div className="flex items-center gap-2 mt-2">
                  {account !== story.author && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!account) {
                          await connectWallet();
                          return;
                        }
                        setSelectedJob({ id: story.id, title: story.content || "Featured Job" });
                        setApplyModalOpen(true);
                      }}
                      className="neo-pill bg-[var(--accent)] text-[var(--ink)] text-xs font-semibold hover:scale-105 transition-transform"
                    >
                      🚀 Apply
                    </button>
                  )}
                  {account === story.author && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm("Remove this featured job?")) {
                          try {
                            await storiesApi.deleteStory(story.id, story.author);
                            setStories((prev) =>
                              prev.filter((s) => s.id !== story.id)
                            );
                          } catch (err) {
                            alert(err instanceof Error ? err.message : "Failed to remove featured job");
                          }
                        }
                      }}
                      className="text-xs text-red-600 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <CommentsSection postId={story.id} />
              </article>
            ))}
        </div>
      </div>

      <CreateStoryModal
        isOpen={isCreateStoryModalOpen}
        onClose={() => setIsCreateStoryModalOpen(false)}
        onStoryCreated={() => {
          setIsCreateStoryModalOpen(false);
          loadStories();
        }}
      />

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
            setApplyModalOpen(false);
            setSelectedJob(null);
          }}
        />
      )}
    </div>
  );
}


"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HeaderBar } from "@/components/HeaderBar";
import { CommentsSection } from "@/components/CommentsSection";
import { ApplyToJobModal } from "@/components/ApplyToJobModal";
import { Toast } from "@/components/Toast";
import { feedApi, postApi, jobApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { Post, JobDiscipline, LocationType } from "@/app/types/api";

export const dynamic = 'force-dynamic';

const DISCIPLINES: { value: JobDiscipline | ""; label: string }[] = [
  { value: "", label: "All Disciplines" },
  { value: "engineering", label: "Engineering" },
  { value: "design", label: "Design" },
  { value: "product", label: "Product" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
  { value: "operations", label: "Operations" },
  { value: "finance", label: "Finance" },
  { value: "hr", label: "Human Resources" },
  { value: "legal", label: "Legal" },
  { value: "customer-support", label: "Customer Support" },
  { value: "data-science", label: "Data Science" },
  { value: "devops", label: "DevOps" },
  { value: "other", label: "Other" },
];

const LOCATION_TYPES: { value: LocationType | ""; label: string }[] = [
  { value: "", label: "All Locations" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

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

  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [disciplineFilter, setDisciplineFilter] = useState<JobDiscipline | "">("");
  const [locationTypeFilter, setLocationTypeFilter] = useState<LocationType | "">("");
  const [showFilters, setShowFilters] = useState(false);

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

  // Parse job data from caption (JSON or plain text)
  const parseJobData = useCallback((post: Post) => {
    try {
      const data = JSON.parse(post.caption);
      return { ...post, ...data };
    } catch {
      return { ...post, title: post.caption, description: post.caption };
    }
  }, []);

  // Filter posts based on search and filters
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const job = parseJobData(post);
      const searchLower = searchQuery.toLowerCase();

      // Search filter
      if (searchQuery) {
        const matchesSearch =
          (job.title?.toLowerCase().includes(searchLower)) ||
          (job.description?.toLowerCase().includes(searchLower)) ||
          (job.company?.toLowerCase().includes(searchLower)) ||
          (post.caption?.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Discipline filter
      if (disciplineFilter && job.discipline !== disciplineFilter) {
        return false;
      }

      // Location type filter
      if (locationTypeFilter && job.location_type !== locationTypeFilter) {
        return false;
      }

      return true;
    });
  }, [posts, searchQuery, disciplineFilter, locationTypeFilter, parseJobData]);

  // Handle flagging
  const handleFlag = async (jobId: string) => {
    if (!account) {
      setToastMessage("Please connect your wallet to flag listings");
      setToastType("error");
      return;
    }

    try {
      await jobApi.flagJob(jobId, account);
      setToastMessage("Listing flagged for review");
      setToastType("success");
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to flag listing");
      setToastType("error");
    }
  };

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
            <Link href="/my-listings" className="neo-pill bg-[var(--surface)]">
              My Listings
            </Link>
            <Link href="/stories" className="neo-pill bg-[var(--surface)]">
              Featured Jobs
            </Link>
          </div>
        </header>

        {/* Search and Filters */}
        <section className="neo-card p-6">
          <div className="flex flex-col gap-4">
            {/* Search Bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search jobs by title, company, or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 pl-12 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">🔍</span>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--muted-ink)] hover:text-[var(--ink)]"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="neo-pill bg-[var(--surface)] text-sm font-semibold self-start"
            >
              {showFilters ? "Hide Filters ▲" : "Show Filters ▼"}
            </button>

            {/* Filter Controls */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                    Discipline
                  </label>
                  <select
                    value={disciplineFilter}
                    onChange={(e) => setDisciplineFilter(e.target.value as JobDiscipline | "")}
                    className="mt-1 w-full rounded-xl border-2 border-[var(--ink)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none"
                  >
                    {DISCIPLINES.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-ink)]">
                    Location Type
                  </label>
                  <select
                    value={locationTypeFilter}
                    onChange={(e) => setLocationTypeFilter(e.target.value as LocationType | "")}
                    className="mt-1 w-full rounded-xl border-2 border-[var(--ink)] bg-[var(--surface)] px-3 py-2 text-sm focus:outline-none"
                  >
                    {LOCATION_TYPES.map((lt) => (
                      <option key={lt.value} value={lt.value}>{lt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Active Filters & Results Count */}
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-[var(--muted-ink)]">
                {filteredPosts.length} job{filteredPosts.length !== 1 ? "s" : ""} found
              </span>
              {(searchQuery || disciplineFilter || locationTypeFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setDisciplineFilter("");
                    setLocationTypeFilter("");
                  }}
                  className="neo-pill bg-red-100 text-red-700 text-xs font-semibold"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        </section>

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

        {!loading && !error && posts.length > 0 && filteredPosts.length === 0 && (
          <div className="neo-card p-8 text-center">
            <p className="text-lg text-[var(--muted-ink)]">
              No jobs match your search criteria. Try adjusting your filters.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {filteredPosts.map((post) => {
            const job = parseJobData(post);
            return (
            <article
              key={post.id}
              className="neo-card flex flex-col gap-3 p-4 md:p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Link 
                    href={`/company/${post.owner}`}
                    className="neo-pill text-xs font-semibold hover:scale-105 transition-transform"
                  >
                    {post.owner.slice(0, 6)}...{post.owner.slice(-4)}
                  </Link>
                  <span className="text-xs text-[var(--muted-ink)]">
                    {formatDate(post.created_at)}
                  </span>
                  {job.location_type && (
                    <span className={`neo-pill text-xs ${
                      job.location_type === 'remote' ? 'bg-green-100 text-green-700' :
                      job.location_type === 'hybrid' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {job.location_type === 'remote' ? '🌍 Remote' : 
                       job.location_type === 'hybrid' ? '🏠 Hybrid' : '🏢 On-site'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {account !== post.owner && (
                    <button
                      type="button"
                      onClick={() => handleFlag(post.id)}
                      className="text-xs text-[var(--muted-ink)] hover:text-red-600"
                      title="Flag this listing"
                    >
                      🚩
                    </button>
                  )}
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
              </div>

              {/* Job Title and Company */}
              <div>
                <Link href={`/job/${post.id}`} className="hover:underline">
                  <h3 className="text-xl font-black">{job.title || post.caption}</h3>
                </Link>
                {job.company && (
                  <p className="text-sm text-[var(--muted-ink)]">
                    {job.company} • {job.location || 'Location not specified'}
                    {job.job_type && ` • ${job.job_type}`}
                  </p>
                )}
              </div>

              {/* Salary Range */}
              {(job.salary_min || job.salary_max) && (
                <div className="neo-pill bg-green-100 text-green-800 text-sm font-semibold self-start">
                  💰 ${job.salary_min?.toLocaleString() || '?'}k - ${job.salary_max?.toLocaleString() || '?'}k/year
                </div>
              )}

              {post.image?.dataUrl && (
                <div className="w-full flex justify-center">
                  <div className="max-w-md w-full rounded-xl overflow-hidden border-2 border-[var(--ink)] shadow-[4px_4px_0_rgba(0,0,0,0.18)]">
                    <img
                      src={post.image.dataUrl}
                      alt={job.title || "Job listing image"}
                      className="w-full h-auto object-cover max-h-96"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {account === post.owner && (
                  <Link
                    href="/my-listings"
                    className="text-xs text-[var(--ink)] font-semibold self-start hover:underline"
                  >
                    ✏️ Edit in My Listings
                  </Link>
                )}
                <p className="text-sm text-[var(--ink)] line-clamp-3">{job.description || post.caption}</p>

                {/* Apply Link (External) */}
                {job.apply_link && (
                  <a
                    href={job.apply_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neo-pill bg-blue-100 text-blue-700 text-xs font-semibold self-start hover:scale-105 transition-transform"
                  >
                    🔗 Apply on Company Site
                  </a>
                )}

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
                  <Link
                    href={`/job/${post.id}`}
                    className="neo-pill bg-[var(--surface)] text-xs hover:scale-105 transition-transform"
                  >
                    View Details →
                  </Link>
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
                      setSelectedJob({ id: post.id, title: job.title || post.caption });
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
            );
          })}
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

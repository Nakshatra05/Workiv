"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HeaderBar } from "@/components/HeaderBar";
import { CreateJobModal } from "@/components/CreateJobModal";
import { CreateCompanyModal } from "@/components/CreateCompanyModal";
import { jobApi, companyApi, postApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { CompanyProfile, Post } from "@/app/types/api";
import { Toast } from "@/components/Toast";

export const dynamic = 'force-dynamic';

export default function MyListingsPage() {
  const { account } = useWallet();
  const [listings, setListings] = useState<Post[]>([]);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJobModalOpen, setIsJobModalOpen] = useState(false);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Partial<Post> | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const loadData = useCallback(async () => {
    if (!account) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load company profile
      try {
        const companyResponse = await companyApi.getCompanyByWallet(account);
        if (companyResponse.success && companyResponse.company) {
          setCompany(companyResponse.company);
        }
      } catch {
        // No company profile yet
      }

      // Load user's job listings
      const listingsResponse = await jobApi.getMyListings(account);
      if (listingsResponse.success && listingsResponse.posts) {
        setListings(listingsResponse.posts);
      } else if (listingsResponse.data?.posts) {
        setListings(listingsResponse.data.posts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, [account]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteJob = async (jobId: string) => {
    if (!account) return;
    if (!confirm("Are you sure you want to delete this job listing? This cannot be undone.")) {
      return;
    }

    try {
      const response = await postApi.deletePost(jobId, account);
      if (response.success) {
        setListings((prev) => prev.filter((job) => job.id !== jobId));
        setToastMessage("Job listing deleted");
        setToastType("success");
      } else {
        setToastMessage(response.message || "Failed to delete");
        setToastType("error");
      }
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to delete");
      setToastType("error");
    }
  };

  const handleMarkFilled = async (jobId: string) => {
    if (!account) return;

    try {
      const response = await jobApi.updateJob(jobId, account, { status: "filled" });
      if (response.success) {
        setToastMessage("Job marked as filled");
        setToastType("success");
        loadData();
      } else {
        setToastMessage(response.message || "Failed to update");
        setToastType("error");
      }
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : "Failed to update");
      setToastType("error");
    }
  };

  const parseJobData = (post: Post) => {
    try {
      const data = JSON.parse(post.caption);
      return { ...post, ...data };
    } catch {
      return { ...post, title: post.caption, description: post.caption };
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getStatusBadge = (job: any) => {
    const now = Date.now();
    const expiresAt = job.expires_at || (job.created_at + (job.expiration_days || 30) * 24 * 60 * 60 * 1000);
    
    if (job.status === "filled") {
      return <span className="neo-pill bg-green-200 text-green-800 text-xs">Filled</span>;
    }
    if (now > expiresAt) {
      return <span className="neo-pill bg-gray-200 text-gray-800 text-xs">Expired</span>;
    }
    return <span className="neo-pill bg-blue-200 text-blue-800 text-xs">Active</span>;
  };

  if (!account) {
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
          <div className="neo-card p-8 text-center">
            <h2 className="text-2xl font-black mb-4">Connect Your Wallet</h2>
            <p className="text-[var(--muted-ink)]">
              Please connect your wallet to view and manage your job listings.
            </p>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-4xl font-black">My Listings</h1>
          <p className="text-lg text-[var(--muted-ink)]">
            Manage your company profile and job listings
          </p>
          <div className="flex flex-wrap gap-4 text-sm items-center">
            <Link href="/" className="neo-pill bg-[var(--surface)]">
              ← Back home
            </Link>
            <Link href="/feed" className="neo-pill bg-[var(--surface)]">
              Job Board
            </Link>
            <button
              type="button"
              onClick={() => setIsCompanyModalOpen(true)}
              className="neo-pill bg-[var(--surface)] font-semibold"
            >
              🏢 {company ? "Edit Company" : "Create Company"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingJob(null);
                setIsJobModalOpen(true);
              }}
              className="neo-pill bg-[var(--accent)] text-[var(--ink)] font-semibold"
            >
              + Post New Job
            </button>
          </div>
        </header>

        {/* Company Profile Section */}
        {company && (
          <section className="neo-card p-6">
            <div className="flex items-start gap-4">
              {company.logo && (
                <img
                  src={company.logo}
                  alt={company.name}
                  className="w-16 h-16 rounded-2xl border-2 border-[var(--ink)] object-cover"
                />
              )}
              <div className="flex-1">
                <h2 className="text-xl font-black">{company.name}</h2>
                <p className="text-sm text-[var(--muted-ink)]">
                  {company.industry} • {company.location} • {company.size} employees
                </p>
                <p className="mt-2 text-sm">{company.description}</p>
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline mt-2 inline-block"
                  >
                    {company.website}
                  </a>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsCompanyModalOpen(true)}
                className="neo-pill bg-[var(--surface)] text-xs font-semibold"
              >
                ✏️ Edit
              </button>
            </div>
          </section>
        )}

        {/* Listings Section */}
        <section>
          <h2 className="text-2xl font-black mb-4">Your Job Listings ({listings.length})</h2>

          {loading && (
            <div className="neo-card p-8 text-center">
              <p className="text-lg text-[var(--muted-ink)]">Loading your listings...</p>
            </div>
          )}

          {error && (
            <div className="neo-card p-8">
              <p className="text-red-600 font-semibold">Error: {error}</p>
            </div>
          )}

          {!loading && !error && listings.length === 0 && (
            <div className="neo-card p-8 text-center">
              <p className="text-lg text-[var(--muted-ink)] mb-4">
                You haven't posted any jobs yet.
              </p>
              <button
                type="button"
                onClick={() => setIsJobModalOpen(true)}
                className="neo-button bg-[var(--accent)] text-[var(--ink)]"
              >
                Post Your First Job
              </button>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {listings.map((post) => {
              const job = parseJobData(post);
              return (
                <article key={post.id} className="neo-card p-6">
                  <div className="flex items-start gap-4">
                    {post.image?.dataUrl && (
                      <img
                        src={post.image.dataUrl}
                        alt={job.title || "Job"}
                        className="w-20 h-20 rounded-xl border-2 border-[var(--ink)] object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-black">{job.title || job.caption}</h3>
                        {getStatusBadge(job)}
                      </div>
                      <p className="text-sm text-[var(--muted-ink)]">
                        {job.company} • {job.location} • {job.job_type || "Full-time"}
                      </p>
                      <p className="text-sm mt-2 line-clamp-2">{job.description}</p>
                      <div className="flex gap-2 mt-2 text-xs text-[var(--muted-ink)]">
                        <span>Posted: {formatDate(post.created_at)}</span>
                        {job.expiration_days && (
                          <span>• Expires in {job.expiration_days} days</span>
                        )}
                        <span>• {post.comments?.length || 0} applications</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingJob(job);
                          setIsJobModalOpen(true);
                        }}
                        className="neo-pill bg-[var(--surface)] text-xs font-semibold"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkFilled(post.id)}
                        className="neo-pill bg-green-200 text-green-800 text-xs font-semibold"
                      >
                        ✓ Mark Filled
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteJob(post.id)}
                        className="neo-pill bg-red-200 text-red-800 text-xs font-semibold"
                      >
                        🗑️ Delete
                      </button>
                      <Link
                        href={`/job/${post.id}`}
                        className="neo-pill bg-[var(--surface)] text-xs font-semibold text-center"
                      >
                        👁️ View
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <CreateJobModal
        isOpen={isJobModalOpen}
        onClose={() => {
          setIsJobModalOpen(false);
          setEditingJob(null);
        }}
        onJobCreated={() => {
          setIsJobModalOpen(false);
          setEditingJob(null);
          loadData();
        }}
        existingJob={editingJob}
      />

      <CreateCompanyModal
        isOpen={isCompanyModalOpen}
        onClose={() => setIsCompanyModalOpen(false)}
        onCompanyCreated={() => {
          setIsCompanyModalOpen(false);
          loadData();
        }}
        existingCompany={company}
      />

      {toastMessage && (
        <Toast
          message={toastMessage}
          type={toastType}
          duration={3000}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}

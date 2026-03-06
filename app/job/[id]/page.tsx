"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HeaderBar } from "@/components/HeaderBar";
import { CommentsSection } from "@/components/CommentsSection";
import { ApplyToJobModal } from "@/components/ApplyToJobModal";
import { Toast } from "@/components/Toast";
import { postApi, companyApi, jobApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { Post, CompanyProfile } from "@/app/types/api";

export const dynamic = 'force-dynamic';

export default function JobDetailsPage() {
  const params = useParams();
  const jobId = params.id as string;
  const { account, connectWallet } = useWallet();
  
  const [job, setJob] = useState<Post | null>(null);
  const [jobData, setJobData] = useState<any>(null);
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const loadJob = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      const response = await postApi.getPost(jobId);
      
      if (response.success && response.post) {
        setJob(response.post);
        
        // Parse job data from caption
        try {
          const data = JSON.parse(response.post.caption);
          setJobData({ ...response.post, ...data });
          
          // Try to load company profile
          if (data.company_id) {
            try {
              const companyResponse = await companyApi.getCompanyById(data.company_id);
              if (companyResponse.success && companyResponse.company) {
                setCompany(companyResponse.company);
              }
            } catch {
              // Company not found, that's okay
            }
          } else {
            // Try to load by wallet
            try {
              const companyResponse = await companyApi.getCompanyByWallet(response.post.owner);
              if (companyResponse.success && companyResponse.company) {
                setCompany(companyResponse.company);
              }
            } catch {
              // Company not found
            }
          }
        } catch {
          setJobData({ 
            ...response.post, 
            title: response.post.caption, 
            description: response.post.caption 
          });
        }
      } else {
        setError("Job listing not found");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadJob();
  }, [loadJob]);

  const handleFlag = async () => {
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
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatSalary = (min?: number, max?: number) => {
    if (!min && !max) return null;
    if (min && max) return `$${min.toLocaleString()} - $${max.toLocaleString()}/year`;
    if (min) return `From $${min.toLocaleString()}/year`;
    return `Up to $${max?.toLocaleString()}/year`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] px-6 py-12 text-[var(--ink)]">
        <div className="mx-auto max-w-4xl">
          <HeaderBar
            connectedLabel="Wallet connected"
            disconnectedLabel="Connect wallet"
            connectingLabel="Connecting..."
            showCopyPill
            showButton={false}
          />
          <div className="neo-card p-8 text-center mt-8">
            <p className="text-lg text-[var(--muted-ink)]">Loading job details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-[var(--page-bg)] px-6 py-12 text-[var(--ink)]">
        <div className="mx-auto max-w-4xl">
          <HeaderBar
            connectedLabel="Wallet connected"
            disconnectedLabel="Connect wallet"
            connectingLabel="Connecting..."
            showCopyPill
            showButton={false}
          />
          <div className="neo-card p-8 text-center mt-8">
            <h1 className="text-2xl font-black mb-4">Job Not Found</h1>
            <p className="text-[var(--muted-ink)] mb-4">{error || "This job listing doesn't exist or has been removed."}</p>
            <Link href="/feed" className="neo-button bg-[var(--accent)]">
              Back to Job Board
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--page-bg)] px-6 py-12 text-[var(--ink)]">
      <div className="mx-auto max-w-4xl flex flex-col gap-8">
        <HeaderBar
          connectedLabel="Wallet connected"
          disconnectedLabel="Connect wallet"
          connectingLabel="Connecting..."
          showCopyPill
          showButton={false}
        />

        {/* Breadcrumb */}
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/" className="text-[var(--muted-ink)] hover:text-[var(--ink)]">Home</Link>
          <span className="text-[var(--muted-ink)]">/</span>
          <Link href="/feed" className="text-[var(--muted-ink)] hover:text-[var(--ink)]">Jobs</Link>
          <span className="text-[var(--muted-ink)]">/</span>
          <span className="font-semibold">{jobData?.title || "Job Details"}</span>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Job Details */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            <article className="neo-card p-8">
              {/* Header */}
              <div className="flex items-start gap-4 mb-6">
                {job.image?.dataUrl && (
                  <img
                    src={job.image.dataUrl}
                    alt={jobData?.title || "Company"}
                    className="w-20 h-20 rounded-xl border-2 border-[var(--ink)] object-cover"
                  />
                )}
                <div className="flex-1">
                  <h1 className="text-2xl font-black">{jobData?.title || job.caption}</h1>
                  <p className="text-lg text-[var(--muted-ink)]">
                    {jobData?.company || company?.name || "Company"}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {jobData?.location && (
                      <span className="neo-pill bg-[var(--surface)] text-xs">
                        📍 {jobData.location}
                      </span>
                    )}
                    {jobData?.location_type && (
                      <span className={`neo-pill text-xs ${
                        jobData.location_type === 'remote' ? 'bg-green-100 text-green-700' :
                        jobData.location_type === 'hybrid' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {jobData.location_type === 'remote' ? '🌍 Remote' : 
                         jobData.location_type === 'hybrid' ? '🏠 Hybrid' : '🏢 On-site'}
                      </span>
                    )}
                    {jobData?.job_type && (
                      <span className="neo-pill bg-[var(--surface)] text-xs">
                        {jobData.job_type}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {formatSalary(jobData?.salary_min, jobData?.salary_max) && (
                  <div className="neo-card p-4 bg-green-50">
                    <p className="text-xs text-[var(--muted-ink)] uppercase">Salary</p>
                    <p className="font-bold text-green-700">
                      {formatSalary(jobData?.salary_min, jobData?.salary_max)}
                    </p>
                  </div>
                )}
                {jobData?.discipline && (
                  <div className="neo-card p-4">
                    <p className="text-xs text-[var(--muted-ink)] uppercase">Discipline</p>
                    <p className="font-bold capitalize">{jobData.discipline.replace('-', ' ')}</p>
                  </div>
                )}
                <div className="neo-card p-4">
                  <p className="text-xs text-[var(--muted-ink)] uppercase">Posted</p>
                  <p className="font-bold">{formatDate(job.created_at)}</p>
                </div>
                {jobData?.expiration_days && (
                  <div className="neo-card p-4">
                    <p className="text-xs text-[var(--muted-ink)] uppercase">Duration</p>
                    <p className="font-bold">{jobData.expiration_days} days</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-lg font-black mb-3">Job Description</h2>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{jobData?.description || job.caption}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-4">
                {account !== job.owner && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        if (!account) {
                          connectWallet();
                          return;
                        }
                        setApplyModalOpen(true);
                      }}
                      className="neo-button bg-[var(--accent)] text-[var(--ink)] font-semibold flex-1"
                    >
                      🚀 Apply Now
                    </button>
                    {jobData?.apply_link && (
                      <a
                        href={jobData.apply_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neo-button bg-blue-100 text-blue-700 font-semibold"
                      >
                        🔗 Apply on Site
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={handleFlag}
                      className="neo-pill bg-[var(--surface)] text-xs font-semibold"
                    >
                      🚩 Flag
                    </button>
                  </>
                )}
                {account === job.owner && (
                  <Link
                    href="/my-listings"
                    className="neo-button bg-[var(--surface)] text-[var(--ink)] font-semibold"
                  >
                    ✏️ Edit in My Listings
                  </Link>
                )}
              </div>
            </article>

            {/* Applications Section */}
            <section className="neo-card p-6">
              <h2 className="text-lg font-black mb-4">Applications & Inquiries</h2>
              <CommentsSection postId={jobId} />
            </section>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-6">
            {/* Company Card */}
            <div className="neo-card p-6">
              <h2 className="text-lg font-black mb-4">About the Company</h2>
              {company ? (
                <div className="flex flex-col gap-3">
                  {company.logo && (
                    <img
                      src={company.logo}
                      alt={company.name}
                      className="w-16 h-16 rounded-xl border-2 border-[var(--ink)] object-cover"
                    />
                  )}
                  <h3 className="font-bold">{company.name}</h3>
                  <p className="text-sm text-[var(--muted-ink)]">
                    {company.industry} • {company.size} employees
                  </p>
                  <p className="text-sm">{company.description}</p>
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline"
                    >
                      🌐 {company.website}
                    </a>
                  )}
                  <Link
                    href={`/company/${job.owner}`}
                    className="neo-pill bg-[var(--surface)] text-xs font-semibold text-center mt-2"
                  >
                    View Company Profile →
                  </Link>
                </div>
              ) : (
                <div className="text-sm text-[var(--muted-ink)]">
                  <p className="mb-2">Posted by:</p>
                  <Link
                    href={`/company/${job.owner}`}
                    className="neo-pill bg-[var(--surface)] text-xs font-semibold"
                  >
                    {job.owner.slice(0, 6)}...{job.owner.slice(-4)}
                  </Link>
                </div>
              )}
            </div>

            {/* Share */}
            <div className="neo-card p-6">
              <h2 className="text-lg font-black mb-4">Share this Job</h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    setToastMessage("Link copied!");
                    setToastType("success");
                  }}
                  className="neo-pill bg-[var(--surface)] text-xs font-semibold flex-1"
                >
                  📋 Copy Link
                </button>
              </div>
            </div>

            {/* Blockchain Info */}
            <div className="neo-card p-6">
              <h2 className="text-lg font-black mb-4">On-Chain Data</h2>
              <div className="text-xs space-y-2">
                <p>
                  <span className="text-[var(--muted-ink)]">Entity Key:</span><br />
                  <code className="bg-[var(--surface)] px-2 py-1 rounded break-all">
                    {jobId}
                  </code>
                </p>
                <a
                  href={`https://explorer.mendoza.hoodi.arkiv.network/entity/${jobId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="neo-pill bg-[var(--surface)] text-xs font-semibold inline-flex items-center gap-1"
                >
                  🔗 View on Explorer
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ApplyToJobModal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        jobId={jobId}
        jobTitle={jobData?.title || job.caption}
        onApplicationSubmitted={() => {
          setToastMessage("Application submitted successfully!");
          setToastType("success");
          loadJob();
        }}
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

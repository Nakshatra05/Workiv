"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HeaderBar } from "@/components/HeaderBar";
import { companyApi, jobApi } from "@/lib/api-client";
import { CompanyProfile, Post } from "@/app/types/api";

export const dynamic = 'force-dynamic';

export default function CompanyProfilePage() {
  const params = useParams();
  const walletId = params.wallet as string;
  
  const [company, setCompany] = useState<CompanyProfile | null>(null);
  const [jobs, setJobs] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCompanyData = useCallback(async () => {
    if (!walletId) return;

    try {
      setLoading(true);
      setError(null);

      // Load company profile
      try {
        const companyResponse = await companyApi.getCompanyByWallet(walletId);
        if (companyResponse.success && companyResponse.company) {
          setCompany(companyResponse.company);
        }
      } catch {
        // Company profile not found
      }

      // Load company's job listings
      const jobsResponse = await jobApi.getMyListings(walletId);
      if (jobsResponse.success && jobsResponse.posts) {
        setJobs(jobsResponse.posts);
      } else if (jobsResponse.data?.posts) {
        setJobs(jobsResponse.data.posts);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load company data");
    } finally {
      setLoading(false);
    }
  }, [walletId]);

  useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);

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
            <p className="text-lg text-[var(--muted-ink)]">Loading company profile...</p>
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
          <span className="font-semibold">{company?.name || "Company"}</span>
        </div>

        {/* Company Profile */}
        <section className="neo-card p-8">
          {company ? (
            <div className="flex flex-col md:flex-row gap-6">
              {company.logo && (
                <img
                  src={company.logo}
                  alt={company.name}
                  className="w-24 h-24 rounded-2xl border-2 border-[var(--ink)] object-cover"
                />
              )}
              <div className="flex-1">
                <h1 className="text-3xl font-black">{company.name}</h1>
                <p className="text-lg text-[var(--muted-ink)] mt-1">
                  {company.industry} • {company.location}
                </p>
                
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="neo-pill bg-[var(--surface)] text-xs">
                    👥 {company.size} employees
                  </span>
                  {company.founded_year && (
                    <span className="neo-pill bg-[var(--surface)] text-xs">
                      🏢 Founded {company.founded_year}
                    </span>
                  )}
                </div>

                <p className="mt-4 text-[var(--ink)]">{company.description}</p>

                <div className="flex flex-wrap gap-3 mt-4">
                  {company.website && (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neo-pill bg-blue-100 text-blue-700 text-xs font-semibold hover:scale-105 transition-transform"
                    >
                      🌐 Website
                    </a>
                  )}
                  {company.linkedin_url && (
                    <a
                      href={company.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neo-pill bg-blue-100 text-blue-700 text-xs font-semibold hover:scale-105 transition-transform"
                    >
                      💼 LinkedIn
                    </a>
                  )}
                  {company.twitter_url && (
                    <a
                      href={company.twitter_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="neo-pill bg-blue-100 text-blue-700 text-xs font-semibold hover:scale-105 transition-transform"
                    >
                      🐦 Twitter
                    </a>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-2xl font-black mb-4">Employer Profile</h1>
              <p className="text-[var(--muted-ink)] mb-2">Wallet Address:</p>
              <code className="neo-pill bg-[var(--surface)] text-sm font-mono">
                {walletId}
              </code>
              <p className="text-[var(--muted-ink)] mt-4">
                This employer hasn't created a company profile yet.
              </p>
            </div>
          )}
        </section>

        {/* Job Listings */}
        <section>
          <h2 className="text-2xl font-black mb-4">
            Open Positions ({jobs.length})
          </h2>

          {error && (
            <div className="neo-card p-8">
              <p className="text-red-600 font-semibold">Error: {error}</p>
            </div>
          )}

          {jobs.length === 0 ? (
            <div className="neo-card p-8 text-center">
              <p className="text-lg text-[var(--muted-ink)]">
                No open positions at this time.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {jobs.map((post) => {
                const job = parseJobData(post);
                return (
                  <Link key={post.id} href={`/job/${post.id}`}>
                    <article className="neo-card p-6 hover:scale-[1.01] transition-transform cursor-pointer">
                      <div className="flex items-start gap-4">
                        {post.image?.dataUrl && (
                          <img
                            src={post.image.dataUrl}
                            alt={job.title || "Job"}
                            className="w-16 h-16 rounded-xl border-2 border-[var(--ink)] object-cover"
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="text-lg font-black">{job.title || post.caption}</h3>
                            <span className="text-xs text-[var(--muted-ink)]">
                              {formatDate(post.created_at)}
                            </span>
                          </div>
                          <p className="text-sm text-[var(--muted-ink)]">
                            {job.location || 'Location not specified'} • {job.job_type || 'Full-time'}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
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
                            {job.discipline && (
                              <span className="neo-pill bg-[var(--surface)] text-xs capitalize">
                                {job.discipline.replace('-', ' ')}
                              </span>
                            )}
                            {(job.salary_min || job.salary_max) && (
                              <span className="neo-pill bg-green-100 text-green-700 text-xs">
                                💰 ${job.salary_min?.toLocaleString() || '?'}k - ${job.salary_max?.toLocaleString() || '?'}k
                              </span>
                            )}
                          </div>
                          <p className="text-sm mt-2 line-clamp-2">{job.description}</p>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Back Link */}
        <div className="flex justify-center">
          <Link href="/feed" className="neo-button bg-[var(--surface)]">
            ← Back to Job Board
          </Link>
        </div>
      </div>
    </div>
  );
}

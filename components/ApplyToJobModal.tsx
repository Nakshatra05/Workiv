"use client";

import { FormEvent, useCallback, useState } from "react";
import { commentsApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";

interface ApplyToJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
  jobTitle?: string;
  onApplicationSubmitted?: () => void;
}

export function ApplyToJobModal({
  isOpen,
  onClose,
  jobId,
  jobTitle,
  onApplicationSubmitted,
}: ApplyToJobModalProps) {
  const { account } = useWallet();
  const [coverLetter, setCoverLetter] = useState("");
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [experience, setExperience] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!account) {
        setError("Please connect your wallet to apply");
        return;
      }

      if (!coverLetter.trim()) {
        setError("Please write a cover letter");
        return;
      }

      if (coverLetter.length > 2000) {
        setError("Cover letter must be less than 2000 characters");
        return;
      }

      setIsSubmitting(true);
      try {
        // Format the application as a structured message
        const applicationContent = JSON.stringify({
          type: "job_application",
          cover_letter: coverLetter.trim(),
          portfolio_url: portfolioUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          experience: experience.trim() || null,
          applied_at: Date.now(),
        });

        const response = await commentsApi.createComment(
          jobId,
          account,
          applicationContent
        );

        if (response.success) {
          setSuccess(true);
          setTimeout(() => {
            setCoverLetter("");
            setPortfolioUrl("");
            setLinkedinUrl("");
            setExperience("");
            setSuccess(false);
            onApplicationSubmitted?.();
            onClose();
          }, 2000);
        } else {
          setError(response.message || "Failed to submit application");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit application");
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, coverLetter, portfolioUrl, linkedinUrl, experience, jobId, onApplicationSubmitted, onClose]
  );

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setCoverLetter("");
      setPortfolioUrl("");
      setLinkedinUrl("");
      setExperience("");
      setError(null);
      setSuccess(false);
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md">
      <div className="neo-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black">Apply to Job</h2>
            {jobTitle && (
              <p className="text-sm text-[var(--muted-ink)] mt-1 truncate max-w-md">
                {jobTitle.length > 60 ? `${jobTitle.slice(0, 60)}...` : jobTitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="neo-pill bg-[var(--surface)] text-[var(--ink)] text-xs font-semibold hover:scale-105 transition-transform disabled:opacity-50"
          >
            ✕ Close
          </button>
        </div>

        {success ? (
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-black text-[var(--ink)]">Application Submitted!</h3>
            <p className="text-[var(--muted-ink)] mt-2">
              Your application has been recorded on Arkiv. Good luck!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="neo-card bg-[var(--surface)] p-4 border-dashed">
              <p className="text-sm text-[var(--muted-ink)]">
                <strong className="text-[var(--ink)]">📋 Applying as:</strong>{" "}
                {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Not connected"}
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Cover Letter <span className="text-red-500">*</span>
              </label>
              <textarea
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                rows={6}
                placeholder="Tell the employer why you're a great fit for this role. Include your relevant experience, skills, and what excites you about this opportunity..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                maxLength={2000}
                disabled={isSubmitting}
              />
              <p className="mt-2 text-sm text-[var(--muted-ink)]">
                {coverLetter.length}/2000 characters
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Years of Experience
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Select experience level</option>
                <option value="0-1">0-1 years (Entry Level)</option>
                <option value="1-3">1-3 years (Junior)</option>
                <option value="3-5">3-5 years (Mid-Level)</option>
                <option value="5-10">5-10 years (Senior)</option>
                <option value="10+">10+ years (Expert)</option>
              </select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  Portfolio URL
                </label>
                <input
                  type="url"
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                  placeholder="https://your-portfolio.com"
                  value={portfolioUrl}
                  onChange={(e) => setPortfolioUrl(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  LinkedIn URL
                </label>
                <input
                  type="url"
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                  placeholder="https://linkedin.com/in/yourprofile"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm font-semibold text-red-600">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="neo-button bg-[var(--surface)] text-[var(--ink)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="neo-button bg-[var(--accent)] text-[var(--ink)] disabled:opacity-50 flex-1"
                disabled={isSubmitting || !coverLetter.trim() || !account}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
                    Submitting...
                  </span>
                ) : (
                  "🚀 Submit Application"
                )}
              </button>
            </div>

            <p className="text-xs text-center text-[var(--muted-ink)]">
              Your application will be stored on Arkiv blockchain and visible to the employer.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

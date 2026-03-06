"use client";

import { FormEvent, useCallback, useState, useEffect } from "react";
import { companyApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { CompanyProfile } from "@/app/types/api";

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompanyCreated?: () => void;
  existingCompany?: CompanyProfile | null;
}

const INDUSTRIES = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Retail",
  "Manufacturing",
  "Media & Entertainment",
  "Real Estate",
  "Transportation",
  "Energy",
  "Agriculture",
  "Construction",
  "Hospitality",
  "Professional Services",
  "Non-profit",
  "Government",
  "Other",
];

const COMPANY_SIZES = [
  { value: "1-10", label: "1-10 employees" },
  { value: "11-50", label: "11-50 employees" },
  { value: "51-200", label: "51-200 employees" },
  { value: "201-500", label: "201-500 employees" },
  { value: "501-1000", label: "501-1000 employees" },
  { value: "1000+", label: "1000+ employees" },
];

export function CreateCompanyModal({
  isOpen,
  onClose,
  onCompanyCreated,
  existingCompany,
}: CreateCompanyModalProps) {
  const { account } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [logo, setLogo] = useState("");
  const [location, setLocation] = useState("");
  const [size, setSize] = useState<"1-10" | "11-50" | "51-200" | "201-500" | "501-1000" | "1000+">( "1-10");
  const [foundedYear, setFoundedYear] = useState<number | undefined>();
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");

  // Pre-fill form if editing
  useEffect(() => {
    if (existingCompany) {
      setName(existingCompany.name || "");
      setDescription(existingCompany.description || "");
      setIndustry(existingCompany.industry || "");
      setWebsite(existingCompany.website || "");
      setLogo(existingCompany.logo || "");
      setLocation(existingCompany.location || "");
      setSize(existingCompany.size || "1-10");
      setFoundedYear(existingCompany.founded_year);
      setLinkedinUrl(existingCompany.linkedin_url || "");
      setTwitterUrl(existingCompany.twitter_url || "");
    }
  }, [existingCompany]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setIndustry("");
    setWebsite("");
    setLogo("");
    setLocation("");
    setSize("1-10");
    setFoundedYear(undefined);
    setLinkedinUrl("");
    setTwitterUrl("");
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!account) {
        setError("Please connect your wallet");
        return;
      }

      if (!name.trim() || !description.trim() || !industry || !location.trim()) {
        setError("Please fill in all required fields");
        return;
      }

      setIsSubmitting(true);
      try {
        if (existingCompany) {
          // Update existing company
          const response = await companyApi.updateCompany(
            existingCompany.id,
            account,
            {
              name: name.trim(),
              description: description.trim(),
              industry,
              website: website.trim() || undefined,
              logo: logo.trim() || undefined,
              location: location.trim(),
              size,
              founded_year: foundedYear,
              linkedin_url: linkedinUrl.trim() || undefined,
              twitter_url: twitterUrl.trim() || undefined,
            }
          );

          if (response.success) {
            setSuccess(true);
            setTimeout(() => {
              onCompanyCreated?.();
              onClose();
              resetForm();
            }, 1500);
          } else {
            setError(response.message || "Failed to update company profile");
          }
        } else {
          // Create new company
          const response = await companyApi.createCompany({
            owner: account,
            name: name.trim(),
            description: description.trim(),
            industry,
            website: website.trim() || undefined,
            logo: logo.trim() || undefined,
            location: location.trim(),
            size,
            founded_year: foundedYear,
            linkedin_url: linkedinUrl.trim() || undefined,
            twitter_url: twitterUrl.trim() || undefined,
          });

          if (response.success) {
            setSuccess(true);
            setTimeout(() => {
              onCompanyCreated?.();
              onClose();
              resetForm();
            }, 1500);
          } else {
            setError(response.message || "Failed to create company profile");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save company profile");
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, name, description, industry, website, logo, location, size, foundedYear, linkedinUrl, twitterUrl, existingCompany, onCompanyCreated, onClose]
  );

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md">
        <div className="neo-card p-8 text-center max-w-md">
          <div className="text-6xl mb-4">🏢</div>
          <h2 className="text-2xl font-black mb-2">
            {existingCompany ? "Company Updated!" : "Company Created!"}
          </h2>
          <p className="text-[var(--muted-ink)]">
            Your company profile has been saved to the blockchain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md overflow-y-auto py-8">
      <div className="neo-card p-6 w-full max-w-2xl mx-4 my-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black">
            {existingCompany ? "Edit Company Profile" : "Create Company Profile"}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="neo-pill bg-[var(--surface)] text-[var(--ink)] text-xs font-semibold"
          >
            ✕ Close
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Company Name */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="Acme Inc."
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>

            {/* Industry */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Industry <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                disabled={isSubmitting}
              >
                <option value="">Select industry...</option>
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            {/* Location */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="San Francisco, CA"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>

            {/* Company Size */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Company Size <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                value={size}
                onChange={(e) => setSize(e.target.value as typeof size)}
                disabled={isSubmitting}
              >
                {COMPANY_SIZES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Website */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Website
              </label>
              <input
                type="url"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="https://company.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Founded Year */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Founded Year
              </label>
              <input
                type="number"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="2020"
                value={foundedYear || ""}
                onChange={(e) => setFoundedYear(e.target.value ? parseInt(e.target.value) : undefined)}
                min={1800}
                max={new Date().getFullYear()}
                disabled={isSubmitting}
              />
            </div>

            {/* LinkedIn */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                LinkedIn URL
              </label>
              <input
                type="url"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="https://linkedin.com/company/..."
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            {/* Twitter */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Twitter/X URL
              </label>
              <input
                type="url"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="https://twitter.com/..."
                value={twitterUrl}
                onChange={(e) => setTwitterUrl(e.target.value)}
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Logo URL */}
          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Logo URL
            </label>
            <input
              type="url"
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              placeholder="https://company.com/logo.png"
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Company Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none resize-none"
              rows={4}
              placeholder="Tell job seekers about your company, culture, and mission..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-sm text-[var(--muted-ink)]">
              {description.length}/2000 characters
            </p>
          </div>

          <div className="flex gap-4 mt-4">
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
              disabled={isSubmitting || !name.trim() || !description.trim() || !industry || !location.trim()}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
                  Saving...
                </span>
              ) : existingCompany ? (
                "💾 Update Company"
              ) : (
                "🏢 Create Company"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

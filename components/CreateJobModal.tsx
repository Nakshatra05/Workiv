"use client";

import { FormEvent, useCallback, useState, useEffect } from "react";
import { jobApi, companyApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { JobListing, CompanyProfile, JobDiscipline, LocationType } from "@/app/types/api";

interface CreateJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated?: () => void;
  existingJob?: Partial<JobListing> | null;
}

const DISCIPLINES: { value: JobDiscipline; label: string }[] = [
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

const JOB_TYPES = [
  { value: "full-time", label: "Full-time" },
  { value: "part-time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "freelance", label: "Freelance" },
  { value: "internship", label: "Internship" },
];

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const EXPIRATION_OPTIONS = [
  { value: 30, label: "30 days" },
  { value: 60, label: "60 days" },
  { value: 90, label: "90 days" },
];

export function CreateJobModal({
  isOpen,
  onClose,
  onJobCreated,
  existingJob,
}: CreateJobModalProps) {
  const { account } = useWallet();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  // Form fields
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [locationType, setLocationType] = useState<LocationType>("remote");
  const [salaryMin, setSalaryMin] = useState<number | undefined>();
  const [salaryMax, setSalaryMax] = useState<number | undefined>();
  const [jobType, setJobType] = useState<"full-time" | "part-time" | "contract" | "freelance" | "internship">("full-time");
  const [discipline, setDiscipline] = useState<JobDiscipline>("engineering");
  const [applyLink, setApplyLink] = useState("");
  const [expirationDays, setExpirationDays] = useState<30 | 60 | 90>(30);

  // Load company profile
  useEffect(() => {
    async function loadCompany() {
      if (account) {
        try {
          const response = await companyApi.getCompanyByWallet(account);
          if (response.success && response.company) {
            setCompanyProfile(response.company);
            if (!company) {
              setCompany(response.company.name);
              setLocation(response.company.location);
            }
          }
        } catch {
          // No company profile, that's okay
        }
      }
    }
    loadCompany();
  }, [account, company]);

  // Pre-fill form if editing
  useEffect(() => {
    if (existingJob) {
      setTitle(existingJob.title || "");
      setDescription(existingJob.description || "");
      setCompany(existingJob.company || "");
      setLocation(existingJob.location || "");
      setLocationType(existingJob.location_type || "remote");
      setSalaryMin(existingJob.salary_min);
      setSalaryMax(existingJob.salary_max);
      setJobType(existingJob.job_type || "full-time");
      setDiscipline(existingJob.discipline || "engineering");
      setApplyLink(existingJob.apply_link || "");
      setExpirationDays(existingJob.expiration_days || 30);
      if (existingJob.image?.dataUrl) {
        setPreview(existingJob.image.dataUrl);
      }
    }
  }, [existingJob]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError("Image too large (max 25MB)");
      return;
    }

    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      setError("Only JPEG, PNG, GIF, and WebP images are supported");
      return;
    }

    setImage(file);
    setError(null);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const resetForm = () => {
    setImage(null);
    setPreview(null);
    setTitle("");
    setDescription("");
    setCompany(companyProfile?.name || "");
    setLocation(companyProfile?.location || "");
    setLocationType("remote");
    setSalaryMin(undefined);
    setSalaryMax(undefined);
    setJobType("full-time");
    setDiscipline("engineering");
    setApplyLink("");
    setExpirationDays(30);
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

      if (!title.trim() || !description.trim() || !company.trim() || !location.trim()) {
        setError("Please fill in all required fields");
        return;
      }

      if (!existingJob && !image) {
        setError("Please select an image");
        return;
      }

      setIsSubmitting(true);
      try {
        if (existingJob?.id) {
          // Update existing job
          const response = await jobApi.updateJob(existingJob.id, account, {
            title: title.trim(),
            description: description.trim(),
            location: location.trim(),
            location_type: locationType,
            salary_min: salaryMin,
            salary_max: salaryMax,
            job_type: jobType,
            discipline,
            apply_link: applyLink.trim() || undefined,
          });

          if (response.success) {
            setSuccess(true);
            setTimeout(() => {
              onJobCreated?.();
              onClose();
              resetForm();
            }, 1500);
          } else {
            setError(response.message || "Failed to update job listing");
          }
        } else {
          // Create new job
          const response = await jobApi.createJob({
            image: image!,
            owner: account,
            title: title.trim(),
            description: description.trim(),
            company: company.trim(),
            company_id: companyProfile?.id,
            location: location.trim(),
            location_type: locationType,
            salary_min: salaryMin,
            salary_max: salaryMax,
            job_type: jobType,
            discipline,
            apply_link: applyLink.trim() || undefined,
            expiration_days: expirationDays,
          });

          if (response.success) {
            setSuccess(true);
            setTimeout(() => {
              onJobCreated?.();
              onClose();
              resetForm();
            }, 1500);
          } else {
            setError(response.message || "Failed to create job listing");
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save job listing");
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, image, title, description, company, location, locationType, salaryMin, salaryMax, jobType, discipline, applyLink, expirationDays, companyProfile, existingJob, onJobCreated, onClose]
  );

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      resetForm();
      onClose();
    }
  }, [isSubmitting, onClose, companyProfile]);

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md">
        <div className="neo-card p-8 text-center max-w-md">
          <div className="text-6xl mb-4">💼</div>
          <h2 className="text-2xl font-black mb-2">
            {existingJob ? "Job Updated!" : "Job Posted!"}
          </h2>
          <p className="text-[var(--muted-ink)]">
            Your job listing has been saved to the blockchain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md overflow-y-auto py-8">
      <div className="neo-card p-6 w-full max-w-3xl mx-4 my-auto max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black">
            {existingJob ? "Edit Job Listing" : "Post a New Job"}
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

        {!companyProfile && (
          <div className="mb-4 p-3 bg-yellow-100 border-2 border-yellow-500 rounded-xl text-yellow-800 text-sm">
            💡 Tip: Create a company profile first to auto-fill company details and help candidates learn more about you.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Image Upload */}
          {!existingJob && (
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Company Logo / Job Image <span className="text-red-500">*</span>
              </label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleImageChange}
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                disabled={isSubmitting}
              />
              {preview && (
                <div className="mt-4 rounded-2xl overflow-hidden border-2 border-[var(--ink)] shadow-[6px_6px_0_rgba(0,0,0,0.18)] max-w-xs">
                  <img src={preview} alt="Preview" className="w-full h-auto object-cover max-h-48" />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Job Title */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="Senior Software Engineer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>

            {/* Company Name */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="Acme Inc."
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                maxLength={100}
                disabled={isSubmitting}
              />
            </div>

            {/* Discipline */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Discipline <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value as JobDiscipline)}
                disabled={isSubmitting}
              >
                {DISCIPLINES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            {/* Job Type */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Job Type <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                value={jobType}
                onChange={(e) => setJobType(e.target.value as typeof jobType)}
                disabled={isSubmitting}
              >
                {JOB_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
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

            {/* Location Type */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Work Location <span className="text-red-500">*</span>
              </label>
              <select
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                value={locationType}
                onChange={(e) => setLocationType(e.target.value as LocationType)}
                disabled={isSubmitting}
              >
                {LOCATION_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </select>
            </div>

            {/* Salary Min */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Salary Min (USD/year)
              </label>
              <input
                type="number"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="50000"
                value={salaryMin || ""}
                onChange={(e) => setSalaryMin(e.target.value ? parseInt(e.target.value) : undefined)}
                min={0}
                disabled={isSubmitting}
              />
            </div>

            {/* Salary Max */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                Salary Max (USD/year)
              </label>
              <input
                type="number"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="80000"
                value={salaryMax || ""}
                onChange={(e) => setSalaryMax(e.target.value ? parseInt(e.target.value) : undefined)}
                min={0}
                disabled={isSubmitting}
              />
            </div>

            {/* Apply Link */}
            <div>
              <label className="text-sm font-semibold uppercase tracking-wide">
                External Apply Link
              </label>
              <input
                type="url"
                className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                placeholder="https://company.com/careers/apply"
                value={applyLink}
                onChange={(e) => setApplyLink(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="mt-1 text-xs text-[var(--muted-ink)]">
                Optional: Link to external application form
              </p>
            </div>

            {/* Expiration */}
            {!existingJob && (
              <div>
                <label className="text-sm font-semibold uppercase tracking-wide">
                  Listing Duration <span className="text-red-500">*</span>
                </label>
                <select
                  className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(parseInt(e.target.value) as 30 | 60 | 90)}
                  disabled={isSubmitting}
                >
                  {EXPIRATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none resize-none"
              rows={6}
              placeholder="Describe the role, responsibilities, requirements, and what makes this opportunity special..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              disabled={isSubmitting}
            />
            <p className="mt-1 text-sm text-[var(--muted-ink)]">
              {description.length}/5000 characters
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
              disabled={isSubmitting || (!existingJob && !image) || !title.trim() || !description.trim() || !company.trim() || !location.trim()}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
                  {existingJob ? "Updating..." : "Posting..."}
                </span>
              ) : existingJob ? (
                "💾 Update Job"
              ) : (
                "💼 Post Job"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

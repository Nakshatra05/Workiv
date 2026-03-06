"use client";

import { FormEvent, useCallback, useState } from "react";
import { postApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPostCreated?: () => void;
}

export function CreatePostModal({
  isOpen,
  onClose,
  onPostCreated,
}: CreatePostModalProps) {
  const { account } = useWallet();
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError("Image too large (max 25MB)");
      return;
    }

    if (
      !["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)
    ) {
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

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!account) {
        setError("Please connect your wallet to post a job");
        return;
      }

      if (!image) {
        setError("Please select an image");
        return;
      }

      if (!caption.trim() || caption.length < 1 || caption.length > 500) {
        setError("Job description must be between 1 and 500 characters");
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await postApi.createPost(
          image,
          account,
          caption.trim()
        );
        if (response.success) {
          setImage(null);
          setPreview(null);
          setCaption("");
          setError(null);
          onPostCreated?.();
          onClose();
        } else {
          setError(response.message || "Failed to post job");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post job");
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, image, caption, onPostCreated, onClose]
  );

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setImage(null);
      setPreview(null);
      setCaption("");
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md">
      <div className="neo-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black">Post a Job</h2>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="neo-pill bg-[var(--surface)] text-[var(--ink)] text-xs font-semibold hover:scale-105 transition-transform disabled:opacity-50"
          >
            ✕ Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Company Logo / Job Image
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleImageChange}
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              disabled={isSubmitting}
            />
            {preview && (
              <div className="mt-4 rounded-2xl overflow-hidden border-2 border-[var(--ink)] shadow-[6px_6px_0_rgba(0,0,0,0.18)]">
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto object-cover max-h-96"
                />
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Job Description
            </label>
            <textarea
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              rows={4}
              placeholder="Describe the job role, requirements, and benefits..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={500}
              disabled={isSubmitting}
            />
            <p className="mt-2 text-sm text-[var(--muted-ink)]">
              {caption.length}/500 characters
            </p>
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
              disabled={isSubmitting || !image || !caption.trim() || !account}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
                  Posting...
                </span>
              ) : (
                "Post Job"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


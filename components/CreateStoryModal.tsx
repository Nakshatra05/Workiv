"use client";

import { FormEvent, useCallback, useState } from "react";
import { storiesApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStoryCreated?: () => void;
}

export function CreateStoryModal({
  isOpen,
  onClose,
  onStoryCreated,
}: CreateStoryModalProps) {
  const { account } = useWallet();
  const [media, setMedia] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [expirationTime, setExpirationTime] = useState<"1min" | "5min" | "24h">("24h");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setError("Media too large (max 25MB)");
      return;
    }

    setMedia(file);
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
        setError("Please connect your wallet to feature a job");
        return;
      }

      if (!media) {
        setError("Please select media");
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await storiesApi.createStory(
          media,
          account,
          content || undefined,
          expirationTime
        );
        if (response.success) {
          setMedia(null);
          setPreview(null);
          setContent("");
          setExpirationTime("24h");
          setError(null);
          onStoryCreated?.();
          onClose();
        } else {
          setError(response.message || "Failed to feature job");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to feature job");
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, media, content, expirationTime, onStoryCreated, onClose]
  );

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setMedia(null);
      setPreview(null);
      setContent("");
      setExpirationTime("24h");
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--page-bg)]/80 backdrop-blur-md">
      <div className="neo-card w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black">Feature a Job</h2>
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
              Job Image / Company Logo
            </label>
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleMediaChange}
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
              Highlight (optional)
            </label>
            <textarea
              className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
              rows={3}
              placeholder="Why is this job special? e.g., Urgent hiring, Great benefits..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="text-sm font-semibold uppercase tracking-wide">
              Feature duration
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="expiration"
                  value="1min"
                  checked={expirationTime === "1min"}
                  onChange={(e) => setExpirationTime(e.target.value as "1min" | "5min" | "24h")}
                  className="w-4 h-4 border-2 border-[var(--ink)]"
                  disabled={isSubmitting}
                />
                <span className="text-sm font-semibold">1 minute</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="expiration"
                  value="5min"
                  checked={expirationTime === "5min"}
                  onChange={(e) => setExpirationTime(e.target.value as "1min" | "5min" | "24h")}
                  className="w-4 h-4 border-2 border-[var(--ink)]"
                  disabled={isSubmitting}
                />
                <span className="text-sm font-semibold">5 minutes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="expiration"
                  value="24h"
                  checked={expirationTime === "24h"}
                  onChange={(e) => setExpirationTime(e.target.value as "1min" | "5min" | "24h")}
                  className="w-4 h-4 border-2 border-[var(--ink)]"
                  disabled={isSubmitting}
                />
                <span className="text-sm font-semibold">24 hours</span>
              </label>
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
              disabled={isSubmitting || !media || !account}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ink)] border-t-transparent" />
                  Featuring...
                </span>
              ) : (
                "Feature Job"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


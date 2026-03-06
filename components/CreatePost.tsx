"use client";

import { FormEvent, useCallback, useState } from "react";
import { postApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";

interface CreatePostProps {
  onPostCreated?: () => void;
}

export function CreatePost({ onPostCreated }: CreatePostProps) {
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
        const response = await postApi.createPost(image, account, caption.trim());
        if (response.success) {
          setImage(null);
          setPreview(null);
          setCaption("");
          onPostCreated?.();
        } else {
          setError(response.message || "Failed to post job");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to post job");
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, image, caption, onPostCreated]
  );

  return (
    <form onSubmit={handleSubmit} className="neo-card space-y-6 p-6 md:p-8">
      <h2 className="text-2xl font-black">Post a Job</h2>

      <div>
        <label className="text-sm font-semibold uppercase tracking-wide">
          Company Logo / Job Image
        </label>
        <input
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleImageChange}
          className="mt-2 w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-base shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
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
        />
        <p className="mt-2 text-sm text-[var(--muted-ink)]">
          {caption.length}/500 characters
        </p>
      </div>

      {error && (
        <p className="text-sm font-semibold text-red-600">{error}</p>
      )}

      <button
        type="submit"
        className="neo-button bg-[var(--accent)] text-[var(--ink)] disabled:opacity-50"
        disabled={isSubmitting || !image || !caption.trim() || !account}
      >
        {isSubmitting ? "Posting..." : "Post Job"}
      </button>
    </form>
  );
}


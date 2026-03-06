"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { commentsApi } from "@/lib/api-client";
import { useWallet } from "@/context/WalletContext";
import { Comment } from "@/app/types/api";

interface CommentsSectionProps {
  postId: string;
}

export function CommentsSection({ postId }: CommentsSectionProps) {
  const { account } = useWallet();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentContent, setCommentContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);

  const loadComments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await commentsApi.getComments(postId, 50, 0);
      if (response.success && response.comments) {
        setComments(response.comments);
      } else if (response.data?.comments) {
        setComments(response.data.comments);
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, loadComments]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!account) {
        setError("Please connect your wallet to apply");
        return;
      }

      if (!commentContent.trim() || commentContent.length < 1 || commentContent.length > 1000) {
        setError("Message must be between 1 and 1000 characters");
        return;
      }

      setIsSubmitting(true);
      try {
        const response = await commentsApi.createComment(
          postId,
          account,
          commentContent.trim()
        );
        if (response.success) {
          setCommentContent("");
          loadComments();
        } else {
          setError(response.message || "Failed to submit");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit");
      } finally {
        setIsSubmitting(false);
      }
    },
    [account, commentContent, postId, loadComments]
  );

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

  // Parse application content (JSON format from ApplyToJobModal)
  const parseApplicationContent = (content: string) => {
    try {
      const data = JSON.parse(content);
      if (data.type === "job_application") {
        return data;
      }
    } catch {
      // Not JSON, return null
    }
    return null;
  };

  // Render application card
  const renderApplication = (comment: Comment, appData: any) => (
    <div
      key={comment.id}
      className="rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="neo-pill bg-[var(--accent)] text-xs font-semibold">
            📋 Application
          </span>
          <span className="text-xs font-semibold text-[var(--ink)]">
            {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
          </span>
        </div>
        <span className="text-xs text-[var(--muted-ink)]">
          {formatDate(comment.created_at)}
        </span>
      </div>

      {appData.experience && (
        <div className="mb-2">
          <span className="text-xs font-semibold text-[var(--muted-ink)]">Experience: </span>
          <span className="text-xs text-[var(--ink)]">{appData.experience} years</span>
        </div>
      )}

      <div className="mb-3">
        <p className="text-xs font-semibold text-[var(--muted-ink)] mb-1">Cover Letter:</p>
        <p className="text-sm text-[var(--ink)] whitespace-pre-wrap">{appData.cover_letter}</p>
      </div>

      {(appData.portfolio_url || appData.linkedin_url) && (
        <div className="flex flex-wrap gap-2 mb-2">
          {appData.portfolio_url && (
            <a
              href={appData.portfolio_url}
              target="_blank"
              rel="noopener noreferrer"
              className="neo-pill bg-[var(--surface)] text-xs hover:scale-105 transition-transform"
            >
              🔗 Portfolio
            </a>
          )}
          {appData.linkedin_url && (
            <a
              href={appData.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="neo-pill bg-[var(--surface)] text-xs hover:scale-105 transition-transform"
            >
              💼 LinkedIn
            </a>
          )}
        </div>
      )}

      {account === comment.author && (
        <button
          type="button"
          onClick={async () => {
            if (confirm("Withdraw this application?")) {
              try {
                await commentsApi.deleteComment(comment.id, comment.author);
                loadComments();
              } catch (err) {
                alert(err instanceof Error ? err.message : "Failed to withdraw application");
              }
            }
          }}
          className="mt-2 text-xs text-red-600 font-semibold"
        >
          Withdraw Application
        </button>
      )}
    </div>
  );

  // Render regular inquiry
  const renderInquiry = (comment: Comment) => (
    <div
      key={comment.id}
      className="rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] p-4 shadow-[4px_4px_0_rgba(0,0,0,0.18)]"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-[var(--ink)]">
          {comment.author.slice(0, 6)}...{comment.author.slice(-4)}
        </span>
        <span className="text-xs text-[var(--muted-ink)]">
          {formatDate(comment.created_at)}
        </span>
      </div>
      <p className="text-sm text-[var(--ink)]">{comment.content}</p>
      {account === comment.author && (
        <button
          type="button"
          onClick={async () => {
            if (confirm("Delete this inquiry?")) {
              try {
                await commentsApi.deleteComment(comment.id, comment.author);
                loadComments();
              } catch (err) {
                alert(err instanceof Error ? err.message : "Failed to delete inquiry");
              }
            }
          }}
          className="mt-2 text-xs text-red-600 font-semibold"
        >
          Delete
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setShowComments(!showComments)}
        className="text-sm font-semibold text-[var(--ink)] hover:underline"
      >
        {showComments ? "Hide" : "View"} applications & inquiries ({comments.length})
      </button>

      {showComments && (
        <div className="space-y-4 border-t-2 border-[var(--ink)] pt-4">
          {account && (
            <form onSubmit={handleSubmit} className="space-y-3">
              <textarea
                className="w-full rounded-2xl border-2 border-[var(--ink)] bg-[var(--surface)] px-4 py-3 text-sm shadow-[5px_5px_0_rgba(0,0,0,0.18)] focus:outline-none"
                rows={3}
                placeholder="Ask a question about this job..."
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                maxLength={1000}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--muted-ink)]">
                  {commentContent.length}/1000 characters
                </p>
                <button
                  type="submit"
                  className="neo-pill bg-[var(--accent)] text-xs font-semibold disabled:opacity-50"
                  disabled={isSubmitting || !commentContent.trim()}
                >
                  {isSubmitting ? "Sending..." : "Ask Question"}
                </button>
              </div>
              {error && (
                <p className="text-xs font-semibold text-red-600">{error}</p>
              )}
            </form>
          )}

          {loading ? (
            <p className="text-sm text-[var(--muted-ink)]">Loading...</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-[var(--muted-ink)]">No applications or inquiries yet</p>
          ) : (
            <div className="space-y-3">
              {comments.map((comment) => {
                const appData = parseApplicationContent(comment.content);
                return appData
                  ? renderApplication(comment, appData)
                  : renderInquiry(comment);
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


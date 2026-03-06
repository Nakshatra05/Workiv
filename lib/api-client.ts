// API client utilities for Workiv endpoints
import { Post } from "@/app/types/api";

export type ApiResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  posts?: T[];
  post?: T;
  comments?: T[];
  stories?: T[];
  story?: T;
  profile?: T;
  total?: number;
  txHash?: string;
  entityKey?: string;
  explorerUrl?: string;
};

// Re-export Post type for convenience
export type { Post };

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public response?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");

  if (!response.ok) {
    const errorData = isJson ? await response.json().catch(() => ({})) : {};
    throw new ApiError(
      errorData.message || `HTTP error! status: ${response.status}`,
      response.status,
      errorData
    );
  }

  if (isJson) {
    return await response.json();
  }

  return { success: true } as ApiResponse<T>;
}

// Feed API
export const feedApi = {
  async getFeed(limit: number = 20): Promise<ApiResponse<any>> {
    const response = await fetch(`/api/feed?limit=${limit}`);
    return handleResponse(response);
  },

  // Subscribe to real-time feed via SSE
  subscribeRealtime(
    onPost: (post: any) => void,
    onError?: (error: Error) => void
  ): () => void {
    const eventSource = new EventSource("/api/feed/realtime");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "connected") {
          console.log("Connected to real-time feed");
        } else if (data.type === "new_post" && data.post) {
          onPost(data.post);
        }
      } catch (error) {
        console.error("Error parsing SSE event:", error);
        onError?.(error as Error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      onError?.(new Error("Connection to real-time feed failed"));
      eventSource.close();
    };

    // Return cleanup function
    return () => {
      eventSource.close();
    };
  },
};

// Post API
export const postApi = {
  async createPost(
    image: File,
    owner: string,
    caption: string
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("image", image);
    formData.append("owner", owner);
    formData.append("caption", caption);

    const response = await fetch("/api/post", {
      method: "POST",
      body: formData,
    });

    return handleResponse(response);
  },

  async getPost(postId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`/api/post?id=${postId}`);
    return handleResponse(response);
  },

  async updatePost(
    postId: string,
    owner: string,
    caption: string
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("post_id", postId);
    formData.append("owner", owner);
    formData.append("caption", caption);

    const response = await fetch("/api/post", {
      method: "PUT",
      body: formData,
    });

    return handleResponse(response);
  },

  async deletePost(postId: string, owner: string): Promise<ApiResponse<any>> {
    const response = await fetch(
      `/api/post?post_id=${postId}&owner=${owner}`,
      {
        method: "DELETE",
      }
    );

    return handleResponse(response);
  },
};

// Comments API
export const commentsApi = {
  async createComment(
    postId: string,
    author: string,
    content: string,
    parentCommentId?: string
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("post_id", postId);
    formData.append("author", author);
    formData.append("content", content);
    if (parentCommentId) {
      formData.append("parent_comment_id", parentCommentId);
    }

    const response = await fetch("/api/post/comments", {
      method: "POST",
      body: formData,
    });

    return handleResponse(response);
  },

  async getComments(
    postId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<ApiResponse<any>> {
    const response = await fetch(
      `/api/post/comments?post_id=${postId}&limit=${limit}&offset=${offset}`
    );
    return handleResponse(response);
  },

  async updateComment(
    commentId: string,
    author: string,
    content: string
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("comment_id", commentId);
    formData.append("author", author);
    formData.append("content", content);

    const response = await fetch("/api/post/comments", {
      method: "PUT",
      body: formData,
    });

    return handleResponse(response);
  },

  async deleteComment(
    commentId: string,
    author: string
  ): Promise<ApiResponse<any>> {
    const response = await fetch(
      `/api/post/comments?comment_id=${commentId}&author=${author}`,
      {
        method: "DELETE",
      }
    );

    return handleResponse(response);
  },
};

// Stories API
export const storiesApi = {
  async createStory(
    media: File,
    author: string,
    content?: string,
    expirationTime: "1min" | "5min" | "24h" = "24h"
  ): Promise<ApiResponse<any>> {
    const formData = new FormData();
    formData.append("media", media);
    formData.append("author", author);
    formData.append("expiration_time", expirationTime);
    if (content) {
      formData.append("content", content);
    }

    const response = await fetch("/api/stories", {
      method: "POST",
      body: formData,
    });

    return handleResponse(response);
  },

  async getStories(
    author?: string,
    limit: number = 20
  ): Promise<ApiResponse<any>> {
    const params = new URLSearchParams({ limit: limit.toString() });
    if (author) {
      params.append("author", author);
    }

    const response = await fetch(`/api/stories?${params.toString()}`);
    return handleResponse(response);
  },

  async getStory(storyId: string): Promise<ApiResponse<any>> {
    const response = await fetch(`/api/stories/${storyId}`);
    return handleResponse(response);
  },

  async deleteStory(storyId: string, author: string): Promise<ApiResponse<any>> {
    const response = await fetch(
      `/api/stories?story_id=${storyId}&author=${author}`,
      {
        method: "DELETE",
      }
    );

    return handleResponse(response);
  },
};

// Profile API
export const profileApi = {
  async createOrUpdateProfile(data: {
    wallet: string;
    displayName: string;
    bio: string;
    avatar: string;
    expiresInKey?: string;
  }): Promise<ApiResponse<any>> {
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    return handleResponse(response);
  },

  async getProfileByWallet(wallet: string): Promise<ApiResponse<any>> {
    const response = await fetch(`/api/profile?wallet=${wallet}`);
    return handleResponse(response);
  },

  async deleteProfile(wallet: string): Promise<ApiResponse<any>> {
    const response = await fetch(`/api/profile?wallet=${wallet}`, {
      method: "DELETE",
    });
    return handleResponse(response);
  },
};


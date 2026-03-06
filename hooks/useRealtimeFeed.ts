import { useEffect, useState, useRef } from "react";
import { Post } from "../app/types/api";

interface RealtimeEvent {
  type: "connected" | "new_post" | "post_updated" | "post_deleted";
  post?: Post;
  entityKey?: string;
}

export function useRealtimeFeed() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Connect to Server-Sent Events endpoint
    const eventSource = new EventSource("/api/feed/realtime");
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data: RealtimeEvent = JSON.parse(event.data);

        switch (data.type) {
          case "connected":
            setIsConnected(true);
            break;

          case "new_post":
            if (data.post) {
              const newPost = data.post;
              setPosts((prevPosts) => {
                // Check if post already exists (avoid duplicates)
                const exists = prevPosts.some((p) => p.id === newPost.id);
                if (exists) return prevPosts;

                // Add new post at the beginning (newest first)
                return [newPost, ...prevPosts];
              });
            }
            break;

          case "post_updated":
            // Handle post updates (likes, comments, etc.)
            // For now, just log - could implement more sophisticated update logic
            console.log("Post updated:", data.entityKey);
            break;

          case "post_deleted":
            // Remove deleted post from feed
            if (data.entityKey) {
              setPosts((prevPosts) =>
                prevPosts.filter((p) => p.id !== data.entityKey)
              );
            }
            break;
        }
      } catch (error) {
        console.error("Error parsing realtime event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("EventSource error:", error);
      setIsConnected(false);
    };

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    // Cleanup on unmount
    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, []);

  // Function to load initial posts
  const loadInitialPosts = async (limit: number = 20) => {
    try {
      const response = await fetch(`/api/feed?limit=${limit}`);
      if (response.ok) {
        const initialPosts: Post[] = await response.json();
        setPosts(initialPosts);
      }
    } catch (error) {
      console.error("Error loading initial posts:", error);
    }
  };

  return {
    posts,
    isConnected,
    loadInitialPosts,
  };
}

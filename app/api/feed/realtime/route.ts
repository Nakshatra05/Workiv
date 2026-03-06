import { NextRequest } from "next/server";
import { eq } from "@arkiv-network/sdk/query";
import { publicClient } from "../../../lib/arkiv";
import { Post } from "../../../types/api";
import { MediaService } from "../../../services/media";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Set up Server-Sent Events for real-time feed updates
  const responseStream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      controller.enqueue(encoder.encode('data: {"type": "connected"}\n\n'));

      let lastCheckedTime = Date.now();
      let isActive = true;

      // Function to check for new posts
      const checkForNewPosts = async () => {
        if (!isActive) return;

        try {
          // Query posts created since last check
          const postsQuery = publicClient
            .buildQuery()
            .where(eq("type", "post"))
            .withPayload(true)
            .withAttributes(true)
            .limit(10); // Check recent posts

          const queryResult = await postsQuery.fetch();
          const postEntities = queryResult.entities || queryResult;

          if (Array.isArray(postEntities)) {
            // Filter posts created since last check
            const newPosts = postEntities.filter((entity) => {
              if (!entity.payload) return false;
              try {
                const postData = JSON.parse(
                  new TextDecoder().decode(entity.payload)
                );
                return postData.created_at > lastCheckedTime;
              } catch {
                return false;
              }
            });

            // Process new posts
            for (const postEntity of newPosts.reverse()) {
              // Reverse to send oldest first
              try {
                const postData = JSON.parse(
                  new TextDecoder().decode(postEntity.payload)
                );
                const mediaId = postData.media_id;

                // Fetch media data using the service
                const imageData = mediaId
                  ? await MediaService.fetchPostImage(mediaId)
                  : null;

                // Send the new post to connected clients
                const newPost: Post = {
                  id: postEntity.key,
                  owner: postData.owner,
                  caption: postData.caption,
                  media_id: mediaId,
                  likes: postData.likes || [],
                  comments: postData.comments || [],
                  created_at: postData.created_at,
                  updated_at: postData.updated_at,
                  image: imageData || undefined,
                };

                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "new_post",
                      post: newPost,
                    })}\n\n`
                  )
                );
              } catch (error) {
                console.error("Error processing new post:", error);
              }
            }

            // Update last checked time
            lastCheckedTime = Date.now();
          }
        } catch (error) {
          console.error("Error checking for new posts:", error);
        }
      };

      // Check for new posts every 3 seconds
      const interval = setInterval(checkForNewPosts, 3000);

      // Clean up when connection closes
      request.signal.addEventListener("abort", () => {
        isActive = false;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  });
}

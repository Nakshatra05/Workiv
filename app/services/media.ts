import { eq } from "@arkiv-network/sdk/query";
import { publicClient } from "../lib/arkiv";
import { MediaMetadata, JobImage } from "../types/api";

export class MediaService {
  static async fetchPostImage(mediaId: string): Promise<JobImage | null> {
    try {
      // Query for image metadata
      const metadataQuery = publicClient
        .buildQuery()
        .where(eq("type", "image_metadata"))
        .where(eq("media_id", mediaId))
        .withPayload(true)
        .limit(1);

      const metadataResult = await metadataQuery.fetch();
      if (!metadataResult.entities || metadataResult.entities.length === 0) {
        return null;
      }

      const metadata: MediaMetadata = JSON.parse(
        new TextDecoder().decode(metadataResult.entities[0].payload)
      );

      const imageQuery = publicClient
        .buildQuery()
        .where(eq("type", "image"))
        .where(eq("media_id", mediaId))
        .withPayload(true)
        .limit(1);

      const imageResult = await imageQuery.fetch();
      if (!imageResult.entities || imageResult.entities.length === 0) {
        return null;
      }

      const imageEntity = imageResult.entities[0];
      if (!imageEntity || !imageEntity.payload) {
        return null;
      }

      // Convert to base64 data URL
      const imageBuffer = Buffer.from(imageEntity.payload);
      const imageBase64 = imageBuffer.toString("base64");
      const imageDataUrl = `data:${metadata.content_type};base64,${imageBase64}`;

      return {
        dataUrl: imageDataUrl,
        filename: metadata.filename,
        contentType: metadata.content_type,
        fileSize: metadata.file_size,
      };
    } catch (error) {
      console.error("Error fetching post image:", error);
      return null;
    }
  }

  static async fetchPostMedia(
    metadataEntityKey: string,
    imageEntityKey: string
  ): Promise<JobImage | null> {
    try {
      // Fetch metadata directly by key
      const metadataEntity = await publicClient.getEntity(
        metadataEntityKey as `0x${string}`
      );
      if (!metadataEntity || !metadataEntity.payload) {
        return null;
      }

      const metadata: MediaMetadata = JSON.parse(
        new TextDecoder().decode(metadataEntity.payload)
      );

      // Fetch the image directly by key
      const imageEntity = await publicClient.getEntity(
        imageEntityKey as `0x${string}`
      );
      if (!imageEntity || !imageEntity.payload) {
        return null;
      }

      // Convert to base64 data URL
      const imageBuffer = Buffer.from(imageEntity.payload);
      const imageBase64 = imageBuffer.toString("base64");
      const imageDataUrl = `data:${metadata.content_type};base64,${imageBase64}`;

      return {
        dataUrl: imageDataUrl,
        filename: metadata.filename,
        contentType: metadata.content_type,
        fileSize: metadata.file_size,
      };
    } catch (error) {
      console.error("Error fetching post media:", error);
      return null;
    }
  }
}

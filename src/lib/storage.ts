import { supabase } from "./supabase";

const BUCKET_NAME = "bingo-photos";

export interface PhotoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

export async function uploadPhoto(
  file: File,
  gameId: string,
  participantId: string,
  cellIndex: number
): Promise<PhotoUploadResult> {
  try {
    // Create a unique filename
    const fileExt = file.name.split(".").pop();
    const fileName = `${gameId}/${participantId}/${cellIndex}-${Date.now()}.${fileExt}`;

    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Upload error:", error);
      return { success: false, error: error.message };
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return { success: true, url: publicUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function deletePhoto(url: string): Promise<boolean> {
  try {
    // Extract file path from URL
    const urlParts = url.split("/");
    const bucketIndex = urlParts.findIndex((part) => part === BUCKET_NAME);
    if (bucketIndex === -1) return false;

    const filePath = urlParts.slice(bucketIndex + 1).join("/");

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([filePath]);

    if (error) {
      console.error("Delete error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Delete error:", error);
    return false;
  }
}

export function getPhotoUrl(
  gameId: string,
  participantId: string,
  cellIndex: number,
  timestamp?: number
): string {
  const fileExt = "jpg"; // Default extension
  const fileName = `${gameId}/${participantId}/${cellIndex}-${timestamp || Date.now()}.${fileExt}`;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

  return publicUrl;
}

// Check if storage bucket exists and create if needed
export async function initializeStorage(): Promise<boolean> {
  try {
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      console.error("Error listing buckets:", listError);
      return false;
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          allowedMimeTypes: [
            "image/webp",
            "image/jpeg",
            "image/png",
            "video/webm",
            "video/mp4",
          ],
          fileSizeLimit: 5242880, // 5MB limit (supports optimized videos)
        }
      );

      if (createError) {
        console.error("Error creating bucket:", createError);
        return false;
      }

      console.log("Created storage bucket:", BUCKET_NAME);
    }

    return true;
  } catch (error) {
    console.error("Storage initialization error:", error);
    return false;
  }
}

export async function deleteAllGamePhotos(gameId: string): Promise<boolean> {
  try {
    // List all files in the game folder
    const { data: files, error: listError } = await supabase.storage
      .from(BUCKET_NAME)
      .list(gameId, {
        limit: 1000, // Adjust if you expect more than 1000 photos per game
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      console.error("Error listing game photos:", listError);
      return false;
    }

    if (!files || files.length === 0) {
      console.log(`No photos found for game ${gameId}`);
      return true; // No photos to delete is considered success
    }

    // Create full paths for all files in the game folder
    const filePaths: string[] = [];

    // Get all files recursively (including subdirectories for participants)
    const getAllFiles = async (prefix: string): Promise<string[]> => {
      const { data: folderFiles, error: folderError } = await supabase.storage
        .from(BUCKET_NAME)
        .list(prefix, {
          limit: 1000,
          sortBy: { column: "name", order: "asc" },
        });

      if (folderError) {
        console.error(`Error listing files in ${prefix}:`, folderError);
        return [];
      }

      if (!folderFiles) return [];

      const paths: string[] = [];

      for (const file of folderFiles) {
        const fullPath = prefix ? `${prefix}/${file.name}` : file.name;

        // If it's a folder (no metadata.size means it's a folder), recurse into it
        if (!file.metadata?.size && file.name !== ".emptyFolderPlaceholder") {
          const subPaths = await getAllFiles(fullPath);
          paths.push(...subPaths);
        } else if (file.metadata?.size) {
          // It's a file
          paths.push(fullPath);
        }
      }

      return paths;
    };

    const allFilePaths = await getAllFiles(gameId);

    if (allFilePaths.length === 0) {
      console.log(`No photos found for game ${gameId}`);
      return true;
    }

    console.log(`Deleting ${allFilePaths.length} photos for game ${gameId}`);

    // Delete all files
    const { error: deleteError } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(allFilePaths);

    if (deleteError) {
      console.error("Error deleting game photos:", deleteError);
      return false;
    }

    console.log(`Successfully deleted all photos for game ${gameId}`);
    return true;
  } catch (error) {
    console.error("Error deleting game photos:", error);
    return false;
  }
}

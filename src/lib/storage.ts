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
          allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
          fileSizeLimit: 5242880, // 5MB limit
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

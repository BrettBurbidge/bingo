import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { supabase } from "$lib/supabase";

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const gameId = params.id;
    const formData = await request.formData();

    const file = formData.get("file") as File;
    const participantId = formData.get("participantId") as string;
    const cellIndex = parseInt(formData.get("cellIndex") as string);

    if (!file || !participantId || isNaN(cellIndex)) {
      throw error(400, "File, participant ID, and cell index are required");
    }

    // Validate file type - accept images and videos
    // Handle MIME types with codec information (e.g., "video/webm;codecs=vp9")
    const baseMimeType = file.type.toLowerCase().split(";")[0];

    // Debug logging
    console.log("File upload debug:", {
      originalType: file.type,
      baseMimeType: baseMimeType,
      fileName: file.name,
      fileSize: file.size,
    });

    const allowedImageTypes = [
      "image/webp",
      "image/jpeg",
      "image/jpg",
      "image/png",
    ];
    const allowedVideoTypes = [
      "video/mp4",
      "video/quicktime",
      "video/x-m4v",
      "video/mp4v-es",
    ]; // MP4 variants for Supabase compatibility
    const allAllowedTypes = [...allowedImageTypes, ...allowedVideoTypes];

    const isImage = allowedImageTypes.includes(baseMimeType);
    const isVideo = allowedVideoTypes.includes(baseMimeType);

    if (!allAllowedTypes.includes(baseMimeType)) {
      console.error("File type rejected:", {
        baseMimeType,
        allowedTypes: allAllowedTypes,
        fileName: file.name,
      });
      throw error(
        400,
        `File type '${baseMimeType}' not allowed. Only WebP, JPEG, PNG images and MP4 videos are allowed`
      );
    }

    // Validate file size based on media type
    const maxImageSize = 1 * 1024 * 1024; // 1MB for images
    const maxVideoSize = 30 * 1024 * 1024; // 30MB for videos (matches Supabase storage limit)
    const maxSize = isVideo ? maxVideoSize : maxImageSize;

    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024);
      const fileSizeMB = Math.round((file.size / 1024 / 1024) * 10) / 10;
      throw error(
        400,
        `${isVideo ? "Video" : "Image"} file size must be less than ${maxSizeMB}MB. Your file is ${fileSizeMB}MB`
      );
    }

    // Create a unique filename with proper extension
    let fileExt = "jpg"; // default
    if (baseMimeType === "image/webp") fileExt = "webp";
    else if (baseMimeType === "image/png") fileExt = "png";
    else if (isVideo) fileExt = "mp4"; // All supported video types use .mp4 extension

    const fileName = `${gameId}/${participantId}/${cellIndex}-${Date.now()}.${fileExt}`;

    // Convert File to ArrayBuffer for upload
    const fileBuffer = await file.arrayBuffer();

    // Upload directly to Supabase Storage with optimized settings
    const { data, error: uploadError } = await supabase.storage
      .from("bingo-photos")
      .upload(fileName, fileBuffer, {
        contentType: baseMimeType, // Use base MIME type without codec info
        cacheControl: "31536000", // 1 year cache for photos (they don't change)
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      throw error(500, uploadError.message);
    }

    // Get the public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("bingo-photos").getPublicUrl(fileName);

    return json({
      success: true,
      photoUrl: publicUrl,
    });
  } catch (err) {
    console.error("Error uploading photo:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to upload photo");
  }
};

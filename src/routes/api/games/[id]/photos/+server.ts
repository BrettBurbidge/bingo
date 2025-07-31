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

    // Validate file type - accept WebP, JPEG, PNG
    const allowedTypes = ["image/webp", "image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw error(400, "Only WebP, JPEG, and PNG image files are allowed");
    }

    // Validate file size (reduced from 5MB to 1MB for optimized images)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      throw error(
        400,
        `File size must be less than 1MB. Your file is ${Math.round((file.size / 1024 / 1024) * 10) / 10}MB`
      );
    }

    // Create a unique filename with proper extension
    const fileExt =
      file.type === "image/webp"
        ? "webp"
        : file.type === "image/png"
          ? "png"
          : "jpg";
    const fileName = `${gameId}/${participantId}/${cellIndex}-${Date.now()}.${fileExt}`;

    // Convert File to ArrayBuffer for upload
    const fileBuffer = await file.arrayBuffer();

    // Upload directly to Supabase Storage with optimized settings
    const { data, error: uploadError } = await supabase.storage
      .from("bingo-photos")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
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

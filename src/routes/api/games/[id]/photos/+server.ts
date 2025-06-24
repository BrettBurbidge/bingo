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

    // Validate file type
    if (!file.type.startsWith("image/")) {
      throw error(400, "Only image files are allowed");
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      throw error(400, "File size must be less than 5MB");
    }

    // Create a unique filename
    const fileExt = file.name.split(".").pop() || "jpg";
    const fileName = `${gameId}/${participantId}/${cellIndex}-${Date.now()}.${fileExt}`;

    // Convert File to ArrayBuffer for upload
    const fileBuffer = await file.arrayBuffer();

    // Upload directly to Supabase Storage
    const { data, error: uploadError } = await supabase.storage
      .from("bingo-photos")
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600",
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

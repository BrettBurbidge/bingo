import { supabase } from "./supabase";

export async function setupStorage() {
  console.log("Initializing Supabase Storage...");

  try {
    const BUCKET_NAME = "bingo-photos";

    // Check if bucket exists
    const { data: buckets, error: listError } =
      await supabase.storage.listBuckets();

    if (listError) {
      console.error("Error listing buckets:", listError);
      return false;
    }

    const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);

    if (!bucketExists) {
      console.log("Creating storage bucket...");

      // Create bucket
      const { error: createError } = await supabase.storage.createBucket(
        BUCKET_NAME,
        {
          public: true,
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/jpg",
          ],
          fileSizeLimit: 5242880, // 5MB
        }
      );

      if (createError) {
        console.error("Error creating bucket:", createError);
        console.error(
          "Please create the bucket manually in Supabase Dashboard:"
        );
        console.error("1. Go to Storage → Buckets");
        console.error("2. Create bucket: 'bingo-photos' (public)");
        console.error("3. See SETUP_STORAGE.md for detailed instructions");
        return false;
      }

      console.log("✅ Created storage bucket:", BUCKET_NAME);
    } else {
      console.log("✅ Storage bucket already exists:", BUCKET_NAME);
    }

    // Test upload permissions
    try {
      const testFile = new File(["test"], "test.txt", { type: "text/plain" });
      const testPath = "test-file.txt";

      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(testPath, testFile);

      if (uploadError && !uploadError.message.includes("already exists")) {
        console.error("Upload test failed:", uploadError);
        return false;
      }

      // Clean up test file
      await supabase.storage.from(BUCKET_NAME).remove([testPath]);

      console.log("✅ Upload permissions verified");
    } catch (error) {
      console.error("Upload test error:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Storage setup error:", error);
    return false;
  }
}

// Auto-run setup when imported
if (typeof window !== "undefined") {
  setupStorage();
}

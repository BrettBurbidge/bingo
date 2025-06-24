# Supabase Storage Setup for Bingo Photos

To enable photo uploads in the Bingo app, you need to set up a storage bucket in Supabase.

## Manual Setup (Recommended)

1. **Go to your Supabase Dashboard**
   - Navigate to Storage → Buckets

2. **Create a new bucket:**
   - Bucket name: `bingo-photos`
   - Make it **Public** (check the "Public bucket" option)
   - File size limit: 5MB
   - Allowed file types: `image/jpeg, image/png, image/webp`

3. **Set up Storage Policies (if needed):**
   If you encounter "RLS policy" errors, add these policies in Storage → Policies:

   **Policy for SELECT (viewing photos):**

   ```sql
   CREATE POLICY "Anyone can view bingo photos" ON storage.objects
   FOR SELECT USING (bucket_id = 'bingo-photos');
   ```

   **Policy for INSERT (uploading photos):**

   ```sql
   CREATE POLICY "Anyone can upload bingo photos" ON storage.objects
   FOR INSERT WITH CHECK (bucket_id = 'bingo-photos');
   ```

   **Policy for DELETE (cleanup):**

   ```sql
   CREATE POLICY "Anyone can delete bingo photos" ON storage.objects
   FOR DELETE USING (bucket_id = 'bingo-photos');
   ```

## Alternative: Automatic Setup via SQL

Run this SQL in your Supabase SQL Editor:

```sql
-- Create the bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'bingo-photos',
  'bingo-photos',
  true,
  5242880,
  '{"image/jpeg","image/png","image/webp","image/jpg"}'
)
ON CONFLICT (id) DO NOTHING;

-- Create policies
CREATE POLICY "Anyone can view bingo photos" ON storage.objects
FOR SELECT USING (bucket_id = 'bingo-photos');

CREATE POLICY "Anyone can upload bingo photos" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'bingo-photos');

CREATE POLICY "Anyone can delete bingo photos" ON storage.objects
FOR DELETE USING (bucket_id = 'bingo-photos');
```

## Testing

After setup, the app should automatically detect the bucket and allow photo uploads. Check the browser console for any setup messages.

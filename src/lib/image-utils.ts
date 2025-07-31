export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
  maxSizeKB?: number;
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  format: string;
}

/**
 * Compresses an image file for optimal upload performance and storage efficiency
 * Default settings provide ~70-80% size reduction while maintaining good quality
 */
export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1200,        // Good for web display, saves significant space
    maxHeight = 1200,       // Square aspect ratio works well for bingo photos
    quality = 0.8,          // 80% quality - good balance of size vs quality
    format = 'webp',        // WebP provides ~30% better compression than JPEG
    maxSizeKB = 500         // Target max size of 500KB (down from 5MB limit)
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    img.onload = () => {
      // Calculate new dimensions while maintaining aspect ratio
      let { width, height } = calculateDimensions(
        img.width,
        img.height,
        maxWidth,
        maxHeight
      );

      canvas.width = width;
      canvas.height = height;

      // Draw and compress the image
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fallback to JPEG if not supported
      const mimeType = format === 'webp' && supportsWebP() 
        ? 'image/webp' 
        : 'image/jpeg';

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to compress image'));
            return;
          }

          let finalBlob = blob;
          let finalQuality = quality;

          // If still too large, reduce quality iteratively
          if (blob.size > maxSizeKB * 1024 && finalQuality > 0.3) {
            finalBlob = await reduceQualityUntilTargetSize(
              canvas,
              mimeType,
              maxSizeKB * 1024,
              finalQuality
            );
          }

          const originalSize = file.size;
          const compressedSize = finalBlob.size;
          const compressionRatio = Math.round((1 - compressedSize / originalSize) * 100);

          // Create optimized filename
          const extension = mimeType === 'image/webp' ? 'webp' : 'jpg';
          const timestamp = Date.now();
          const optimizedFile = new File(
            [finalBlob],
            `bingo-photo-${timestamp}.${extension}`,
            { type: mimeType }
          );

          resolve({
            file: optimizedFile,
            originalSize,
            compressedSize,
            compressionRatio,
            format: mimeType
          });
        },
        mimeType,
        finalQuality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  let width = originalWidth;
  let height = originalHeight;

  // Scale down if needed
  if (width > maxWidth) {
    height = (height * maxWidth) / width;
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = (width * maxHeight) / height;
    height = maxHeight;
  }

  return {
    width: Math.round(width),
    height: Math.round(height)
  };
}

/**
 * Reduce quality iteratively until target size is reached
 */
async function reduceQualityUntilTargetSize(
  canvas: HTMLCanvasElement,
  mimeType: string,
  targetSize: number,
  startQuality: number
): Promise<Blob> {
  let quality = startQuality;
  let blob: Blob | null = null;

  while (quality > 0.3) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, quality);
    });

    if (blob && blob.size <= targetSize) {
      break;
    }

    quality -= 0.1;
  }

  // If we can't reach target size, return the best we can do
  if (!blob) {
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, mimeType, 0.3);
    });
  }

  return blob!;
}

/**
 * Check if browser supports WebP
 */
function supportsWebP(): boolean {
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
}

/**
 * Convert any image to optimized format for consistent compression
 */
export async function optimizeImageForUpload(file: File): Promise<CompressionResult> {
  // Use aggressive compression for photos that need to load quickly
  return compressImage(file, {
    maxWidth: 1200,
    maxHeight: 1200,
    quality: 0.85,
    format: 'webp',
    maxSizeKB: 400  // Target 400KB for fast loading
  });
}

/**
 * Create a smaller thumbnail for instant preview
 */
export async function createThumbnail(file: File): Promise<string> {
  const result = await compressImage(file, {
    maxWidth: 300,
    maxHeight: 300,
    quality: 0.7,
    format: 'webp',
    maxSizeKB: 50  // Very small for instant preview
  });

  return URL.createObjectURL(result.file);
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
} 
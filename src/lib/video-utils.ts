export interface VideoCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxDurationSeconds?: number;
  quality?: number;
  maxSizeMB?: number;
  format?: "webm" | "mp4";
}

export interface VideoCompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  duration: number;
  format: string;
  thumbnail?: string;
}

/**
 * Compresses a video file for optimal upload and streaming
 * Default settings provide significant size reduction while maintaining quality
 */
export async function compressVideo(
  file: File,
  options: VideoCompressionOptions = {}
): Promise<VideoCompressionResult> {
  const {
    maxWidth = 720, // Good balance for mobile and web
    maxHeight = 720, // Square format works well for bingo
    maxDurationSeconds = 30, // Reasonable limit for bingo videos
    quality = 0.7, // Good compression while maintaining quality
    maxSizeMB = 5, // Target max size
    format = "webm", // WebM provides better compression
  } = options;

  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      reject(new Error("Canvas context not available"));
      return;
    }

    video.onloadedmetadata = async () => {
      try {
        const duration = Math.min(video.duration, maxDurationSeconds);

        // Calculate optimal dimensions
        const { width, height } = calculateVideoDimensions(
          video.videoWidth,
          video.videoHeight,
          maxWidth,
          maxHeight
        );

        canvas.width = width;
        canvas.height = height;

        // Check browser support for MediaRecorder
        const mimeType = getSupportedVideoMimeType(format);

        if (!mimeType) {
          reject(new Error("Video recording not supported in this browser"));
          return;
        }

        // Create compressed video
        const compressedBlob = await recordCompressedVideo(
          video,
          canvas,
          ctx,
          duration,
          quality,
          mimeType
        );

        // If still too large, try additional compression
        let finalBlob = compressedBlob;
        if (compressedBlob.size > maxSizeMB * 1024 * 1024) {
          finalBlob = await reduceVideoQuality(
            video,
            canvas,
            ctx,
            duration,
            quality * 0.7,
            mimeType
          );
        }

        // Generate thumbnail
        const thumbnail = await generateVideoThumbnail(video, canvas, ctx);

        const originalSize = file.size;
        const compressedSize = finalBlob.size;
        const compressionRatio = Math.round(
          (1 - compressedSize / originalSize) * 100
        );

        // Create optimized filename
        const extension = mimeType.includes("webm") ? "webm" : "mp4";
        const timestamp = Date.now();
        const optimizedFile = new File(
          [finalBlob],
          `bingo-video-${timestamp}.${extension}`,
          { type: mimeType }
        );

        resolve({
          file: optimizedFile,
          originalSize,
          compressedSize,
          compressionRatio,
          duration,
          format: mimeType,
          thumbnail,
        });
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => reject(new Error("Failed to load video"));
    video.src = URL.createObjectURL(file);
    video.load();
  });
}

/**
 * Calculate optimal video dimensions while maintaining aspect ratio
 */
function calculateVideoDimensions(
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

  // Ensure even dimensions for video encoding
  return {
    width: Math.round(width / 2) * 2,
    height: Math.round(height / 2) * 2,
  };
}

/**
 * Get supported video MIME type for the browser
 */
function getSupportedVideoMimeType(
  preferredFormat: "webm" | "mp4"
): string | null {
  const types =
    preferredFormat === "webm"
      ? [
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
          "video/mp4;codecs=h264",
        ]
      : [
          "video/mp4;codecs=h264",
          "video/webm;codecs=vp9",
          "video/webm;codecs=vp8",
        ];

  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  return null;
}

/**
 * Record compressed video using MediaRecorder API
 */
async function recordCompressedVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  duration: number,
  quality: number,
  mimeType: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(30); // 30 FPS for smoother video
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.round(2000000 * quality), // Higher bitrate for better quality
    });

    const chunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve(blob);
    };

    mediaRecorder.onerror = () => {
      reject(new Error("Video recording failed"));
    };

    // Start recording
    mediaRecorder.start();

    // Play and draw video frames
    let currentTime = 0;
    const frameInterval = 1000 / 30; // 30 FPS for smoother playback

    const drawFrame = () => {
      if (currentTime >= duration) {
        mediaRecorder.stop();
        return;
      }

      video.currentTime = currentTime;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      currentTime += frameInterval / 1000;

      setTimeout(drawFrame, frameInterval);
    };

    // Start when video is ready
    video.onseeked = drawFrame;
    video.currentTime = 0;
  });
}

/**
 * Reduce video quality for size constraints
 */
async function reduceVideoQuality(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  duration: number,
  quality: number,
  mimeType: string
): Promise<Blob> {
  return recordCompressedVideo(video, canvas, ctx, duration, quality, mimeType);
}

/**
 * Generate a thumbnail from the video
 */
async function generateVideoThumbnail(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D
): Promise<string> {
  // Seek to middle of video for thumbnail
  video.currentTime = video.duration / 2;

  return new Promise((resolve) => {
    video.onseeked = () => {
      // Draw frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert to thumbnail
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(URL.createObjectURL(blob));
          } else {
            resolve("");
          }
        },
        "image/jpeg",
        0.8
      );
    };
  });
}

/**
 * Check if browser supports video recording
 */
export function supportsVideoRecording(): boolean {
  if (
    !(
      navigator.mediaDevices &&
      navigator.mediaDevices.getUserMedia &&
      typeof window !== "undefined" &&
      "MediaRecorder" in window
    )
  ) {
    return false;
  }

  // Check specifically for MP4 support
  return MediaRecorder.isTypeSupported("video/mp4;codecs=h264");
}

/**
 * Optimize video for upload with MP4 compatibility
 * For MP4 files: skip compression to avoid format conversion issues
 * For recorded videos: compress to MP4 (when possible)
 */
export async function optimizeVideoForUpload(
  file: File
): Promise<VideoCompressionResult> {
  // Check if the input file is an MP4 variant
  const baseMimeType = file.type.toLowerCase().split(";")[0];
  const supportedVideoTypes = [
    "video/mp4",
    "video/quicktime",
    "video/x-m4v",
    "video/mp4v-es",
  ];

  if (!supportedVideoTypes.includes(baseMimeType)) {
    throw new Error(
      `Unsupported video format: ${baseMimeType}. Only MP4 videos are supported for upload.`
    );
  }

  // For MP4 files, skip compression to avoid format conversion issues
  // Just return the original file with basic stats
  if (baseMimeType === "video/mp4" || baseMimeType === "video/quicktime") {
    const duration = await getVideoDuration(file);

    // Create a new file with a proper name for upload
    const timestamp = Date.now();
    const optimizedFile = new File([file], `bingo-video-${timestamp}.mp4`, {
      type: "video/mp4",
    });

    return {
      file: optimizedFile,
      originalSize: file.size,
      compressedSize: file.size,
      compressionRatio: 0, // No compression applied
      duration: duration,
      format: "video/mp4",
    };
  }

  // For other formats (like recorded videos), attempt compression
  return compressVideo(file, {
    maxWidth: 1080, // Higher resolution for better quality
    maxHeight: 1080,
    maxDurationSeconds: 30,
    quality: 0.8, // Higher quality (less compression)
    maxSizeMB: 20, // Larger target size for better quality (under 30MB limit)
    format: "mp4",
  });
}

/**
 * Get video duration without full processing
 */
export async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");

    video.onloadedmetadata = () => {
      resolve(video.duration);
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      reject(new Error("Failed to load video"));
      URL.revokeObjectURL(video.src);
    };

    video.src = URL.createObjectURL(file);
  });
}

/**
 * Format duration for display (MM:SS)
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

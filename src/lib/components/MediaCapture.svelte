<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import Button from "./ui/button.svelte";
  import * as Dialog from "./ui/dialog";
  import {
    optimizeImageForUpload,
    formatFileSize,
    type CompressionResult,
  } from "$lib/image-utils";
  import {
    optimizeVideoForUpload,
    supportsVideoRecording,
    getVideoDuration,
    formatDuration,
    type VideoCompressionResult,
  } from "$lib/video-utils";

  export let open = false;
  export let cellText = "";

  type MediaType = "photo" | "video";
  type MediaResult = {
    type: MediaType;
    file: File;
    compressionInfo?: CompressionResult | VideoCompressionResult;
  };

  const dispatch = createEventDispatcher<{
    media: MediaResult;
    cancel: void;
  }>();

  let video: HTMLVideoElement;
  let canvas: HTMLCanvasElement;
  let stream: MediaStream | null = null;
  let showCamera = false;
  let capturedMedia: MediaResult | null = null;
  let mediaPreview: string | null = null;
  let fileInput: HTMLInputElement;
  let isCompressing = false;
  let selectedMediaType: MediaType = "photo";
  let isRecording = false;
  let recordingDuration = 0;
  let recordingInterval: number | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let recordedChunks: Blob[] = [];

  // Video recording constraints
  const MAX_RECORDING_TIME = 30; // 30 seconds max

  async function startCamera() {
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: "environment" },
        audio: selectedMediaType === "video", // Only include audio for video
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (video) {
        video.srcObject = stream;
        showCamera = true;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Unable to access camera. Please try uploading a file instead.");
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    showCamera = false;
    stopRecording();
  }

  async function capturePhoto() {
    if (!video || !canvas || selectedMediaType !== "photo") return;

    const context = canvas.getContext("2d");
    if (!context) return;

    isCompressing = true;

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });

      if (blob) {
        const originalFile = new File([blob], `raw-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        const result = await optimizeImageForUpload(originalFile);

        capturedMedia = {
          type: "photo",
          file: result.file,
          compressionInfo: result,
        };
        mediaPreview = URL.createObjectURL(result.file);
        stopCamera();
      }
    } catch (error) {
      console.error("Error compressing photo:", error);
      alert("Error processing photo. Please try again.");
    } finally {
      isCompressing = false;
    }
  }

  async function startRecording() {
    if (!stream || selectedMediaType !== "video") return;

    try {
      // Check if MediaRecorder is supported
      if (!window.MediaRecorder) {
        throw new Error("Video recording not supported in this browser");
      }

      const options: MediaRecorderOptions = {};

      // Try to use WebM with VP9 codec, fallback to available options
      const supportedTypes = [
        "video/webm;codecs=vp9",
        "video/webm;codecs=vp8",
        "video/mp4;codecs=h264",
      ];

      for (const type of supportedTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          options.mimeType = type;
          break;
        }
      }

      mediaRecorder = new MediaRecorder(stream, options);
      recordedChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunks, {
          type: mediaRecorder?.mimeType || "video/webm",
        });

        await processRecordedVideo(blob);
      };

      // Start recording
      mediaRecorder.start();
      isRecording = true;
      recordingDuration = 0;

      // Update duration counter
      recordingInterval = window.setInterval(() => {
        recordingDuration++;

        // Auto-stop at max duration
        if (recordingDuration >= MAX_RECORDING_TIME) {
          stopRecording();
        }
      }, 1000);
    } catch (error) {
      console.error("Error starting video recording:", error);
      alert("Error starting video recording. Please try again.");
    }
  }

  function stopRecording() {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      isRecording = false;
    }

    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
  }

  async function processRecordedVideo(blob: Blob) {
    isCompressing = true;

    try {
      const originalFile = new File([blob], `raw-video-${Date.now()}.webm`, {
        type: blob.type,
      });

      const result = await optimizeVideoForUpload(originalFile);

      capturedMedia = {
        type: "video",
        file: result.file,
        compressionInfo: result,
      };

      mediaPreview = URL.createObjectURL(result.file);
      stopCamera();
    } catch (error) {
      console.error("Error compressing video:", error);
      alert("Error processing video. Please try again.");
    } finally {
      isCompressing = false;
    }
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) return;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    if (!isImage && !isVideo) {
      alert("Please select an image or video file.");
      return;
    }

    isCompressing = true;

    try {
      let result: MediaResult;

      if (isImage) {
        const compressionResult = await optimizeImageForUpload(file);
        result = {
          type: "photo",
          file: compressionResult.file,
          compressionInfo: compressionResult,
        };
      } else {
        const compressionResult = await optimizeVideoForUpload(file);
        result = {
          type: "video",
          file: compressionResult.file,
          compressionInfo: compressionResult,
        };
      }

      capturedMedia = result;
      mediaPreview = URL.createObjectURL(result.file);
      stopCamera();
    } catch (error) {
      console.error("Error processing file:", error);
      alert("Error processing file. Please try a different file.");
    } finally {
      isCompressing = false;
    }
  }

  function submitMedia() {
    if (capturedMedia) {
      dispatch("media", capturedMedia);
      reset();
    }
  }

  function reset() {
    capturedMedia = null;
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
      mediaPreview = null;
    }
    stopCamera();
    stopRecording();
    if (fileInput) {
      fileInput.value = "";
    }
  }

  function handleCancel() {
    reset();
    dispatch("cancel");
  }

  function switchMediaType(type: MediaType) {
    selectedMediaType = type;
    stopCamera();
    reset();
  }

  onMount(() => {
    if (typeof window !== "undefined") {
      import("$lib/storage").then(({ initializeStorage }) => {
        initializeStorage();
      });
    }
  });

  onDestroy(() => {
    stopCamera();
    if (mediaPreview) {
      URL.revokeObjectURL(mediaPreview);
    }
  });

  $: if (!open) {
    reset();
  }

  // Format compression info for display
  $: compressionText = capturedMedia?.compressionInfo
    ? `${formatFileSize(capturedMedia.compressionInfo.originalSize)} → ${formatFileSize(capturedMedia.compressionInfo.compressedSize)} (${capturedMedia.compressionInfo.compressionRatio}% smaller)`
    : "";

  $: durationText =
    capturedMedia?.type === "video" &&
    capturedMedia.compressionInfo &&
    "duration" in capturedMedia.compressionInfo
      ? formatDuration(capturedMedia.compressionInfo.duration)
      : "";
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Add Media</Dialog.Title>
      <Dialog.Description>
        Add photo or video proof for: <strong>{cellText}</strong>
      </Dialog.Description>
    </Dialog.Header>

    <div class="space-y-4">
      {#if isCompressing}
        <!-- Compression Loading -->
        <div class="flex items-center justify-center p-8">
          <div class="text-center space-y-2">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"
            ></div>
            <p class="text-sm text-gray-600">
              {selectedMediaType === "video"
                ? "Optimizing video..."
                : "Optimizing image..."}
            </p>
          </div>
        </div>
      {:else if mediaPreview}
        <!-- Media Preview -->
        <div class="space-y-4">
          <div class="relative bg-black rounded-lg overflow-hidden">
            {#if capturedMedia?.type === "photo"}
              <img
                src={mediaPreview}
                alt="Captured photo"
                class="w-full h-48 object-cover"
              />
            {:else if capturedMedia?.type === "video"}
              <video
                src={mediaPreview}
                class="w-full h-48 object-cover"
                controls
                muted
              ></video>
            {/if}
          </div>

          {#if capturedMedia?.compressionInfo}
            <!-- Compression Info -->
            <div class="bg-green-50 border border-green-200 rounded-lg p-3">
              <div class="flex items-center gap-2 text-sm">
                <span class="text-green-600">✅</span>
                <div class="text-green-800">
                  <div>Optimized: {compressionText}</div>
                  {#if durationText}
                    <div>Duration: {durationText}</div>
                  {/if}
                </div>
              </div>
            </div>
          {/if}

          <div class="flex gap-2">
            <Button on:click={submitMedia} class="flex-1">
              Use This {capturedMedia?.type === "video" ? "Video" : "Photo"}
            </Button>
            <Button variant="outline" on:click={reset} class="flex-1">
              Retake
            </Button>
          </div>
        </div>
      {:else if showCamera}
        <!-- Camera View -->
        <div class="space-y-4">
          <div class="relative bg-black rounded-lg overflow-hidden">
            <!-- svelte-ignore a11y-media-has-caption -->
            <video
              bind:this={video}
              autoplay
              playsinline
              muted
              class="w-full h-48 object-cover"
            ></video>

            {#if isRecording}
              <!-- Recording indicator -->
              <div
                class="absolute top-2 left-2 flex items-center gap-2 bg-red-600 text-white px-2 py-1 rounded text-sm"
              >
                <div class="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                REC {formatDuration(recordingDuration)}
              </div>
            {/if}
          </div>

          <div class="flex gap-2">
            {#if selectedMediaType === "photo"}
              <Button
                on:click={capturePhoto}
                class="flex-1"
                disabled={isCompressing}
              >
                {#if isCompressing}
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"
                  ></div>
                  Processing...
                {:else}
                  📸 Capture Photo
                {/if}
              </Button>
            {:else if selectedMediaType === "video"}
              <Button
                on:click={isRecording ? stopRecording : startRecording}
                class="flex-1"
                disabled={isCompressing}
                variant={isRecording ? "destructive" : "default"}
              >
                {#if isRecording}
                  ⏹️ Stop Recording
                {:else}
                  🎥 Start Recording
                {/if}
              </Button>
            {/if}

            <Button variant="outline" on:click={stopCamera} class="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      {:else}
        <!-- Options -->
        <div class="space-y-4">
          <!-- Media Type Selection -->
          <div class="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors {selectedMediaType ===
              'photo'
                ? 'bg-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}"
              on:click={() => switchMediaType("photo")}
            >
              📸 Photo
            </button>
            <button
              class="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors {selectedMediaType ===
              'video'
                ? 'bg-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'}"
              on:click={() => switchMediaType("video")}
            >
              🎥 Video
            </button>
          </div>

          <!-- Camera/Recording Actions -->
          <Button on:click={startCamera} class="w-full">
            {#if selectedMediaType === "video"}
              🎥 Record Video
            {:else}
              📸 Take Photo
            {/if}
          </Button>

          <!-- File Upload -->
          <div class="relative">
            <Button
              variant="outline"
              class="w-full"
              disabled={isCompressing}
              on:click={() => !isCompressing && fileInput?.click()}
            >
              {#if isCompressing}
                <div
                  class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"
                ></div>
                Processing...
              {:else}
                📁 Upload {selectedMediaType === "video" ? "Video" : "Photo"}
              {/if}
            </Button>
            <input
              bind:this={fileInput}
              type="file"
              accept={selectedMediaType === "video" ? "video/*" : "image/*"}
              class="absolute inset-0 opacity-0 cursor-pointer"
              on:change={handleFileSelect}
              disabled={isCompressing}
            />
          </div>

          {#if selectedMediaType === "video" && !supportsVideoRecording()}
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p class="text-sm text-yellow-800">
                Video recording is not supported in this browser. You can still
                upload video files.
              </p>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" on:click={handleCancel}>Cancel</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Hidden canvas for photo capture -->
<canvas bind:this={canvas} class="hidden"></canvas>

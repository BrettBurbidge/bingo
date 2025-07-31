<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from "svelte";
  import Button from "./ui/button.svelte";
  import * as Dialog from "./ui/dialog";
  import {
    optimizeImageForUpload,
    formatFileSize,
    type CompressionResult,
  } from "$lib/image-utils";

  export let open = false;
  export let cellText = "";

  const dispatch = createEventDispatcher<{
    photo: File;
    cancel: void;
  }>();

  let video: HTMLVideoElement;
  let canvas: HTMLCanvasElement;
  let stream: MediaStream | null = null;
  let showCamera = false;
  let capturedPhoto: File | null = null;
  let photoPreview: string | null = null;
  let fileInput: HTMLInputElement;
  let isCompressing = false;
  let compressionInfo: CompressionResult | null = null;

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }, // Use back camera on mobile
      });
      if (video) {
        video.srcObject = stream;
        showCamera = true;
      }
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Unable to access camera. Please try uploading a photo instead.");
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      stream = null;
    }
    showCamera = false;
  }

  async function capturePhoto() {
    if (!video || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    isCompressing = true;
    compressionInfo = null;

    try {
      // Set canvas size to video size
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the video frame to canvas
      context.drawImage(video, 0, 0);

      // Convert canvas to blob first
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.9);
      });

      if (blob) {
        const originalFile = new File([blob], `raw-photo-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        // Optimize the image for upload
        const result = await optimizeImageForUpload(originalFile);

        capturedPhoto = result.file;
        compressionInfo = result;
        photoPreview = URL.createObjectURL(result.file);
        stopCamera();
      }
    } catch (error) {
      console.error("Error compressing photo:", error);
      alert("Error processing photo. Please try again.");
    } finally {
      isCompressing = false;
    }
  }

  async function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (file && file.type.startsWith("image/")) {
      isCompressing = true;
      compressionInfo = null;

      try {
        // Optimize the uploaded image
        const result = await optimizeImageForUpload(file);

        capturedPhoto = result.file;
        compressionInfo = result;
        photoPreview = URL.createObjectURL(result.file);
        stopCamera();
      } catch (error) {
        console.error("Error compressing uploaded image:", error);
        alert("Error processing image. Please try a different file.");
      } finally {
        isCompressing = false;
      }
    }
  }

  function submitPhoto() {
    if (capturedPhoto) {
      dispatch("photo", capturedPhoto);
      reset();
    }
  }

  function reset() {
    capturedPhoto = null;
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
      photoPreview = null;
    }
    stopCamera();
    if (fileInput) {
      fileInput.value = "";
    }
  }

  function handleCancel() {
    reset();
    dispatch("cancel");
  }

  onMount(() => {
    // Initialize storage bucket if needed
    if (typeof window !== "undefined") {
      import("$lib/storage").then(({ initializeStorage }) => {
        initializeStorage();
      });
    }
  });

  onDestroy(() => {
    stopCamera();
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
  });

  $: if (!open) {
    reset();
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Add Photo</Dialog.Title>
      <Dialog.Description>
        Take a photo to prove you saw: <strong>{cellText}</strong>
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
            <p class="text-sm text-gray-600">Optimizing image...</p>
          </div>
        </div>
      {:else if photoPreview}
        <!-- Photo Preview -->
        <div class="space-y-4">
          <div class="relative bg-black rounded-lg overflow-hidden">
            <img
              src={photoPreview}
              alt="Captured photo"
              class="w-full h-48 object-cover"
            />
          </div>

          {#if compressionInfo}
            <!-- Compression Info -->
            <div class="bg-green-50 border border-green-200 rounded-lg p-3">
              <div class="flex items-center gap-2 text-sm">
                <span class="text-green-600">✅</span>
                <span class="text-green-800">
                  Optimized: {formatFileSize(compressionInfo.originalSize)} →
                  {formatFileSize(compressionInfo.compressedSize)}
                  ({compressionInfo.compressionRatio}% smaller)
                </span>
              </div>
            </div>
          {/if}

          <div class="flex gap-2">
            <Button on:click={submitPhoto} class="flex-1">
              Use This Photo
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
              class="w-full h-48 object-cover"
            ></video>
          </div>
          <div class="flex gap-2">
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
                📸 Capture
              {/if}
            </Button>
            <Button variant="outline" on:click={stopCamera} class="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      {:else}
        <!-- Options -->
        <div class="space-y-3">
          <Button on:click={startCamera} class="w-full">📸 Take Photo</Button>

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
                📁 Upload Photo
              {/if}
            </Button>
            <input
              bind:this={fileInput}
              type="file"
              accept="image/*"
              class="absolute inset-0 opacity-0 cursor-pointer"
              on:change={handleFileSelect}
              disabled={isCompressing}
            />
          </div>
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

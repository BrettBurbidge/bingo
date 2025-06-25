<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import Button from './ui/button.svelte';
  import * as Dialog from './ui/dialog';

  export let open = false;
  export let cellText = '';

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

  async function startCamera() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      if (video) {
        video.srcObject = stream;
        showCamera = true;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('Unable to access camera. Please try uploading a photo instead.');
    }
  }

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      stream = null;
    }
    showCamera = false;
  }

  function capturePhoto() {
    if (!video || !canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw the video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `bingo-photo-${Date.now()}.jpg`, {
          type: 'image/jpeg'
        });
        capturedPhoto = file;
        photoPreview = URL.createObjectURL(blob);
        stopCamera();
      }
    }, 'image/jpeg', 0.8);
  }

  function handleFileSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    
    if (file && file.type.startsWith('image/')) {
      capturedPhoto = file;
      photoPreview = URL.createObjectURL(file);
      stopCamera();
    }
  }

  function submitPhoto() {
    if (capturedPhoto) {
      dispatch('photo', capturedPhoto);
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
      fileInput.value = '';
    }
  }

  function handleCancel() {
    reset();
    dispatch('cancel');
  }

  onMount(() => {
    // Initialize storage bucket if needed
    if (typeof window !== 'undefined') {
      import('$lib/storage').then(({ initializeStorage }) => {
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
      {#if photoPreview}
        <!-- Photo Preview -->
        <div class="space-y-4">
          <div class="relative bg-black rounded-lg overflow-hidden">
            <img 
              src={photoPreview} 
              alt="Captured photo" 
              class="w-full h-48 object-cover"
            />
          </div>
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
            <Button on:click={capturePhoto} class="flex-1">
              📸 Capture
            </Button>
            <Button variant="outline" on:click={stopCamera} class="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      {:else}
        <!-- Options -->
        <div class="space-y-3">
          
          <div class="relative">
            <Button variant="outline" class="w-full" on:click={() => fileInput?.click()}>
              📁 Add Photo
            </Button>
            <input
              bind:this={fileInput}
              type="file"
              accept="image/*"
              class="absolute inset-0 opacity-0 cursor-pointer"
              on:change={handleFileSelect}
            />
          </div>
        </div>
      {/if}
    </div>

    <Dialog.Footer>
      <Button variant="outline" on:click={handleCancel}>
        Cancel
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<!-- Hidden canvas for photo capture -->
<canvas bind:this={canvas} class="hidden"></canvas> 
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    getPublishedGame,
    type PublishedGameWithRelations,
  } from "$lib/client-games";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import type { GuestParticipant } from "@prisma/client";

  let game: PublishedGameWithRelations | null = null;
  let participant: GuestParticipant | null = null;
  let loading = true;
  let participantName = "";
  let mediaItems: Array<{
    url: string;
    type: "photo" | "video";
    title: string;
    cardType: string;
    cellIndex: number;
    thumbnail?: string;
  }> = [];

  $: gameId = $page.params.id;
  $: participantId = $page.params.participantId;

  onMount(async () => {
    if (gameId && participantId) {
      await loadGalleryData();
    }
  });

  async function loadGalleryData() {
    try {
      loading = true;
      const gameData = await getPublishedGame(gameId);
      game = gameData;

      // Find the participant
      participant =
        gameData.guestParticipants.find((p) => p.id === participantId) || null;

      if (!participant) {
        // Maybe it's an authenticated participant
        const authParticipant = gameData.participants.find(
          (p) => p.id === participantId
        );
        if (authParticipant) {
          // Convert to guest participant format for consistency
          participant = {
            id: authParticipant.id,
            email: authParticipant.user.email,
            guestName:
              authParticipant.user.displayName ||
              authParticipant.user.email.split("@")[0],
            boardData: authParticipant.boardData,
            cardTypeData: authParticipant.cardTypeData,
            photoUrls: authParticipant.photoUrls,
            mediaUrls: authParticipant.mediaUrls || [],
            mediaTypes: authParticipant.mediaTypes || [],
            completedCells: authParticipant.completedCells,
            score: authParticipant.score,
            scoreBreakdown: authParticipant.scoreBreakdown,
            hasWon: authParticipant.hasWon,
            gameId: authParticipant.gameId,
            joinedAt: authParticipant.joinedAt,
          } as GuestParticipant;
          participantName =
            authParticipant.user.displayName ||
            authParticipant.user.email.split("@")[0];
        }
      } else {
        participantName =
          participant.guestName || participant.email.split("@")[0];
      }

      if (!participant) {
        goto(`/play/${gameId}`);
        return;
      }

      // Build media items array from both legacy photoUrls and new mediaUrls
      mediaItems = [];

      // Handle legacy photoUrls (for backward compatibility)
      // Now also detects videos by file extension
      if (
        participant.photoUrls &&
        participant.boardData &&
        participant.cardTypeData
      ) {
        for (let i = 0; i < participant.photoUrls.length; i++) {
          const mediaUrl = participant.photoUrls[i];
          if (mediaUrl && mediaUrl.trim() !== "") {
            // Detect media type by file extension or URL pattern
            const isVideo =
              /\.(mp4|webm|mov|quicktime|m4v)(\?|$)/i.test(mediaUrl) ||
              mediaUrl.includes("video") ||
              mediaUrl.includes(".mp4");

            mediaItems.push({
              url: mediaUrl,
              type: isVideo ? "video" : "photo",
              title: participant.boardData[i] || "Unknown",
              cardType: participant.cardTypeData[i] || "see",
              cellIndex: i,
            });
          }
        }
      }

      // Handle new flexible media system
      if (
        participant.mediaUrls &&
        participant.boardData &&
        participant.cardTypeData
      ) {
        for (let i = 0; i < participant.mediaUrls.length; i++) {
          const mediaData = participant.mediaUrls[i] as any;
          if (mediaData && typeof mediaData === "object") {
            // Add photos from media system
            if (mediaData.photos) {
              for (const photoUrl of mediaData.photos) {
                if (photoUrl && photoUrl.trim() !== "") {
                  // Avoid duplicates from legacy system
                  const exists = mediaItems.some(
                    (item) => item.url === photoUrl && item.cellIndex === i
                  );
                  if (!exists) {
                    mediaItems.push({
                      url: photoUrl,
                      type: "photo",
                      title: participant.boardData[i] || "Unknown",
                      cardType: participant.cardTypeData[i] || "see",
                      cellIndex: i,
                    });
                  }
                }
              }
            }

            // Add videos from media system
            if (mediaData.videos) {
              for (const videoUrl of mediaData.videos) {
                if (videoUrl && videoUrl.trim() !== "") {
                  mediaItems.push({
                    url: videoUrl,
                    type: "video",
                    title: participant.boardData[i] || "Unknown",
                    cardType: participant.cardTypeData[i] || "see",
                    cellIndex: i,
                  });
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading gallery data:", error);
      goto(`/play/${gameId}`);
    } finally {
      loading = false;
    }
  }

  function getCardTypeIcon(cardType: string): string {
    switch (cardType) {
      case "see":
        return "👁️";
      case "action":
        return "⚡";
      case "free":
        return "🎯";
      default:
        return "👁️";
    }
  }

  function getCardTypeLabel(cardType: string): string {
    switch (cardType) {
      case "see":
        return "See";
      case "action":
        return "Action";
      case "free":
        return "Free";
      default:
        return "See";
    }
  }

  function handleBackToGame() {
    goto(`/play/${gameId}`);
  }
</script>

<svelte:head>
  <title>{participantName}'s Media Gallery - {game?.name || "Bingo Game"}</title
  >
</svelte:head>

{#if loading}
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
    <div class="flex justify-center items-center h-64">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
      ></div>
    </div>
  </div>
{:else if !game || !participant}
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
    <div class="text-center py-12">
      <div class="mx-auto h-12 w-12 mb-4 text-4xl">😕</div>
      <h1 class="text-2xl font-bold mb-4">Gallery Not Found</h1>
      <p class="text-muted-foreground mb-6">
        This participant or game doesn't exist.
      </p>
      <Button on:click={handleBackToGame}>Back to Game</Button>
    </div>
  </div>
{:else}
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
    <!-- Header -->
    <div class="flex items-center justify-between mb-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight mb-2">
          📸 {participantName}'s Media Gallery
        </h1>
        <p class="text-muted-foreground">
          Game: {game.name} • {mediaItems.length} media item{mediaItems.length ===
          1
            ? ""
            : "s"}
        </p>
      </div>
      <Button variant="outline" on:click={handleBackToGame}>
        ← Back to Game
      </Button>
    </div>

    {#if mediaItems.length === 0}
      <!-- No media message -->
      <Card.Root class="text-center py-12">
        <Card.Content class="pt-6">
          <div class="text-6xl mb-4">📱</div>
          <h2 class="text-xl font-bold mb-2">No Media Yet</h2>
          <p class="text-muted-foreground">
            {participantName} hasn't uploaded any photos or videos to their bingo
            board yet.
          </p>
        </Card.Content>
      </Card.Root>
    {:else}
      <!-- Photo Gallery Grid -->
      <div
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
      >
        {#each mediaItems as item (item.cellIndex + "-" + item.type)}
          <Card.Root
            class="overflow-hidden group hover:shadow-lg transition-shadow"
          >
            <div class="relative aspect-square">
              {#if item.type === "photo"}
                <!-- Photo -->
                <img
                  src={item.url}
                  alt="Photo for {item.title}"
                  class="w-full h-full object-cover"
                />
              {:else if item.type === "video"}
                <!-- Video -->
                <div class="video-container">
                  <video
                    src={item.url}
                    class="w-full h-full object-cover"
                    controls
                    preload="metadata"
                    playsinline
                    controlsList="nodownload"
                    crossorigin="anonymous"
                    title="Video for {item.title}"
                  >
                    <track kind="captions" />
                    Your browser does not support the video tag.
                  </video>
                </div>

                <!-- Video type indicator -->
                <div
                  class="absolute top-2 right-2 bg-black/70 text-white px-2 py-1 rounded text-xs font-medium z-10"
                >
                  🎥 VIDEO
                </div>
              {/if}

              <!-- Overlay (but not over video controls) -->
              <div
                class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent {item.type ===
                'video'
                  ? 'pointer-events-none'
                  : ''}"
              ></div>

              <!-- Card info overlay -->
              <div
                class="absolute bottom-0 left-0 right-0 p-4 {item.type ===
                'video'
                  ? 'pointer-events-none'
                  : ''}"
              >
                <div class="flex items-center gap-2 mb-2">
                  <!-- Card type badge -->
                  <Badge
                    variant="secondary"
                    class="bg-white/20 text-white border-white/30 backdrop-blur-sm"
                  >
                    <span class="mr-1">{getCardTypeIcon(item.cardType)}</span>
                    {getCardTypeLabel(item.cardType)}
                  </Badge>
                </div>

                <!-- Card title -->
                <h3
                  class="text-white font-semibold text-sm leading-tight line-clamp-2"
                >
                  {item.title}
                </h3>
              </div>

              <!-- Hover overlay for better visibility -->
              <div
                class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"
              ></div>
            </div>
          </Card.Root>
        {/each}
      </div>

      <!-- Stats Summary -->
      <Card.Root class="mt-8">
        <Card.Content class="pt-6">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div class="text-2xl font-bold text-primary">
                {mediaItems.length}
              </div>
              <div class="text-sm text-muted-foreground">Total Media</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-blue-600">
                {mediaItems.filter((item) => item.cardType === "see").length}
              </div>
              <div class="text-sm text-muted-foreground">👁️ See Cards</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-green-600">
                {mediaItems.filter((item) => item.cardType === "action").length}
              </div>
              <div class="text-sm text-muted-foreground">⚡ Action Cards</div>
            </div>
            <div>
              <div class="text-2xl font-bold text-yellow-600">
                {participant.score}/25
              </div>
              <div class="text-sm text-muted-foreground">Score</div>
            </div>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}
  </div>
{/if}

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Ensure video controls are fully functional */
  video {
    position: relative;
    z-index: 1;
  }

  video::-webkit-media-controls-panel {
    background: rgba(0, 0, 0, 0.8);
  }

  video::-webkit-media-controls-volume-slider-container,
  video::-webkit-media-controls-volume-slider,
  video::-webkit-media-controls-mute-button {
    display: block !important;
  }

  /* Make sure overlays don't interfere with video controls */
  .video-container {
    position: relative;
  }

  .video-container video {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>

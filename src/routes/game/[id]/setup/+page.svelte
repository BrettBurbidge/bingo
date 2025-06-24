<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { user } from "$lib/auth";
  import { goto } from "$app/navigation";
  import { getGame, setupGame } from "$lib/client-games";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import type { Game } from "@prisma/client";

  let game: Game | null = null;
  let loading = true;
  let submitting = false;
  let words: string[] = Array(24).fill("");

  $: gameId = $page.params.id;

  onMount(async () => {
    if ($user && gameId) {
      await loadGame();
    }
  });

  async function loadGame() {
    try {
      loading = true;
      game = await getGame(gameId);

      // Check if user is game master
      if (game.gameMasterId !== $user?.id) {
        goto(`/game/${gameId}`);
        return;
      }

      // Check if game is in setup phase
      if (game.status !== "SETUP") {
        goto(`/game/${gameId}`);
        return;
      }
    } catch (error) {
      console.error("Error loading game:", error);
      goto("/dashboard");
    } finally {
      loading = false;
    }
  }

  async function handleSetup() {
    if (!$user || !game) return;

    // Validate all words are filled
    const filledWords = words.filter((word) => word.trim() !== "");
    if (filledWords.length !== 24) {
      alert("Please fill in all 24 words/phrases");
      return;
    }

    try {
      submitting = true;
      await setupGame(gameId, filledWords, $user.id);
      goto(`/game/${gameId}`);
    } catch (error) {
      console.error("Error setting up game:", error);
      alert("Failed to setup game. Please try again.");
    } finally {
      submitting = false;
    }
  }

  function fillSampleWords() {
    const sampleWords = [
      "See a dolphin",
      "Pool game",
      "Formal dinner",
      "Deck party",
      "Spa visit",
      "Karaoke night",
      "Buffet meal",
      "Sunset photo",
      "New friend",
      "Room service",
      "Dancing",
      "Shore excursion",
      "Mini golf",
      "Art auction",
      "Trivia night",
      "Ocean view",
      "Captain's dinner",
      "Live show",
      "Gym workout",
      "Wine tasting",
      "Seasick",
      "Late checkout",
      "Room upgrade",
      "Lost luggage",
    ];
    words = [...sampleWords];
  }
</script>

<svelte:head>
  <title>Setup {game?.name || "Game"} - Bingo</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center h-64">
    <div
      class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
    ></div>
  </div>
{:else if !game}
  <div class="text-center py-12">
    <div class="mx-auto h-12 w-12 mb-4 text-4xl">😕</div>
    <h1 class="text-2xl font-bold mb-4">Game Not Found</h1>
    <p class="text-muted-foreground mb-6">
      This game doesn't exist or you don't have access to it.
    </p>
    <Button href="/dashboard">Back to Dashboard</Button>
  </div>
{:else}
  <div class="space-y-8">
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
    >
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Setup: {game.name}</h1>
        <p class="text-muted-foreground">
          Enter 24 words or phrases for your bingo board
        </p>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" on:click={fillSampleWords}>
          Fill Sample Words
        </Button>
        <Button variant="outline" href="/dashboard">Cancel</Button>
      </div>
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>Bingo Words & Phrases</Card.Title>
        <Card.Description>
          Each player will get a randomized board with these 24 items plus a
          FREE SPACE in the center. The first player to get 5 in a row
          (horizontal, vertical, or diagonal) wins!
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {#each words as word, index}
            <div class="space-y-2">
              <label for={`word-${index}`} class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50">Word {index + 1}</label>
              <Input
                id={`word-${index}`}
                bind:value={words[index]}
                placeholder="Enter word or phrase..."
                maxlength="50"
              />
            </div>
          {/each}
        </div>

        <div class="flex justify-end space-x-2">
          <Button
            variant="outline"
            on:click={() => (words = Array(24).fill(""))}
          >
            Clear All
          </Button>
          <Button
            on:click={handleSetup}
            disabled={submitting || words.some((w) => !w.trim())}
          >
            {submitting ? "Setting up..." : "Start Game"}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{/if}

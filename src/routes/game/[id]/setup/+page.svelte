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
  let cardTypes: string[] = Array(24).fill("see"); // Default to "see" type

  $: gameId = $page.params.id;

  function updateCardType(index: number, type: string) {
    cardTypes = cardTypes.map((currentType, i) => i === index ? type : currentType);
  }

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
      await setupGame(gameId, filledWords, cardTypes, $user.id);
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
    const sampleTypes = [
      "see",      // See a dolphin
      "action",   // Pool game
      "action",   // Formal dinner
      "action",   // Deck party
      "action",   // Spa visit
      "action",   // Karaoke night
      "action",   // Buffet meal
      "action",   // Sunset photo
      "see",      // New friend
      "action",   // Room service
      "action",   // Dancing
      "action",   // Shore excursion
      "action",   // Mini golf
      "action",   // Art auction
      "action",   // Trivia night
      "see",      // Ocean view
      "action",   // Captain's dinner
      "action",   // Live show
      "action",   // Gym workout
      "action",   // Wine tasting
      "see",      // Seasick
      "action",   // Late checkout
      "see",      // Room upgrade
      "see",      // Lost luggage
    ];
    words = [...sampleWords];
    cardTypes = [...sampleTypes];
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
          FREE SPACE in the center. Choose whether each item is something to "see" or an "action" to do.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- Card Type Legend -->
        <div class="flex gap-4 p-4 bg-muted rounded-lg">
          <div class="flex items-center gap-2">
            <div class="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded text-blue-600 dark:text-blue-400 text-sm">
              👁️
            </div>
            <span class="text-sm font-medium">See</span>
            <span class="text-sm text-muted-foreground">- Something to spot or observe</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900 rounded text-green-600 dark:text-green-400 text-sm">
              ⚡
            </div>
            <span class="text-sm font-medium">Action</span>
            <span class="text-sm text-muted-foreground">- Something to do or participate in</span>
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {#each words as word, index}
            <div class="space-y-3 p-4 border rounded-lg">
              <div class="space-y-2">
                <label for={`word-${index}`} class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Item {index + 1}
                </label>
                <Input
                  id={`word-${index}`}
                  bind:value={words[index]}
                  placeholder="Enter word or phrase..."
                  maxlength="50"
                />
              </div>
              
              <div class="space-y-2">
                <label class="text-sm font-medium">Card Type</label>
                <div class="flex gap-4">
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`card-type-${index}`}
                      value="see"
                      checked={cardTypes[index] === 'see'}
                      on:change={() => updateCardType(index, 'see')}
                      class="sr-only"
                    />
                    <div class="flex items-center gap-2 px-3 py-2 rounded-md border-2 transition-all {cardTypes[index] === 'see' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'border-gray-200 hover:border-blue-300'}">
                      <div class="flex items-center justify-center w-5 h-5 bg-blue-100 dark:bg-blue-900 rounded text-blue-600 dark:text-blue-400 text-xs">
                        👁️
                      </div>
                      <span class="text-sm font-medium">See</span>
                    </div>
                  </label>
                  
                  <label class="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`card-type-${index}`}
                      value="action"
                      checked={cardTypes[index] === 'action'}
                      on:change={() => updateCardType(index, 'action')}
                      class="sr-only"
                    />
                    <div class="flex items-center gap-2 px-3 py-2 rounded-md border-2 transition-all {cardTypes[index] === 'action' ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-gray-200 hover:border-green-300'}">
                      <div class="flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900 rounded text-green-600 dark:text-green-400 text-xs">
                        ⚡
                      </div>
                      <span class="text-sm font-medium">Action</span>
                    </div>
                  </label>
                </div>
              </div>
            </div>
          {/each}
        </div>

        <div class="flex justify-end space-x-2">
          <Button
            variant="outline"
            on:click={() => {
              words = Array(24).fill("");
              cardTypes = Array(24).fill("see");
            }}
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

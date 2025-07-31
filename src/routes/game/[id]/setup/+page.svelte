<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { user } from "$lib/auth";
  import { goto } from "$app/navigation";
  import { getGame, setupGame, editGame } from "$lib/client-games";
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
  $: isEditMode = $page.url.searchParams.get("edit") === "true";
  $: isAiMode = $page.url.searchParams.get("ai") === "true";
  $: pageTitle = isEditMode ? "Edit Game" : "Setup Game";
  $: buttonText = isEditMode ? "Save Changes" : "Start Game";

  let aiGeneratedInfo: { topic: string; timestamp: number } | null = null;

  function updateCardType(index: number, type: string) {
    cardTypes = cardTypes.map((currentType, i) =>
      i === index ? type : currentType
    );
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

      // In edit mode, allow ACTIVE and COMPLETED games
      // In setup mode, only allow SETUP games
      if (isEditMode) {
        if (game.status === "SETUP") {
          // If trying to edit a game in setup, redirect to normal setup
          goto(`/game/${gameId}/setup`);
          return;
        }
      } else {
        // Normal setup mode - only allow SETUP games
        if (game.status !== "SETUP") {
          goto(`/game/${gameId}`);
          return;
        }
      }

      // Check for AI-generated words first (takes priority)
      if (isAiMode) {
        const aiWords = localStorage.getItem(`ai-generated-words-${gameId}`);
        if (aiWords) {
          try {
            const aiData = JSON.parse(aiWords);
            if (aiData.words && aiData.words.length === 24) {
              words = [...aiData.words];
              aiGeneratedInfo = {
                topic: aiData.topic,
                timestamp: aiData.timestamp,
              };
              // Auto-assign card types based on word content (simple heuristic)
              cardTypes = aiData.words.map((word: string) => {
                const lowerWord = word.toLowerCase();
                if (
                  lowerWord.includes("see") ||
                  lowerWord.includes("spot") ||
                  lowerWord.includes("view") ||
                  lowerWord.includes("watch") ||
                  lowerWord.includes("find") ||
                  lowerWord.includes("notice")
                ) {
                  return "see";
                } else {
                  return "action";
                }
              });
              // Clear the AI data after use
              localStorage.removeItem(`ai-generated-words-${gameId}`);
            }
          } catch (e) {
            console.error("Failed to load AI-generated words:", e);
          }
        }
      }

      // Pre-populate words and card types if they exist (e.g., from cloned game)
      // Only if we didn't already load AI words
      if (!aiGeneratedInfo) {
        if (game.wordList && game.wordList.length === 24) {
          words = [...game.wordList];
        }
        if (game.cardTypes && game.cardTypes.length === 24) {
          cardTypes = [...game.cardTypes];
        }
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

      if (isEditMode) {
        // Edit existing game
        await editGame(gameId, filledWords, cardTypes, $user.id);
        alert("Game updated successfully!");
      } else {
        // Setup new game
        await setupGame(gameId, filledWords, cardTypes, $user.id);
      }

      goto(`/game/${gameId}`);
    } catch (error) {
      console.error(
        isEditMode ? "Error editing game:" : "Error setting up game:",
        error
      );
      alert(
        isEditMode
          ? "Failed to edit game. Please try again."
          : "Failed to setup game. Please try again."
      );
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
      "see", // See a dolphin
      "action", // Pool game
      "action", // Formal dinner
      "action", // Deck party
      "action", // Spa visit
      "action", // Karaoke night
      "action", // Buffet meal
      "action", // Sunset photo
      "see", // New friend
      "action", // Room service
      "action", // Dancing
      "action", // Shore excursion
      "action", // Mini golf
      "action", // Art auction
      "action", // Trivia night
      "see", // Ocean view
      "action", // Captain's dinner
      "action", // Live show
      "action", // Gym workout
      "action", // Wine tasting
      "see", // Seasick
      "action", // Late checkout
      "see", // Room upgrade
      "see", // Lost luggage
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
        <h1 class="text-3xl font-bold tracking-tight">
          {pageTitle}: {game.name}
        </h1>
        <p class="text-muted-foreground">
          {isEditMode
            ? "Edit the words and phrases for your bingo board"
            : "Enter 24 words or phrases for your bingo board"}
        </p>
      </div>
      <div class="flex gap-2">
        {#if !isEditMode}
          <Button variant="default" href="/game/{gameId}/ai-words">
            🤖 AI Word Generator
          </Button>
        {/if}
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
          FREE SPACE in the center. Choose whether each item is something to
          "see" or an "action" to do.
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-6">
        <!-- AI Generated Words Info -->
        {#if aiGeneratedInfo}
          <div
            class="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <p class="text-sm text-blue-800 dark:text-blue-200">
              🤖 <strong>AI Generated Words:</strong> These words were
              automatically generated for the topic "{aiGeneratedInfo.topic}".
              You can edit them as needed or regenerate new ones using the AI
              Word Generator.
            </p>
          </div>
        {/if}

        <!-- Edit Mode Warning -->
        {#if isEditMode}
          <div
            class="p-4 bg-orange-50 dark:bg-orange-950/50 rounded-lg border border-orange-200 dark:border-orange-800"
          >
            <p class="text-sm text-orange-800 dark:text-orange-200">
              ⚠️ <strong>Editing Active Game:</strong> Changes will be reflected
              in the game master view, but players who have already joined will keep
              their existing randomized boards. New players joining after your changes
              will get boards with the updated words.
            </p>
          </div>
        {/if}

        <!-- Card Type Legend -->
        <div class="flex gap-4 p-4 bg-muted rounded-lg">
          <div class="flex items-center gap-2">
            <div
              class="flex items-center justify-center w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded text-blue-600 dark:text-blue-400 text-sm"
            >
              👁️
            </div>
            <span class="text-sm font-medium">See</span>
            <span class="text-sm text-muted-foreground"
              >- Something to spot or observe</span
            >
          </div>
          <div class="flex items-center gap-2">
            <div
              class="flex items-center justify-center w-6 h-6 bg-green-100 dark:bg-green-900 rounded text-green-600 dark:text-green-400 text-sm"
            >
              ⚡
            </div>
            <span class="text-sm font-medium">Action</span>
            <span class="text-sm text-muted-foreground"
              >- Something to do or participate in</span
            >
          </div>
        </div>

        <div class="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {#each words as word, index}
            <div class="space-y-3 p-4 border rounded-lg">
              <div class="space-y-2">
                <label
                  for={`word-${index}`}
                  class="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Item {index + 1}
                </label>
                <Input
                  id={`word-${index}`}
                  bind:value={words[index]}
                  placeholder="Enter word or phrase..."
                  maxlength={50}
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
                      checked={cardTypes[index] === "see"}
                      on:change={() => updateCardType(index, "see")}
                      class="sr-only"
                    />
                    <div
                      class="flex items-center gap-2 px-3 py-2 rounded-md border-2 transition-all {cardTypes[
                        index
                      ] === 'see'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                        : 'border-gray-200 hover:border-blue-300'}"
                    >
                      <div
                        class="flex items-center justify-center w-5 h-5 bg-blue-100 dark:bg-blue-900 rounded text-blue-600 dark:text-blue-400 text-xs"
                      >
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
                      checked={cardTypes[index] === "action"}
                      on:change={() => updateCardType(index, "action")}
                      class="sr-only"
                    />
                    <div
                      class="flex items-center gap-2 px-3 py-2 rounded-md border-2 transition-all {cardTypes[
                        index
                      ] === 'action'
                        ? 'border-green-500 bg-green-50 dark:bg-green-950'
                        : 'border-gray-200 hover:border-green-300'}"
                    >
                      <div
                        class="flex items-center justify-center w-5 h-5 bg-green-100 dark:bg-green-900 rounded text-green-600 dark:text-green-400 text-xs"
                      >
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
            {submitting
              ? isEditMode
                ? "Saving..."
                : "Setting up..."
              : buttonText}
          </Button>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{/if}

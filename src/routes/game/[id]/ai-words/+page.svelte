<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";

  interface GeneratedWord {
    text: string;
    selected: boolean;
    id: string;
  }

  let gameId = "";
  let topic = "";
  let isGenerating = false;
  let generatedWords: GeneratedWord[] = [];
  let selectedWords: string[] = [];
  let error = "";
  let hasGenerated = false;

  $: gameId = $page.params.id;
  $: selectedCount = selectedWords.length;
  $: remainingCount = 24 - selectedCount;
  $: canContinue = selectedCount === 24;

  onMount(() => {
    // Load any existing session data from localStorage
    const savedSession = localStorage.getItem(`ai-words-session-${gameId}`);
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        topic = session.topic || "";
        generatedWords = session.generatedWords || [];
        selectedWords = session.selectedWords || [];
        hasGenerated = generatedWords.length > 0;
      } catch (e) {
        console.error("Failed to load saved session:", e);
      }
    }
  });

  function saveSession() {
    const session = {
      topic,
      generatedWords,
      selectedWords,
      timestamp: Date.now(),
    };
    localStorage.setItem(`ai-words-session-${gameId}`, JSON.stringify(session));
  }

  async function generateWords() {
    if (!topic.trim()) {
      error = "Please enter a topic";
      return;
    }

    isGenerating = true;
    error = "";

    try {
      const response = await fetch("/api/ai/generate-words", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: topic.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to generate words");
      }

      const data = await response.json();

      // Map new words and check if they're already selected from previous generations
      generatedWords = data.words.map((word: string, index: number) => ({
        text: word,
        selected: selectedWords.includes(word), // Keep existing selections
        id: `word-${index}-${Date.now()}`,
      }));

      // Don't reset selectedWords - keep building the list across generations
      hasGenerated = true;
      saveSession();
    } catch (e) {
      error = e instanceof Error ? e.message : "Failed to generate words";
      console.error("Error generating words:", e);
    } finally {
      isGenerating = false;
    }
  }

  function toggleWord(wordId: string) {
    const word = generatedWords.find((w) => w.id === wordId);
    if (!word) return;

    if (word.selected) {
      // Unselect word
      word.selected = false;
      selectedWords = selectedWords.filter((w) => w !== word.text);
    } else {
      // Select word (only if we haven't reached the limit)
      if (selectedWords.length < 24) {
        word.selected = true;
        selectedWords = [...selectedWords, word.text];
      }
    }

    generatedWords = generatedWords; // Trigger reactivity
    saveSession();
  }

  function regenerateWords() {
    generatedWords = [];
    // Keep selectedWords - don't reset the ongoing selection
    hasGenerated = false;
    generateWords();
  }

  function clearSession() {
    topic = "";
    generatedWords = [];
    selectedWords = [];
    hasGenerated = false;
    error = "";
    localStorage.removeItem(`ai-words-session-${gameId}`);
  }

  function removeSelectedWord(wordToRemove: string) {
    selectedWords = selectedWords.filter((word) => word !== wordToRemove);

    // Also update the generated words if this word is currently visible
    generatedWords = generatedWords.map((word) =>
      word.text === wordToRemove ? { ...word, selected: false } : word
    );

    saveSession();
  }

  async function continueToSetup() {
    if (!canContinue) return;

    // Save the selected words to localStorage for the setup page to use
    localStorage.setItem(
      `ai-generated-words-${gameId}`,
      JSON.stringify({
        words: selectedWords,
        topic: topic,
        timestamp: Date.now(),
      })
    );

    // Clear the session
    localStorage.removeItem(`ai-words-session-${gameId}`);

    // Navigate to setup page with auto-populate flag
    goto(`/game/${gameId}/setup?ai=true`);
  }

  function goBack() {
    goto(`/game/${gameId}`);
  }
</script>

<svelte:head>
  <title>AI Word Generator - Bingo</title>
</svelte:head>

<div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-4xl">
  <!-- Header -->
  <div class="mb-8">
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-3xl font-bold tracking-tight">🤖 AI Word Generator</h1>
      <Button variant="outline" on:click={goBack}>← Back to Game</Button>
    </div>
    <p class="text-muted-foreground">
      Use AI to generate creative bingo words for your game. Get 50 suggestions
      per topic and build your list of 24 words iteratively!
    </p>
  </div>

  <!-- Topic Input Section -->
  <Card.Root class="mb-6">
    <Card.Header>
      <Card.Title>Step 1: Enter Your Bingo Topic</Card.Title>
      <Card.Description>
        What's your bingo game about? Each topic generates 50 suggestions - try
        different topics to build your word list!
      </Card.Description>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div class="space-y-2">
        <Label for="topic">Topic</Label>
        <Input
          id="topic"
          bind:value={topic}
          placeholder="e.g., Cruise Ship, Wedding Reception, College Campus, Road Trip..."
          disabled={isGenerating}
        />
      </div>

      {#if error}
        <div
          class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm"
        >
          {error}
        </div>
      {/if}

      <div class="flex gap-2">
        <Button
          on:click={generateWords}
          disabled={isGenerating || !topic.trim()}
          class="flex-1"
        >
          {#if isGenerating}
            <div
              class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
            ></div>
            Generating...
          {:else}
            ✨ Generate 50 Words
          {/if}
        </Button>

        {#if hasGenerated}
          <Button
            variant="outline"
            on:click={regenerateWords}
            disabled={isGenerating}
          >
            🔄 Try New Topic
          </Button>
          <Button
            variant="outline"
            on:click={clearSession}
            disabled={isGenerating}
          >
            🗑️ Start Over
          </Button>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Progress Section -->
  {#if hasGenerated}
    <Card.Root class="mb-6">
      <Card.Content class="pt-6">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-lg font-semibold">Step 2: Build Your Word List</h3>
            <p class="text-sm text-muted-foreground">
              Select words from each generation to build your list of 24. Each
              topic gives you 50 options to choose from!
            </p>
          </div>
          <div class="text-right">
            <div class="text-2xl font-bold text-primary">
              {selectedCount}/24
            </div>
            <div class="text-sm text-muted-foreground">
              {#if remainingCount > 0}
                {remainingCount} more needed
              {:else}
                Ready to continue!
              {/if}
            </div>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="mt-4">
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div
              class="bg-primary h-2 rounded-full transition-all duration-300"
              style="width: {(selectedCount / 24) * 100}%"
            ></div>
          </div>
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Generated Words Section -->
  {#if hasGenerated && generatedWords.length > 0}
    <Card.Root class="mb-6">
      <Card.Header>
        <Card.Title>Generated Words for "{topic}"</Card.Title>
        <Card.Description>
          Click words to add them to your ongoing list. Already selected words
          (from this or previous generations) are highlighted. Try a new topic
          to get more options!
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {#each generatedWords as word (word.id)}
            <button
              class="p-3 text-left border rounded-lg transition-all hover:shadow-sm {word.selected
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-border'} 
                {!word.selected && selectedCount >= 24
                ? 'opacity-50 cursor-not-allowed'
                : 'cursor-pointer'}"
              on:click={() => toggleWord(word.id)}
              disabled={!word.selected && selectedCount >= 24}
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{word.text}</span>
                {#if word.selected}
                  <Badge
                    variant="secondary"
                    class="ml-2 bg-primary-foreground text-primary"
                  >
                    ✓
                  </Badge>
                {/if}
              </div>
            </button>
          {/each}
        </div>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Selected Words Preview -->
  {#if selectedWords.length > 0}
    <Card.Root class="mb-6">
      <Card.Header>
        <Card.Title>Your Selected Words ({selectedWords.length}/24)</Card.Title>
        <Card.Description>
          Words chosen from all generations. Click the × to remove any word.
        </Card.Description>
      </Card.Header>
      <Card.Content>
        <div class="flex flex-wrap gap-2">
          {#each selectedWords as word}
            <button
              class="inline-flex items-center rounded-md border border-input bg-background px-2.5 py-0.5 text-sm font-semibold text-foreground group cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
              on:click={() => removeSelectedWord(word)}
            >
              {word}
              <span class="ml-1 opacity-50 group-hover:opacity-100">×</span>
            </button>
          {/each}
        </div>

        {#if selectedWords.length > 0}
          <div class="mt-4 p-3 bg-muted rounded-lg">
            <p class="text-sm text-muted-foreground">
              💡 <strong>Tip:</strong> Try different topics like "Formal Dinner",
              "Pool Activities", or "Entertainment" to get variety in your word list.
            </p>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Continue Button -->
  {#if hasGenerated}
    <div class="flex justify-center">
      <Button
        on:click={continueToSetup}
        disabled={!canContinue}
        size="lg"
        class="px-8"
      >
        {#if canContinue}
          🎯 Continue to Game Setup
        {:else}
          Select {remainingCount} more word{remainingCount === 1 ? "" : "s"}
        {/if}
      </Button>
    </div>
  {/if}
</div>

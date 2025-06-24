<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import {
    getPublishedGame,
    joinGameAsGuest,
    updateGuestParticipantScore,
    type PublishedGameWithRelations,
  } from "$lib/client-games";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Badge } from "$lib/components/ui/badge";
  import type { GuestParticipant } from "@prisma/client";

  type AllParticipants = {
    id: string;
    name: string;
    score: number;
    hasWon: boolean;
    isGuest: boolean;
  };

  let game: PublishedGameWithRelations | null = null;
  let guestParticipant: GuestParticipant | null = null;
  let allParticipants: AllParticipants[] = [];
  let loading = true;
  let showJoinModal = true;
  let joinLoading = false;
  let guestName = "";
  let joinError = "";

  $: gameId = $page.params.id;
  $: sortedParticipants = allParticipants.sort((a, b) => b.score - a.score);
  $: isJoined = !!guestParticipant;

  onMount(async () => {
    if (gameId) {
      await loadGameData();
    }
  });

  async function loadGameData() {
    try {
      loading = true;
      const gameData = await getPublishedGame(gameId);
      game = gameData;

      // Combine authenticated participants and guest participants
      const authParticipants: AllParticipants[] = gameData.participants.map(p => ({
        id: p.id,
        name: p.user.displayName || p.user.email.split('@')[0],
        score: p.score,
        hasWon: p.hasWon,
        isGuest: false
      }));

      const guestParticipants: AllParticipants[] = gameData.guestParticipants.map(p => ({
        id: p.id,
        name: p.guestName,
        score: p.score,
        hasWon: p.hasWon,
        isGuest: true
      }));

      allParticipants = [...authParticipants, ...guestParticipants];

      // Check if user is already joined (using localStorage to remember)
      const savedGuestId = localStorage.getItem(`guest-${gameId}`);
      if (savedGuestId) {
        const existingGuest = gameData.guestParticipants.find(p => p.id === savedGuestId);
        if (existingGuest) {
          guestParticipant = existingGuest;
          showJoinModal = false;
        } else {
          // Guest was removed, clear localStorage
          localStorage.removeItem(`guest-${gameId}`);
        }
      }

      // If game is completed and user hasn't joined, they can only view (no join modal)
      if (game.status === "COMPLETED" && !guestParticipant) {
        showJoinModal = false;
      }
    } catch (error) {
      console.error("Error loading game data:", error);
    } finally {
      loading = false;
    }
  }

  async function handleJoinGame() {
    if (!guestName.trim()) {
      joinError = "Please enter a name";
      return;
    }

    try {
      joinLoading = true;
      joinError = "";
      
      const newGuest = await joinGameAsGuest(gameId, guestName.trim());
      guestParticipant = newGuest;
      
      // Save guest ID to localStorage
      localStorage.setItem(`guest-${gameId}`, newGuest.id);
      
      showJoinModal = false;
      await loadGameData();
    } catch (error) {
      console.error("Error joining game:", error);
      if (error instanceof Error) {
        joinError = error.message;
      } else {
        joinError = "Failed to join game";
      }
    } finally {
      joinLoading = false;
    }
  }

  async function toggleCell(cellIndex: number) {
    if (!guestParticipant) return;
    
    // Don't allow toggling if game is completed and there's a winner (read-only mode)
    if (game?.status === "COMPLETED" && sortedParticipants.some(p => p.hasWon)) return;

    // Don't allow toggling the center cell (FREE space)
    if (cellIndex === 12) return;

    const completedCells = [...guestParticipant.completedCells];
    const cellIndexInCompleted = completedCells.indexOf(cellIndex);

    if (cellIndexInCompleted > -1) {
      // Remove cell
      completedCells.splice(cellIndexInCompleted, 1);
    } else {
      // Add cell
      completedCells.push(cellIndex);
    }

    try {
      const updated = await updateGuestParticipantScore(gameId, guestParticipant.id, completedCells);
      guestParticipant = updated;
      await loadGameData();
    } catch (error) {
      console.error("Error updating score:", error);
    }
  }

  function getCellContent(row: number, col: number): string {
    const cellIndex = row * 5 + col;
    
    // If user is joined, show their board
    if (guestParticipant?.boardData) {
      return guestParticipant.boardData[cellIndex] || "";
    }
    
    // For non-participants viewing completed games, show the winner's board if available
    if (game?.status === "COMPLETED") {
      // Try to find winner among authenticated participants first
      const authWinner = game.participants.find(p => p.hasWon);
      if (authWinner?.boardData) {
        return authWinner.boardData[cellIndex] || "";
      }
      
      // Then try guest participants
      const guestWinner = game.guestParticipants.find(p => p.hasWon);
      if (guestWinner?.boardData) {
        return guestWinner.boardData[cellIndex] || "";
      }
      
      // Fallback to first participant's board
      if (game.participants[0]?.boardData) {
        return game.participants[0].boardData[cellIndex] || "";
      }
      if (game.guestParticipants[0]?.boardData) {
        return game.guestParticipants[0].boardData[cellIndex] || "";
      }
    }
    
    return "";
  }

  function isCellCompleted(row: number, col: number): boolean {
    const cellIndex = row * 5 + col;
    
    // If user is joined, show their completion status
    if (guestParticipant) {
      return guestParticipant.completedCells.includes(cellIndex);
    }
    
    // For non-participants viewing completed games, show the winner's completion status
    if (game?.status === "COMPLETED") {
      // Try to find winner among authenticated participants first
      const authWinner = game.participants.find(p => p.hasWon);
      if (authWinner?.completedCells) {
        return authWinner.completedCells.includes(cellIndex);
      }
      
      // Then try guest participants
      const guestWinner = game.guestParticipants.find(p => p.hasWon);
      if (guestWinner?.completedCells) {
        return guestWinner.completedCells.includes(cellIndex);
      }
      
      // Fallback to first participant's completion status
      if (game.participants[0]?.completedCells) {
        return game.participants[0].completedCells.includes(cellIndex);
      }
      if (game.guestParticipants[0]?.completedCells) {
        return game.guestParticipants[0].completedCells.includes(cellIndex);
      }
    }
    
    return false;
  }

  function isCenterCell(row: number, col: number): boolean {
    return row === 2 && col === 2;
  }

  function getUserRank(userId: string): number {
    return sortedParticipants.findIndex((p) => p.id === userId) + 1;
  }
</script>

<svelte:head>
  <title>{game?.name || "Bingo Game"} - Cruise Bingo</title>
</svelte:head>

<!-- Join Game Modal -->
<Dialog.Root open={showJoinModal}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Join {game?.name || "Bingo Game"}</Dialog.Title>
      <Dialog.Description>
        Enter your name to join this game. Your name must be unique in this game.
      </Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4">
      <div class="space-y-2">
        <Label for="guest-name">Your Name</Label>
        <Input
          id="guest-name"
          bind:value={guestName}
          placeholder="Enter your name"
          on:keydown={(e) => e.key === 'Enter' && handleJoinGame()}
        />
        {#if joinError}
          <p class="text-sm text-red-500">{joinError}</p>
        {/if}
      </div>
    </div>
    <Dialog.Footer>
      <Button 
        on:click={handleJoinGame} 
        disabled={joinLoading || !guestName.trim()}
        class="w-full"
      >
        {#if joinLoading}
          <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
        {/if}
        Join Game
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

{#if loading}
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
    <div class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  </div>
{:else if !game}
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
    <div class="text-center py-12">
      <div class="mx-auto h-12 w-12 mb-4 text-4xl">😕</div>
      <h1 class="text-2xl font-bold mb-4">Game Not Found</h1>
      <p class="text-muted-foreground mb-6">
        This game doesn't exist or is not published.
      </p>
    </div>
  </div>
{:else}
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl space-y-8">
    <!-- Header -->
    <div class="space-y-4">
      <!-- Mobile Header -->
      <div class="lg:hidden">
        <div class="text-center space-y-2">
          <h1 class="text-2xl font-bold tracking-tight">{game.name}</h1>
          <div class="flex items-center justify-center gap-2">
            <Badge variant="default">
              LIVE GAME
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground">
            Host: {game.gameMaster.displayName || game.gameMaster.email.split('@')[0]}
          </p>
        </div>
      </div>

      <!-- Desktop Header -->
      <div class="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">{game.name}</h1>
          <div class="flex items-center gap-2">
            <p class="text-muted-foreground">
              Host: {game.gameMaster.displayName || game.gameMaster.email.split('@')[0]}
            </p>
            <Badge variant="default">LIVE GAME</Badge>
          </div>
        </div>
      </div>
    </div>

    <!-- Winner Announcement -->
    {#if game.status === "COMPLETED"}
      {@const winner = sortedParticipants.find(p => p.hasWon)}
      {#if winner}
        <Card.Root class="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <Card.Content class="pt-6">
            <div class="flex items-center gap-4">
              <div class="text-4xl">🏆</div>
              <div>
                <h2 class="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
                  We Have a Winner!
                </h2>
                <p class="text-yellow-700 dark:text-yellow-300">
                  🎉 Congratulations to <strong>{winner.name}</strong> for getting 5 in a row first!
                </p>
                <p class="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                  ✨ Feel free to keep playing and complete your board!
                </p>
              </div>
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    {/if}

    {#if !isJoined && game.status === "COMPLETED"}
      <!-- View-only message for completed games -->
      <Card.Root class="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Card.Content class="pt-6">
          <div class="text-center">
            <div class="text-4xl mb-4">👀</div>
            <h2 class="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2">
              Game Results
            </h2>
            <p class="text-blue-700 dark:text-blue-300">
              This game has ended, but you can view the final results below.
            </p>
          </div>
        </Card.Content>
      </Card.Root>
    {/if}

    {#if isJoined || game.status === "COMPLETED"}
      <!-- Mobile: Bingo Board First -->
      <div class="lg:hidden">
        <!-- Mobile Stats Bar -->
        <div class="grid grid-cols-2 gap-2 mb-6">
          <Card.Root>
            <Card.Content class="pt-4 pb-3">
              <div class="flex items-center justify-between">
                <div class="text-sm text-muted-foreground">
                  {guestParticipant ? "Score" : "Top Score"}
                </div>
                <div class="text-xl font-bold">
                  🎯 {guestParticipant?.score || sortedParticipants[0]?.score || 0}/25
                </div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-4 pb-3">
              <div class="flex items-center justify-between">
                <div class="text-sm text-muted-foreground">
                  {guestParticipant ? "Rank" : "Players"}
                </div>
                <div class="text-xl font-bold">
                  {guestParticipant ? `🏆 #${getUserRank(guestParticipant.id)}` : `👥 ${allParticipants.length}`}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        </div>

        <!-- Mobile Bingo Board -->
        <Card.Root class="mb-6">
          <Card.Header class="pb-3">
            <Card.Title class="text-center text-lg">
              {#if guestParticipant}
                Your Bingo Board
              {:else if game?.status === "COMPLETED"}
                {@const winner = sortedParticipants.find(p => p.hasWon)}
                {winner ? `${winner.name}'s Winning Board` : "Bingo Board"}
              {:else}
                Bingo Board
              {/if}
            </Card.Title>
          </Card.Header>
          <Card.Content class="px-2 pb-4">
            <div class="grid grid-cols-5 gap-1">
              {#each Array(5) as _, row}
                {#each Array(5) as _, col}
                  {@const isCompleted = isCellCompleted(row, col)}
                  {@const isCenter = isCenterCell(row, col)}
                  <button
                    class="p-1 text-[10px] font-medium border-2 rounded-lg transition-colors min-h-[70px] active:scale-95 flex items-center justify-center
                      {isCompleted
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background hover:bg-muted border-border'}
                      {isCenter ? 'bg-muted' : ''}
                      {game?.status === 'COMPLETED' && sortedParticipants.some(p => p.hasWon) ? 'cursor-not-allowed opacity-75' : ''}"
                    on:click={() => toggleCell(row * 5 + col)}
                    disabled={isCenter || (game?.status === 'COMPLETED' && sortedParticipants.some(p => p.hasWon))}
                  >
                    <span class="block leading-tight break-words text-center hyphens-auto max-w-full">
                      {getCellContent(row, col)}
                    </span>
                  </button>
                {/each}
              {/each}
            </div>
          </Card.Content>
        </Card.Root>

        <!-- Mobile Leaderboard -->
        <Card.Root>
          <Card.Header>
            <Card.Title class="text-lg">Leaderboard</Card.Title>
          </Card.Header>
          <Card.Content class="px-2">
            <div class="space-y-3">
              {#each sortedParticipants as participant, index}
                {@const isCurrentUser = participant.id === guestParticipant?.id}
                <div class="flex items-center justify-between p-3 rounded-lg 
                  {isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}">
                  <div class="flex items-center gap-3">
                    <div class="text-lg font-bold min-w-[32px]">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                    </div>
                    <div>
                      <div class="font-medium {isCurrentUser ? 'text-primary' : ''}">
                        {participant.name}
                        {#if isCurrentUser}<span class="text-xs">(You)</span>{/if}
                      </div>
                      <div class="flex items-center gap-1 text-xs text-muted-foreground">
                        {#if participant.isGuest}
                          <span>👤 Guest</span>
                        {:else}
                          <span>🔐 Player</span>
                        {/if}
                        {#if participant.hasWon}
                          <span class="text-yellow-600">🏆 Winner</span>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="text-right">
                    <div class="font-bold">{participant.score}</div>
                    <div class="text-xs text-muted-foreground">points</div>
                  </div>
                </div>
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      </div>

      <!-- Desktop Layout -->
      <div class="hidden lg:block">
        <!-- Desktop Stats Bar -->
        <div class="grid grid-cols-4 gap-6 mb-8">
          <Card.Root>
            <Card.Content class="pt-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-muted-foreground">
                  {guestParticipant ? "Your Score" : "Top Score"}
                </div>
                <div class="text-2xl font-bold">
                  🎯 {guestParticipant?.score || sortedParticipants[0]?.score || 0}/25
                </div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-muted-foreground">
                  {guestParticipant ? "Your Rank" : "Winner"}
                </div>
                <div class="text-2xl font-bold">
                  {#if guestParticipant}
                    🏆 #{getUserRank(guestParticipant.id)}
                  {:else}
                    {@const winner = sortedParticipants.find(p => p.hasWon)}
                    {winner ? `🏆 ${winner.name}` : '🏆 N/A'}
                  {/if}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-muted-foreground">Total Players</div>
                <div class="text-2xl font-bold">👥 {allParticipants.length}</div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-muted-foreground">Game Status</div>
                <div class="text-2xl font-bold">
                  {game.status === 'COMPLETED' ? '🏁 Done' : '🔴 Live'}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        </div>

        <!-- Desktop: Side by Side Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <!-- Bingo Board -->
          <div class="lg:col-span-2">
            <Card.Root>
              <Card.Header>
                <Card.Title>
                  {#if guestParticipant}
                    Your Bingo Board
                  {:else if game?.status === "COMPLETED"}
                    {@const winner = sortedParticipants.find(p => p.hasWon)}
                    {winner ? `${winner.name}'s Winning Board` : "Bingo Board"}
                  {:else}
                    Bingo Board
                  {/if}
                </Card.Title>
              </Card.Header>
              <Card.Content>
                <div class="grid grid-cols-5 gap-3">
                  {#each Array(5) as _, row}
                    {#each Array(5) as _, col}
                      {@const isCompleted = isCellCompleted(row, col)}
                      {@const isCenter = isCenterCell(row, col)}
                      <button
                        class="aspect-square p-3 text-sm font-medium border-2 rounded-lg transition-colors hover:scale-105
                          {isCompleted
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-border'}
                          {isCenter ? 'bg-muted' : ''}
                          {game?.status === 'COMPLETED' && sortedParticipants.some(p => p.hasWon) ? 'cursor-not-allowed opacity-75' : ''}"
                        on:click={() => toggleCell(row * 5 + col)}
                        disabled={isCenter || (game?.status === 'COMPLETED' && sortedParticipants.some(p => p.hasWon))}
                      >
                        <span class="block leading-tight">
                          {getCellContent(row, col)}
                        </span>
                      </button>
                    {/each}
                  {/each}
                </div>
              </Card.Content>
            </Card.Root>
          </div>

          <!-- Leaderboard -->
          <div>
            <Card.Root>
              <Card.Header>
                <Card.Title>Leaderboard</Card.Title>
              </Card.Header>
              <Card.Content>
                <div class="space-y-3">
                  {#each sortedParticipants as participant, index}
                    {@const isCurrentUser = participant.id === guestParticipant?.id}
                    <div class="flex items-center justify-between p-3 rounded-lg 
                      {isCurrentUser ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}">
                      <div class="flex items-center gap-3">
                        <div class="text-lg font-bold min-w-[32px]">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                        </div>
                        <div>
                          <div class="font-medium {isCurrentUser ? 'text-primary' : ''}">
                            {participant.name}
                            {#if isCurrentUser}<span class="text-xs">(You)</span>{/if}
                          </div>
                          <div class="flex items-center gap-1 text-xs text-muted-foreground">
                            {#if participant.isGuest}
                              <span>👤 Guest</span>
                            {:else}
                              <span>🔐 Player</span>
                            {/if}
                            {#if participant.hasWon}
                              <span class="text-yellow-600">🏆 Winner</span>
                            {/if}
                          </div>
                        </div>
                      </div>
                      <div class="text-right">
                        <div class="font-bold">{participant.score}</div>
                        <div class="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
                  {/each}
                </div>
              </Card.Content>
            </Card.Root>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if} 
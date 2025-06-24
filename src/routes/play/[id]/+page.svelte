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
  import CameraCapture from "$lib/components/CameraCapture.svelte";
  import ScoringRules from "$lib/components/ScoringRules.svelte";
  import { uploadPhoto } from "$lib/storage";
  import "$lib/setup-storage";
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
  let showCameraModal = false;
  let selectedCellIndex = -1;
  let selectedCellText = "";
  let photoUploading = false;
  let showPhotoModal = false;
  let selectedPhotoUrl = "";
  let selectedPhotoText = "";
  let photoActionLoading = false;

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

  function handleCellClick(cellIndex: number) {
    const row = Math.floor(cellIndex / 5);
    const col = cellIndex % 5;
    const photoUrl = getCellPhotoUrl(row, col);
    
    // If there's a photo, show the photo modal
    if (photoUrl) {
      selectedCellIndex = cellIndex;
      selectedPhotoUrl = photoUrl;
      selectedPhotoText = getCellContent(row, col);
      showPhotoModal = true;
      return;
    }
    
    // Otherwise, handle normal cell toggle
    toggleCell(cellIndex);
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
      // Unchecking - just remove the cell (and photo if any)
      completedCells.splice(cellIndexInCompleted, 1);
      
      // Clear the photo URL for this cell
      const currentPhotoUrls = guestParticipant.photoUrls || [];
      const photoUrls = [];
      
      // Fill the array up to index 24 (for a 5x5 grid)
      for (let i = 0; i < 25; i++) {
        if (i === cellIndex) {
          photoUrls[i] = ""; // Clear this photo
        } else if (i < currentPhotoUrls.length) {
          photoUrls[i] = currentPhotoUrls[i] || "";
        } else {
          photoUrls[i] = "";
        }
      }
      
      // Update without requiring photo
      try {
        const updated = await updateGuestParticipantScore(gameId, guestParticipant.id, completedCells, photoUrls);
        guestParticipant = updated;
        await loadGameData();
      } catch (error) {
        console.error("Error updating score:", error);
      }
    } else {
      // Checking - require photo
      selectedCellIndex = cellIndex;
      selectedCellText = getCellContent(Math.floor(cellIndex / 5), cellIndex % 5);
      showCameraModal = true;
    }
  }

  async function handlePhotoTaken(event: CustomEvent<File>) {
    if (!guestParticipant || selectedCellIndex === -1) return;

    try {
      photoUploading = true;
      
      // Upload photo via API endpoint
      const formData = new FormData();
      formData.append('file', event.detail);
      formData.append('participantId', guestParticipant.id);
      formData.append('cellIndex', selectedCellIndex.toString());

      const uploadResponse = await fetch(`/api/games/${gameId}/photos`, {
        method: 'POST',
        body: formData
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || 'Failed to upload photo');
      }

      const uploadResult = await uploadResponse.json();

      // Store the cell index before clearing it
      const cellIndex = selectedCellIndex;

      // Close the camera modal immediately after successful upload
      showCameraModal = false;
      selectedCellIndex = -1;
      selectedCellText = "";

      // Add cell to completed cells
      const completedCells = [...guestParticipant.completedCells, cellIndex];
      
      // Create a proper photoUrls array - initialize with empty strings up to the cell index
      const currentPhotoUrls = guestParticipant.photoUrls || [];
      const photoUrls = [];
      
      // Fill the array up to index 24 (for a 5x5 grid)
      for (let i = 0; i < 25; i++) {
        if (i === cellIndex) {
          photoUrls[i] = uploadResult.photoUrl;
        } else if (i < currentPhotoUrls.length) {
          photoUrls[i] = currentPhotoUrls[i] || "";
        } else {
          photoUrls[i] = "";
        }
      }

      // Update participant with new photo (this happens in background)
      const updated = await updateGuestParticipantScore(gameId, guestParticipant.id, completedCells, photoUrls);
      guestParticipant = updated;
      await loadGameData();
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert(`Failed to upload photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      photoUploading = false;
    }
  }

  function handleCameraCancel() {
    showCameraModal = false;
    selectedCellIndex = -1;
    selectedCellText = "";
  }

  async function handleRemovePhoto() {
    if (!guestParticipant || selectedCellIndex === -1) return;

    try {
      photoActionLoading = true;
      // Keep the cell as completed but remove the photo
      const completedCells = [...guestParticipant.completedCells];
      const currentPhotoUrls = guestParticipant.photoUrls || [];
      const photoUrls = [];
      
      // Fill the array up to index 24 (for a 5x5 grid)
      for (let i = 0; i < 25; i++) {
        if (i === selectedCellIndex) {
          photoUrls[i] = ""; // Clear this photo
        } else if (i < currentPhotoUrls.length) {
          photoUrls[i] = currentPhotoUrls[i] || "";
        } else {
          photoUrls[i] = "";
        }
      }
      
      const updated = await updateGuestParticipantScore(gameId, guestParticipant.id, completedCells, photoUrls);
      guestParticipant = updated;
      await loadGameData();
      
      showPhotoModal = false;
      selectedCellIndex = -1;
      selectedPhotoUrl = "";
      selectedPhotoText = "";
    } catch (error) {
      console.error("Error removing photo:", error);
      alert(`Failed to remove photo: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      photoActionLoading = false;
    }
  }

  function handleChangePhoto() {
    if (!guestParticipant || selectedCellIndex === -1) return;
    
    // Close photo modal and open camera modal to take a new photo
    showPhotoModal = false;
    selectedCellText = getCellContent(Math.floor(selectedCellIndex / 5), selectedCellIndex % 5);
    showCameraModal = true;
  }

  async function handleUnselectSquare() {
    if (!guestParticipant || selectedCellIndex === -1) return;

    try {
      photoActionLoading = true;
      // Remove the cell from completed cells and clear the photo
      const completedCells = [...guestParticipant.completedCells];
      const cellIndexInCompleted = completedCells.indexOf(selectedCellIndex);
      
      if (cellIndexInCompleted > -1) {
        completedCells.splice(cellIndexInCompleted, 1);
      }
      
      // Clear the photo URL for this cell
      const currentPhotoUrls = guestParticipant.photoUrls || [];
      const photoUrls = [];
      
      // Fill the array up to index 24 (for a 5x5 grid)
      for (let i = 0; i < 25; i++) {
        if (i === selectedCellIndex) {
          photoUrls[i] = ""; // Clear this photo
        } else if (i < currentPhotoUrls.length) {
          photoUrls[i] = currentPhotoUrls[i] || "";
        } else {
          photoUrls[i] = "";
        }
      }
      
      const updated = await updateGuestParticipantScore(gameId, guestParticipant.id, completedCells, photoUrls);
      guestParticipant = updated;
      await loadGameData();
      
      showPhotoModal = false;
      selectedCellIndex = -1;
      selectedPhotoUrl = "";
      selectedPhotoText = "";
    } catch (error) {
      console.error("Error unselecting square:", error);
      alert(`Failed to unselect square: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      photoActionLoading = false;
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

  function isBonusSquare(row: number, col: number): boolean {
    const cellIndex = row * 5 + col;
    return game?.bonusSquare === cellIndex;
  }

  function isWildcardSquare(row: number, col: number): boolean {
    const cellIndex = row * 5 + col;
    return game?.wildcardSquare === cellIndex;
  }

  function getCellPhotoUrl(row: number, col: number): string | null {
    const cellIndex = row * 5 + col;
    
    // If user is joined, show their photo
    if (guestParticipant?.photoUrls && guestParticipant.photoUrls[cellIndex] && guestParticipant.photoUrls[cellIndex] !== "") {
      return guestParticipant.photoUrls[cellIndex];
    }
    
    // For non-participants viewing completed games, show the winner's photo if available
    if (game?.status === "COMPLETED") {
      // Try to find winner among authenticated participants first
      const authWinner = game.participants.find(p => p.hasWon);
      if (authWinner?.photoUrls && authWinner.photoUrls[cellIndex] && authWinner.photoUrls[cellIndex] !== "") {
        return authWinner.photoUrls[cellIndex];
      }
      
      // Then try guest participants
      const guestWinner = game.guestParticipants.find(p => p.hasWon);
      if (guestWinner?.photoUrls && guestWinner.photoUrls[cellIndex] && guestWinner.photoUrls[cellIndex] !== "") {
        return guestWinner.photoUrls[cellIndex];
      }
      
      // Fallback to first participant's photos
      if (game.participants[0]?.photoUrls && game.participants[0].photoUrls[cellIndex] && game.participants[0].photoUrls[cellIndex] !== "") {
        return game.participants[0].photoUrls[cellIndex];
      }
      if (game.guestParticipants[0]?.photoUrls && game.guestParticipants[0].photoUrls[cellIndex] && game.guestParticipants[0].photoUrls[cellIndex] !== "") {
        return game.guestParticipants[0].photoUrls[cellIndex];
      }
    }
    
    return null;
  }
</script>

<svelte:head>
  <title>{game?.name || "Bingo Game"} - Bingo</title>
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
                  {@const photoUrl = getCellPhotoUrl(row, col)}
                  {@const isBonus = isBonusSquare(row, col)}
                  {@const isWildcard = isWildcardSquare(row, col)}
                  <button
                                          class="p-1 text-[10px] font-medium border-2 rounded-lg transition-colors min-h-[70px] active:scale-95 flex flex-col items-center justify-center relative overflow-hidden
                        {isCompleted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'}
                        {isCenter ? 'bg-muted' : ''}
                        {isBonus ? 'border-blue-400 bg-blue-50 dark:bg-blue-950' : ''}
                        {isWildcard ? 'border-purple-400 bg-purple-50 dark:bg-purple-950' : ''}
                        {game?.status === 'COMPLETED' && sortedParticipants.some(p => p.hasWon) ? 'cursor-not-allowed opacity-75' : ''}"
                    on:click={() => handleCellClick(row * 5 + col)}
                    disabled={isCenter}
                  
                  >
                                          {#if photoUrl}
                        <img 
                          src={photoUrl} 
                          alt="Proof photo" 
                          class="absolute inset-0 w-full h-full object-cover rounded-md"
                        />
                        <div class="absolute inset-0 bg-black bg-opacity-30 rounded-md"></div>
                        <span class="relative z-10 text-white text-shadow font-bold leading-tight break-words text-center hyphens-auto max-w-full">
                          {getCellContent(row, col)}
                        </span>
                        {#if isCompleted}
                          <div class="absolute top-1 right-1 text-white">✓</div>
                        {/if}
                        {#if isBonus}
                          <div class="absolute bottom-1 left-1 text-xs">🎯</div>
                        {/if}
                        {#if isWildcard}
                          <div class="absolute bottom-1 right-1 text-xs">🃏</div>
                        {/if}
                      {:else}
                        <span class="block leading-tight break-words text-center hyphens-auto max-w-full">
                          {getCellContent(row, col)}
                        </span>
                        {#if isBonus}
                          <div class="absolute bottom-1 left-1 text-xs opacity-60">🎯</div>
                        {/if}
                        {#if isWildcard}
                          <div class="absolute bottom-1 right-1 text-xs opacity-60">🃏</div>
                        {/if}
                      {/if}
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

        <!-- Mobile Scoring Rules -->
        <ScoringRules {game} />
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
                      {@const photoUrl = getCellPhotoUrl(row, col)}
                      {@const isBonus = isBonusSquare(row, col)}
                      {@const isWildcard = isWildcardSquare(row, col)}
                      <button
                        class="aspect-square p-3 text-sm font-medium border-2 rounded-lg transition-colors hover:scale-105 relative overflow-hidden flex flex-col items-center justify-center
                          {isCompleted
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-border'}
                          {isCenter ? 'bg-muted' : ''}
                          {isBonus ? 'border-blue-400 bg-blue-50 dark:bg-blue-950' : ''}
                          {isWildcard ? 'border-purple-400 bg-purple-50 dark:bg-purple-950' : ''}
                          {game?.status === 'COMPLETED' && sortedParticipants.some(p => p.hasWon) ? 'cursor-not-allowed opacity-75' : ''}"
                        on:click={() => handleCellClick(row * 5 + col)}
                        disabled={isCenter}
                      >
                        {#if photoUrl}
                          <img 
                            src={photoUrl} 
                            alt="Proof photo" 
                            class="absolute inset-0 w-full h-full object-cover rounded-md"
                          />
                          <div class="absolute inset-0 bg-black bg-opacity-30 rounded-md"></div>
                          <span class="relative z-10 text-white text-shadow font-bold leading-tight text-center">
                            {getCellContent(row, col)}
                          </span>
                          {#if isCompleted}
                            <div class="absolute top-2 right-2 text-white text-lg">✓</div>
                          {/if}
                          {#if isBonus}
                            <div class="absolute bottom-2 left-2 text-sm">🎯</div>
                          {/if}
                          {#if isWildcard}
                            <div class="absolute bottom-2 right-2 text-sm">🃏</div>
                          {/if}
                        {:else}
                          <span class="block leading-tight text-center">
                            {getCellContent(row, col)}
                          </span>
                          {#if isBonus}
                            <div class="absolute bottom-2 left-2 text-sm opacity-60">🎯</div>
                          {/if}
                          {#if isWildcard}
                            <div class="absolute bottom-2 right-2 text-sm opacity-60">🃏</div>
                          {/if}
                        {/if}
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

            <!-- Scoring Rules -->
            <ScoringRules {game} />
          </div>
            </div>
  </div>
{/if}

<!-- Camera Modal -->
<CameraCapture 
  bind:open={showCameraModal}
  cellText={selectedCellText}
  on:photo={handlePhotoTaken}
  on:cancel={handleCameraCancel}
/>

<!-- Photo View Modal -->
<Dialog.Root bind:open={showPhotoModal}>
  <Dialog.Content class="max-w-2xl">
    <Dialog.Header>
      <Dialog.Title>Photo for: {selectedPhotoText}</Dialog.Title>
    </Dialog.Header>
    <div class="flex justify-center mb-4">
      <img 
        src={selectedPhotoUrl} 
        alt="Proof photo for {selectedPhotoText}"
        class="max-w-full max-h-96 object-contain rounded-lg"
      />
    </div>
    <Dialog.Footer class="flex gap-2">
      <Button 
        variant="destructive" 
        size="sm"
        on:click={() => handleRemovePhoto()}
        disabled={!guestParticipant || photoActionLoading}
      >
        {#if photoActionLoading}
          <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
        {/if}
        🗑️ Remove Photo
      </Button>
      <Button 
        variant="outline" 
        size="sm"
        on:click={() => handleChangePhoto()}
        disabled={!guestParticipant || photoActionLoading}
      >
        📷 Change Photo
      </Button>
      <Button 
        variant="secondary" 
        size="sm"
        on:click={() => handleUnselectSquare()}
        disabled={!guestParticipant || photoActionLoading}
      >
        {#if photoActionLoading}
          <div class="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
        {/if}
        ❌ Unselect Square
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

{#if photoUploading}
  <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white p-6 rounded-lg shadow-lg">
      <div class="flex items-center gap-4">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span class="text-lg">Uploading photo...</span>
      </div>
    </div>
  </div>
{/if}
  </div>
{/if} 
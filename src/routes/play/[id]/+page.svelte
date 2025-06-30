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
  import {
    saveGuestSession,
    loadGuestSession,
    clearGuestSession,
  } from "$lib/cookies";
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
  let guestEmail = "";
  let guestDisplayName = "";
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
      const authParticipants: AllParticipants[] = gameData.participants.map(
        (p) => ({
          id: p.id,
          name: p.user.displayName || p.user.email.split("@")[0],
          score: p.score,
          hasWon: p.hasWon,
          isGuest: false,
        })
      );

      const guestParticipants: AllParticipants[] =
        gameData.guestParticipants.map((p) => ({
          id: p.id,
          name: p.guestName || p.email.split("@")[0] || "Guest",
          score: p.score,
          hasWon: p.hasWon,
          isGuest: true,
        }));

      allParticipants = [...authParticipants, ...guestParticipants];

      // Check if user is already joined (using cookies/localStorage to remember)
      const savedSession = loadGuestSession(gameId);
      if (savedSession) {
        const existingGuest = gameData.guestParticipants.find(
          (p) => p.email === savedSession.email
        );
        if (existingGuest) {
          guestParticipant = existingGuest;
          guestEmail = savedSession.email;
          guestDisplayName = savedSession.displayName;
          showJoinModal = false;
        } else {
          // Guest was removed but we have their info - pre-fill the form
          guestEmail = savedSession.email;
          guestDisplayName = savedSession.displayName;
          // Keep the session data for potential re-joining, don't clear it yet
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
    if (!guestEmail.trim()) {
      joinError = "Please enter your email address";
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestEmail.trim())) {
      joinError = "Please enter a valid email address";
      return;
    }

    try {
      joinLoading = true;
      joinError = "";

      const displayName = guestDisplayName.trim() || guestEmail.split("@")[0];
      const newGuest = await joinGameAsGuest(
        gameId,
        guestEmail.trim(),
        displayName
      );
      guestParticipant = newGuest;

      // Save guest session for easier rejoining across tabs and sessions
      saveGuestSession(gameId, guestEmail.trim(), displayName);

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
    if (
      game?.status === "COMPLETED" &&
      sortedParticipants.some((p) => p.hasWon)
    )
      return;

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
        const updated = await updateGuestParticipantScore(
          gameId,
          guestParticipant.id,
          completedCells,
          photoUrls
        );
        guestParticipant = updated;
        await loadGameData();
      } catch (error) {
        console.error("Error updating score:", error);
      }
    } else {
      // Checking - require photo
      selectedCellIndex = cellIndex;
      selectedCellText = getCellContent(
        Math.floor(cellIndex / 5),
        cellIndex % 5
      );
      showCameraModal = true;
    }
  }

  async function handlePhotoTaken(event: CustomEvent<File>) {
    if (!guestParticipant || selectedCellIndex === -1) return;

    try {
      photoUploading = true;

      // Upload photo via API endpoint
      const formData = new FormData();
      formData.append("file", event.detail);
      formData.append("participantId", guestParticipant.id);
      formData.append("cellIndex", selectedCellIndex.toString());

      const uploadResponse = await fetch(`/api/games/${gameId}/photos`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.error || "Failed to upload photo");
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
      const updated = await updateGuestParticipantScore(
        gameId,
        guestParticipant.id,
        completedCells,
        photoUrls
      );
      guestParticipant = updated;
      await loadGameData();
    } catch (error) {
      console.error("Error uploading photo:", error);
      alert(
        `Failed to upload photo: ${error instanceof Error ? error.message : "Unknown error"}`
      );
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

      const updated = await updateGuestParticipantScore(
        gameId,
        guestParticipant.id,
        completedCells,
        photoUrls
      );
      guestParticipant = updated;
      await loadGameData();

      showPhotoModal = false;
      selectedCellIndex = -1;
      selectedPhotoUrl = "";
      selectedPhotoText = "";
    } catch (error) {
      console.error("Error removing photo:", error);
      alert(
        `Failed to remove photo: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      photoActionLoading = false;
    }
  }

  function handleChangePhoto() {
    if (!guestParticipant || selectedCellIndex === -1) return;

    // Close photo modal and open camera modal to take a new photo
    showPhotoModal = false;
    selectedCellText = getCellContent(
      Math.floor(selectedCellIndex / 5),
      selectedCellIndex % 5
    );
    showCameraModal = true;
  }

  function handlePrint() {
    window.print();
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

      const updated = await updateGuestParticipantScore(
        gameId,
        guestParticipant.id,
        completedCells,
        photoUrls
      );
      guestParticipant = updated;
      await loadGameData();

      showPhotoModal = false;
      selectedCellIndex = -1;
      selectedPhotoUrl = "";
      selectedPhotoText = "";
    } catch (error) {
      console.error("Error unselecting square:", error);
      alert(
        `Failed to unselect square: ${error instanceof Error ? error.message : "Unknown error"}`
      );
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
      const authWinner = game.participants.find((p) => p.hasWon);
      if (authWinner?.boardData) {
        return authWinner.boardData[cellIndex] || "";
      }

      // Then try guest participants
      const guestWinner = game.guestParticipants.find((p) => p.hasWon);
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

  function getCellCardType(row: number, col: number): string {
    const cellIndex = row * 5 + col;

    // If user is joined, show their card types
    if (guestParticipant?.cardTypeData) {
      return guestParticipant.cardTypeData[cellIndex] || "see";
    }

    // For non-participants viewing completed games, show the winner's card types if available
    if (game?.status === "COMPLETED") {
      // Try to find winner among authenticated participants first
      const authWinner = game.participants.find((p) => p.hasWon);
      if (authWinner?.cardTypeData) {
        return authWinner.cardTypeData[cellIndex] || "see";
      }

      // Then try guest participants
      const guestWinner = game.guestParticipants.find((p) => p.hasWon);
      if (guestWinner?.cardTypeData) {
        return guestWinner.cardTypeData[cellIndex] || "see";
      }

      // Fallback to first participant's card types
      if (game.participants[0]?.cardTypeData) {
        return game.participants[0].cardTypeData[cellIndex] || "see";
      }
      if (game.guestParticipants[0]?.cardTypeData) {
        return game.guestParticipants[0].cardTypeData[cellIndex] || "see";
      }
    }

    return "see";
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

  function isCellCompleted(row: number, col: number): boolean {
    const cellIndex = row * 5 + col;

    // If user is joined, show their completion status
    if (guestParticipant) {
      return guestParticipant.completedCells.includes(cellIndex);
    }

    // For non-participants viewing completed games, show the winner's completion status
    if (game?.status === "COMPLETED") {
      // Try to find winner among authenticated participants first
      const authWinner = game.participants.find((p) => p.hasWon);
      if (authWinner?.completedCells) {
        return authWinner.completedCells.includes(cellIndex);
      }

      // Then try guest participants
      const guestWinner = game.guestParticipants.find((p) => p.hasWon);
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
    if (
      guestParticipant?.photoUrls &&
      guestParticipant.photoUrls[cellIndex] &&
      guestParticipant.photoUrls[cellIndex] !== ""
    ) {
      return guestParticipant.photoUrls[cellIndex];
    }

    // For non-participants viewing completed games, show the winner's photo if available
    if (game?.status === "COMPLETED") {
      // Try to find winner among authenticated participants first
      const authWinner = game.participants.find((p) => p.hasWon);
      if (
        authWinner?.photoUrls &&
        authWinner.photoUrls[cellIndex] &&
        authWinner.photoUrls[cellIndex] !== ""
      ) {
        return authWinner.photoUrls[cellIndex];
      }

      // Then try guest participants
      const guestWinner = game.guestParticipants.find((p) => p.hasWon);
      if (
        guestWinner?.photoUrls &&
        guestWinner.photoUrls[cellIndex] &&
        guestWinner.photoUrls[cellIndex] !== ""
      ) {
        return guestWinner.photoUrls[cellIndex];
      }

      // Fallback to first participant's photos
      if (
        game.participants[0]?.photoUrls &&
        game.participants[0].photoUrls[cellIndex] &&
        game.participants[0].photoUrls[cellIndex] !== ""
      ) {
        return game.participants[0].photoUrls[cellIndex];
      }
      if (
        game.guestParticipants[0]?.photoUrls &&
        game.guestParticipants[0].photoUrls[cellIndex] &&
        game.guestParticipants[0].photoUrls[cellIndex] !== ""
      ) {
        return game.guestParticipants[0].photoUrls[cellIndex];
      }
    }

    return null;
  }

  function handleLeaveGame() {
    if (
      confirm(
        "Are you sure you want to leave this game? Your session will be cleared and you'll need to rejoin."
      )
    ) {
      clearGuestSession(gameId);
      guestParticipant = null;
      guestEmail = "";
      guestDisplayName = "";
      showJoinModal = true;
    }
  }

  function hasPhotos(participantId: string): boolean {
    // Check guest participants
    const guestParticipant = game?.guestParticipants.find(
      (p) => p.id === participantId
    );
    if (guestParticipant?.photoUrls) {
      return guestParticipant.photoUrls.some((url) => url && url.trim() !== "");
    }

    // Check authenticated participants
    const authParticipant = game?.participants.find(
      (p) => p.id === participantId
    );
    if (authParticipant?.photoUrls) {
      return authParticipant.photoUrls.some((url) => url && url.trim() !== "");
    }

    return false;
  }

  function handleViewPhotos(participantId: string) {
    goto(`/play/${gameId}/gallery/${participantId}`);
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
        Enter your email and optional display name to join this game. Your email
        must be unique in this game.
      </Dialog.Description>
    </Dialog.Header>
    <div class="space-y-4">
      {#if guestEmail && guestDisplayName}
        <div
          class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
        >
          <div class="flex items-center gap-2">
            <div class="text-blue-600 dark:text-blue-400">💾</div>
            <div class="text-sm text-blue-700 dark:text-blue-300">
              <strong>Welcome back!</strong> Your previous session info has been
              restored.
            </div>
          </div>
        </div>
      {/if}

      <div class="space-y-2">
        <Label for="guest-email">Email</Label>
        <Input
          id="guest-email"
          bind:value={guestEmail}
          placeholder="Enter your email"
        />
        <Label for="guest-display-name">Display Name (Optional)</Label>
        <Input
          id="guest-display-name"
          bind:value={guestDisplayName}
          placeholder="Optional - will use email name if empty"
        />
        {#if joinError}
          <p class="text-sm text-red-500">{joinError}</p>
        {/if}
      </div>
    </div>
    <Dialog.Footer>
      <Button
        on:click={handleJoinGame}
        disabled={joinLoading || !guestEmail.trim()}
        class="w-full"
      >
        {#if joinLoading}
          <div
            class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
          ></div>
        {/if}
        Join Game
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

{#if loading}
  <div class="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">
    <div class="flex justify-center items-center h-64">
      <div
        class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
      ></div>
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
          <div class="flex items-center justify-between">
            <div class="w-16"><!-- Spacer for centering --></div>
            <h1 class="text-2xl font-bold tracking-tight print:hidden">
              {game.name}
            </h1>
            <div class="w-16 flex justify-end">
              {#if guestParticipant}
                <Button
                  variant="ghost"
                  size="sm"
                  on:click={handleLeaveGame}
                  class="text-xs p-2 h-8 text-muted-foreground hover:text-destructive print:hidden"
                >
                  Leave
                </Button>
              {/if}
            </div>
          </div>
          {#if guestParticipant}
            <p class="text-lg font-semibold text-primary print:hidden">
              🎮 Playing as: {guestParticipant.guestName ||
                guestParticipant.email.split("@")[0]}
            </p>
          {/if}
          <div class="flex items-center justify-center gap-2 print:hidden">
            <Badge variant="default">LIVE GAME</Badge>
            {#if guestParticipant}
              <Button
                variant="outline"
                size="sm"
                on:click={handlePrint}
                class="text-xs"
              >
                🖨️ Print Board
              </Button>
            {/if}
          </div>
          <p class="text-sm text-muted-foreground print:hidden">
            Host: {game.gameMaster.displayName ||
              game.gameMaster.email.split("@")[0]}
          </p>
        </div>
      </div>

      <!-- Desktop Header -->
      <div
        class="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 class="text-3xl font-bold tracking-tight print:hidden">
            {game.name}
          </h1>
          {#if guestParticipant}
            <p class="text-xl font-semibold text-primary mb-2 print:hidden">
              🎮 Playing as: {guestParticipant.guestName ||
                guestParticipant.email.split("@")[0]}
            </p>
          {/if}
          <div class="flex items-center gap-2 print:hidden">
            <p class="text-muted-foreground">
              Host: {game.gameMaster.displayName ||
                game.gameMaster.email.split("@")[0]}
            </p>
            <Badge variant="default">LIVE GAME</Badge>
          </div>
        </div>
        <div class="flex items-center gap-2 print:hidden">
          {#if guestParticipant}
            <Button variant="outline" size="sm" on:click={handlePrint}>
              🖨️ Print Board
            </Button>
            <Button
              variant="outline"
              size="sm"
              on:click={handleLeaveGame}
              class="text-muted-foreground hover:text-destructive hover:border-destructive"
            >
              Leave Game
            </Button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Winner announcement removed - games now use leaderboard-based scoring -->
    <div class="print:hidden">
      {#if !isJoined && game.status === "COMPLETED"}
        <!-- View-only message for completed games -->
        <Card.Root
          class="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
        >
          <Card.Content class="pt-6">
            <div class="text-center">
              <div class="text-4xl mb-4">👀</div>
              <h2
                class="text-xl font-bold text-blue-800 dark:text-blue-200 mb-2"
              >
                Game Results
              </h2>
              <p class="text-blue-700 dark:text-blue-300">
                This game has ended, but you can view the final results below.
              </p>
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>

    {#if isJoined || game.status === "COMPLETED"}
      <!-- Print-Only Content - Always present but hidden on screen -->
      <div class="print-only-content" style="display: none;">
        <div class="print-header-content">
          <h1 class="print-title">{game.name}</h1>
          {#if guestParticipant}
            <div class="print-player-name">
              {guestParticipant.guestName ||
                guestParticipant.email.split("@")[0]}
            </div>
          {/if}
        </div>

        <!-- Simple Print Bingo Board -->
        {#if guestParticipant}
          <div class="simple-print-bingo">
            {#each Array(25) as _, index}
              {@const row = Math.floor(index / 5)}
              {@const col = index % 5}
              {@const isCompleted = isCellCompleted(row, col)}
              {@const isCenter = isCenterCell(row, col)}
              {@const isBonus = isBonusSquare(row, col)}
              {@const isWildcard = isWildcardSquare(row, col)}
              {@const cardType = getCellCardType(row, col)}
              {@const cardTypeIcon = getCardTypeIcon(cardType)}
              <div
                class="simple-cell {isCompleted ? 'completed' : ''} {isCenter
                  ? 'center'
                  : ''}"
              >
                {#if !isCenter}
                  <div class="card-type-emoji">{cardTypeIcon}</div>
                {/if}
                {#if isBonus}
                  <div class="bonus-emoji">🎯</div>
                {/if}
                {#if isWildcard}
                  <div class="wildcard-emoji">🃏</div>
                {/if}
                <div class="cell-content">{getCellContent(row, col)}</div>
              </div>
            {/each}
          </div>

          <!-- Page Break -->
          <div class="print-page-break"></div>

          <!-- Scoring Rules Page -->
          <div class="print-scoring-page">
            <h2 class="print-scoring-title">🏆 Scoring Rules</h2>
            <p class="print-scoring-subtitle">
              How points are awarded in this game
            </p>

            <!-- Basic Scoring -->
            <div class="print-scoring-section">
              <h3 class="print-section-title">Basic Scoring</h3>

              <div class="print-rule-item">
                <div class="print-rule-name">Mark Square</div>
                <div class="print-rule-points">+1 point</div>
                <div class="print-rule-desc">
                  Awarded for every square marked
                </div>
              </div>

              <!-- Special Squares -->
              {#if game?.bonusSquare !== null && game?.bonusSquare !== undefined}
                {@const bonusRow = Math.floor(game.bonusSquare / 5) + 1}
                {@const bonusCol = (game.bonusSquare % 5) + 1}
                <div class="print-rule-item print-bonus-rule">
                  <div class="print-rule-name">
                    🎯 Bonus Square (Row {bonusRow}, Col {bonusCol})
                  </div>
                  <div class="print-rule-points">+2 points</div>
                  <div class="print-rule-desc">
                    Bonus for being first to mark this square
                  </div>
                </div>
              {/if}

              {#if game?.wildcardSquare !== null && game?.wildcardSquare !== undefined}
                {@const wildRow = Math.floor(game.wildcardSquare / 5) + 1}
                {@const wildCol = (game.wildcardSquare % 5) + 1}
                <div class="print-rule-item print-wildcard-rule">
                  <div class="print-rule-name">
                    🃏 Wild Card (Row {wildRow}, Col {wildCol})
                  </div>
                  <div class="print-rule-points">x2 multiplier</div>
                  <div class="print-rule-desc">
                    Double points when this square is marked
                  </div>
                </div>
              {/if}
            </div>

            <!-- Pattern Bonuses -->
            <div class="print-scoring-section">
              <h3 class="print-section-title">Pattern Bonuses</h3>

              <div class="print-rule-item">
                <div class="print-rule-name">Mini-Line (4 connected)</div>
                <div class="print-rule-points">+4 points</div>
                <div class="print-rule-desc">
                  Any 4 connected squares (horizontal, vertical, or diagonal)
                </div>
              </div>

              <div class="print-rule-item">
                <div class="print-rule-name">Diagonal Line</div>
                <div class="print-rule-points">+5 points</div>
                <div class="print-rule-desc">
                  Complete diagonal line (corner to corner)
                </div>
              </div>

              <div class="print-rule-item">
                <div class="print-rule-name">Five in a Row</div>
                <div class="print-rule-points">+6 points</div>
                <div class="print-rule-desc">
                  Complete line of 5 (horizontal or vertical)
                </div>
              </div>

              <div class="print-rule-item">
                <div class="print-rule-name">All Corners</div>
                <div class="print-rule-points">+7 points</div>
                <div class="print-rule-desc">Mark all 4 corner squares</div>
              </div>

              <div class="print-rule-item">
                <div class="print-rule-name">Full Border</div>
                <div class="print-rule-points">+10 points</div>
                <div class="print-rule-desc">
                  Mark all squares along the outer edge
                </div>
              </div>
            </div>

            <!-- Tips -->
            <div class="print-tip">
              💡 <strong>Tip:</strong> Pattern bonuses stack! You can earn multiple
              bonuses for the same squares.
            </div>

            <!-- Legend -->
            <div class="print-legend">
              <h3 class="print-section-title">Square Types</h3>
              <div class="print-legend-grid">
                <div class="print-legend-item">
                  <span class="print-legend-emoji">👁️</span>
                  <span class="print-legend-text"
                    >See - Something to spot or observe</span
                  >
                </div>
                <div class="print-legend-item">
                  <span class="print-legend-emoji">⚡</span>
                  <span class="print-legend-text"
                    >Action - Something to do or participate in</span
                  >
                </div>
                <div class="print-legend-item">
                  <span class="print-legend-emoji">🎯</span>
                  <span class="print-legend-text"
                    >Free - Center square (automatically completed)</span
                  >
                </div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      <!-- Mobile: Bingo Board First -->
      <div class="lg:hidden print:hidden">
        <!-- Mobile Stats Bar -->
        <div class="grid grid-cols-2 gap-2 mb-6">
          <Card.Root>
            <Card.Content class="pt-4 pb-3">
              <div class="flex items-center justify-between">
                <div class="text-sm text-muted-foreground">
                  {guestParticipant ? "Score" : "Top Score"}
                </div>
                <div class="text-xl font-bold">
                  🎯 {guestParticipant?.score ||
                    sortedParticipants[0]?.score ||
                    0}/25
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
                  {guestParticipant
                    ? `🏆 #${getUserRank(guestParticipant.id)}`
                    : `👥 ${allParticipants.length}`}
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
                Final Board
              {:else}
                Bingo Board
              {/if}
            </Card.Title>
          </Card.Header>
          <Card.Content class="px-2 pb-4">
            <div class="grid grid-cols-5 gap-1 bingo-board-grid">
              {#each Array(5) as _, row}
                {#each Array(5) as _, col}
                  {@const isCompleted = isCellCompleted(row, col)}
                  {@const isCenter = isCenterCell(row, col)}
                  {@const photoUrl = getCellPhotoUrl(row, col)}
                  {@const isBonus = isBonusSquare(row, col)}
                  {@const isWildcard = isWildcardSquare(row, col)}
                  {@const cardType = getCellCardType(row, col)}
                  {@const cardTypeIcon = getCardTypeIcon(cardType)}
                  <button
                    class="p-1 text-[10px] font-medium border-2 rounded-lg transition-colors min-h-[70px] active:scale-95 flex flex-col items-center justify-center relative overflow-hidden
                        {isCompleted
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-border'}
                        {isCenter ? 'bg-muted' : ''}
                        {isBonus
                      ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                      : ''}
                        {isWildcard
                      ? 'border-purple-400 bg-purple-50 dark:bg-purple-950'
                      : ''}
                        {game?.status === 'COMPLETED'
                      ? 'cursor-not-allowed opacity-75'
                      : ''}"
                    on:click={() => handleCellClick(row * 5 + col)}
                    disabled={isCenter}
                  >
                    <!-- Card Type Icon in top left -->
                    {#if !isCenter}
                      <div
                        class="absolute top-1 left-1 text-sm font-black z-20 {isCompleted
                          ? 'text-yellow-300 opacity-100 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] filter brightness-125'
                          : 'text-gray-600 opacity-80'}"
                      >
                        {cardTypeIcon}
                      </div>
                    {/if}

                    {#if photoUrl}
                      <img
                        src={photoUrl}
                        alt="Proof photo"
                        class="absolute inset-0 w-full h-full object-cover rounded-md"
                      />
                      <div
                        class="absolute inset-0 bg-black bg-opacity-30 rounded-md"
                      ></div>
                      <span
                        class="relative z-10 text-white text-shadow font-bold leading-tight break-words text-center hyphens-auto max-w-full {!isCenter
                          ? 'mt-2'
                          : ''}"
                      >
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
                      <span
                        class="block leading-tight break-words text-center hyphens-auto max-w-full {!isCenter
                          ? 'mt-2'
                          : ''}"
                      >
                        {getCellContent(row, col)}
                      </span>
                      {#if isBonus}
                        <div
                          class="absolute bottom-1 left-1 text-xs opacity-60"
                        >
                          🎯
                        </div>
                      {/if}
                      {#if isWildcard}
                        <div
                          class="absolute bottom-1 right-1 text-xs opacity-60"
                        >
                          🃏
                        </div>
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
                <div
                  class="flex items-center justify-between p-3 rounded-lg
                  {isCurrentUser
                    ? 'bg-primary/10 border border-primary/20'
                    : 'bg-muted'}"
                >
                  <div class="flex items-center gap-3">
                    <div class="text-lg font-bold min-w-[32px]">
                      {index === 0
                        ? "🥇"
                        : index === 1
                          ? "🥈"
                          : index === 2
                            ? "🥉"
                            : `#${index + 1}`}
                    </div>
                    <div>
                      <div
                        class="font-medium {isCurrentUser
                          ? 'text-primary'
                          : ''}"
                      >
                        {participant.name}
                        {#if isCurrentUser}<span class="text-xs">(You)</span
                          >{/if}
                      </div>
                      <div
                        class="flex items-center gap-1 text-xs text-muted-foreground"
                      >
                        {#if participant.isGuest}
                          <span>👤 Guest</span>
                        {:else}
                          <span>🔐 Player</span>
                        {/if}
                        <!-- Winner badges removed - leaderboard determines ranking -->
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    {#if hasPhotos(participant.id)}
                      <Button
                        variant="ghost"
                        size="sm"
                        on:click={() => handleViewPhotos(participant.id)}
                        class="text-xs px-2 py-1 h-7"
                      >
                        📸 Photos
                      </Button>
                    {/if}
                    <div class="text-right">
                      <div class="font-bold">{participant.score}</div>
                      <div class="text-xs text-muted-foreground">points</div>
                    </div>
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
                  🎯 {guestParticipant?.score ||
                    sortedParticipants[0]?.score ||
                    0}/25
                </div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-muted-foreground">
                  {guestParticipant ? "Your Rank" : "Leader"}
                </div>
                <div class="text-2xl font-bold">
                  {#if guestParticipant}
                    🏆 #{getUserRank(guestParticipant.id)}
                  {:else}
                    {@const leader = sortedParticipants[0]}
                    {leader ? `🏆 ${leader.name}` : "🏆 N/A"}
                  {/if}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-muted-foreground">
                  Total Players
                </div>
                <div class="text-2xl font-bold">
                  👥 {allParticipants.length}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-6">
              <div class="flex items-center justify-between">
                <div class="text-sm font-medium text-muted-foreground">
                  Game Status
                </div>
                <div class="text-2xl font-bold">
                  {game.status === "COMPLETED" ? "🏁 Done" : "🔴 Live"}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        </div>

        <!-- Desktop: Side by Side Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 print:block">
          <!-- Bingo Board -->
          <div class="lg:col-span-2 print:max-w-2xl print:mx-auto">
            <Card.Root class="print:border-0 print:shadow-none">
              <Card.Header class="print:hidden">
                <Card.Title>
                  {#if guestParticipant}
                    Your Bingo Board
                  {:else if game?.status === "COMPLETED"}
                    Final Board
                  {:else}
                    Bingo Board
                  {/if}
                </Card.Title>
              </Card.Header>
              <Card.Content class="print:p-0">
                <div
                  class="grid grid-cols-5 gap-3 print:gap-2 print:max-w-xl print:mx-auto bingo-board-grid"
                >
                  {#each Array(5) as _, row}
                    {#each Array(5) as _, col}
                      {@const isCompleted = isCellCompleted(row, col)}
                      {@const isCenter = isCenterCell(row, col)}
                      {@const photoUrl = getCellPhotoUrl(row, col)}
                      {@const isBonus = isBonusSquare(row, col)}
                      {@const isWildcard = isWildcardSquare(row, col)}
                      {@const cardType = getCellCardType(row, col)}
                      {@const cardTypeIcon = getCardTypeIcon(cardType)}
                      <button
                        class="aspect-square p-3 text-sm font-medium border-2 rounded-lg transition-colors hover:scale-105 relative overflow-hidden flex flex-col items-center justify-center
                          {isCompleted
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'}
                          {isCenter ? 'bg-muted' : ''}
                          {isBonus
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-950'
                          : ''}
                          {isWildcard
                          ? 'border-purple-400 bg-purple-50 dark:bg-purple-950'
                          : ''}
                          {game?.status === 'COMPLETED'
                          ? 'cursor-not-allowed opacity-75'
                          : ''}"
                        on:click={() => handleCellClick(row * 5 + col)}
                        disabled={isCenter}
                      >
                        <!-- Card Type Icon in top left -->
                        {#if !isCenter}
                          <div
                            class="absolute top-2 left-2 text-lg font-black z-20 {isCompleted
                              ? 'text-yellow-300 opacity-100 drop-shadow-[0_2px_4px_rgba(0,0,0,1)] filter brightness-125'
                              : 'text-gray-600 opacity-80'}"
                          >
                            {cardTypeIcon}
                          </div>
                        {/if}

                        {#if photoUrl}
                          <img
                            src={photoUrl}
                            alt="Proof photo"
                            class="absolute inset-0 w-full h-full object-cover rounded-md"
                          />
                          <div
                            class="absolute inset-0 bg-black bg-opacity-30 rounded-md"
                          ></div>
                          <span
                            class="relative z-10 text-white text-shadow font-bold leading-tight text-center {!isCenter
                              ? 'mt-4'
                              : ''}"
                          >
                            {getCellContent(row, col)}
                          </span>
                          {#if isCompleted}
                            <div
                              class="absolute top-2 right-2 text-white text-lg"
                            >
                              ✓
                            </div>
                          {/if}
                          {#if isBonus}
                            <div class="absolute bottom-2 left-2 text-sm">
                              🎯
                            </div>
                          {/if}
                          {#if isWildcard}
                            <div class="absolute bottom-2 right-2 text-sm">
                              🃏
                            </div>
                          {/if}
                        {:else}
                          <span
                            class="block leading-tight text-center {!isCenter
                              ? 'mt-4'
                              : ''}"
                          >
                            {getCellContent(row, col)}
                          </span>
                          {#if isBonus}
                            <div
                              class="absolute bottom-2 left-2 text-sm opacity-60"
                            >
                              🎯
                            </div>
                          {/if}
                          {#if isWildcard}
                            <div
                              class="absolute bottom-2 right-2 text-sm opacity-60"
                            >
                              🃏
                            </div>
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
          <div class="print:hidden">
            <Card.Root>
              <Card.Header>
                <Card.Title>Leaderboard</Card.Title>
              </Card.Header>
              <Card.Content>
                <div class="space-y-3">
                  {#each sortedParticipants as participant, index}
                    {@const isCurrentUser =
                      participant.id === guestParticipant?.id}
                    <div
                      class="flex items-center justify-between p-3 rounded-lg
                      {isCurrentUser
                        ? 'bg-primary/10 border border-primary/20'
                        : 'bg-muted'}"
                    >
                      <div class="flex items-center gap-3">
                        <div class="text-lg font-bold min-w-[32px]">
                          {index === 0
                            ? "🥇"
                            : index === 1
                              ? "🥈"
                              : index === 2
                                ? "🥉"
                                : `#${index + 1}`}
                        </div>
                        <div>
                          <div
                            class="font-medium {isCurrentUser
                              ? 'text-primary'
                              : ''}"
                          >
                            {participant.name}
                            {#if isCurrentUser}<span class="text-xs">(You)</span
                              >{/if}
                          </div>
                          <div
                            class="flex items-center gap-1 text-xs text-muted-foreground"
                          >
                            {#if participant.isGuest}
                              <span>👤 Guest</span>
                            {:else}
                              <span>🔐 Player</span>
                            {/if}
                            <!-- Winner badges removed - leaderboard determines ranking -->
                          </div>
                        </div>
                      </div>
                      <div class="flex items-center gap-3">
                        {#if hasPhotos(participant.id)}
                          <Button
                            variant="outline"
                            size="sm"
                            on:click={() => handleViewPhotos(participant.id)}
                            class="text-xs"
                          >
                            📸 View Pictures
                          </Button>
                        {/if}
                        <div class="text-right">
                          <div class="font-bold">{participant.score}</div>
                          <div class="text-xs text-muted-foreground">
                            points
                          </div>
                        </div>
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
    <div class="print:hidden">
      <CameraCapture
        bind:open={showCameraModal}
        cellText={selectedCellText}
        on:photo={handlePhotoTaken}
        on:cancel={handleCameraCancel}
      />
    </div>

    <!-- Photo View Modal -->
    <div class="print:hidden">
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
                <div
                  class="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"
                ></div>
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
                <div
                  class="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"
                ></div>
              {/if}
              ❌ Unselect Square
            </Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </div>

    {#if photoUploading}
      <div
        class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 print:hidden"
      >
        <div class="bg-white p-6 rounded-lg shadow-lg">
          <div class="flex items-center gap-4">
            <div
              class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
            ></div>
            <span class="text-lg">Uploading photo...</span>
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  @media print {
    /* Reset everything for print */
    * {
      transition: none !important;
      animation: none !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }

    /* Show print content */
    .print-only-content {
      display: block !important;
      text-align: center;
      margin-bottom: 20px;
    }

    .print-title {
      font-size: 28px !important;
      font-weight: bold !important;
      margin-bottom: 8px !important;
      color: black !important;
    }

    .print-player-name {
      font-size: 20px !important;
      font-weight: 600 !important;
      color: black !important;
      margin-bottom: 16px !important;
    }

    /* Simple print bingo board */
    .simple-print-bingo {
      display: grid !important;
      grid-template-columns: repeat(5, 1fr) !important;
      gap: 2px !important;
      width: 500px !important;
      height: 500px !important;
      margin: 20px auto !important;
      border: 2px solid black !important;
    }

    .simple-cell {
      border: 1px solid black !important;
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      text-align: center !important;
      padding: 2px !important;
      background: white !important;
      color: black !important;
      position: relative !important;
    }

    .card-type-emoji {
      position: absolute !important;
      top: 2px !important;
      left: 2px !important;
      font-size: 10px !important;
      line-height: 1 !important;
    }

    .bonus-emoji {
      position: absolute !important;
      bottom: 2px !important;
      left: 2px !important;
      font-size: 10px !important;
      line-height: 1 !important;
    }

    .wildcard-emoji {
      position: absolute !important;
      bottom: 2px !important;
      right: 2px !important;
      font-size: 10px !important;
      line-height: 1 !important;
    }

    .cell-content {
      font-size: 9px !important;
      line-height: 1.1 !important;
      text-align: center !important;
      word-break: break-word !important;
      hyphens: auto !important;
      margin-top: 8px !important;
    }

    .simple-cell.completed {
      background: #d0d0d0 !important;
    }

    .simple-cell.center {
      background: #f0f0f0 !important;
      font-weight: bold !important;
    }

    /* Page break */
    .print-page-break {
      page-break-before: always !important;
      break-before: page !important;
    }

    /* Scoring rules page */
    .print-scoring-page {
      padding: 20px !important;
      max-width: 600px !important;
      margin: 0 auto !important;
    }

    .print-scoring-title {
      font-size: 24px !important;
      font-weight: bold !important;
      text-align: center !important;
      margin-bottom: 8px !important;
      color: black !important;
    }

    .print-scoring-subtitle {
      font-size: 14px !important;
      text-align: center !important;
      margin-bottom: 20px !important;
      color: #666 !important;
    }

    .print-scoring-section {
      margin-bottom: 20px !important;
    }

    .print-section-title {
      font-size: 16px !important;
      font-weight: bold !important;
      margin-bottom: 10px !important;
      color: black !important;
      border-bottom: 1px solid #ccc !important;
      padding-bottom: 4px !important;
    }

    .print-rule-item {
      display: flex !important;
      justify-content: space-between !important;
      align-items: flex-start !important;
      margin-bottom: 8px !important;
      padding: 6px !important;
      border: 1px solid #ddd !important;
      border-radius: 4px !important;
    }

    .print-bonus-rule {
      background: #f0f8ff !important;
      border-color: #87ceeb !important;
    }

    .print-wildcard-rule {
      background: #f8f0ff !important;
      border-color: #dda0dd !important;
    }

    .print-rule-name {
      font-weight: 600 !important;
      font-size: 12px !important;
      flex: 1 !important;
      color: black !important;
    }

    .print-rule-points {
      font-weight: bold !important;
      font-size: 12px !important;
      color: #0066cc !important;
      min-width: 80px !important;
      text-align: right !important;
      margin: 0 10px !important;
    }

    .print-rule-desc {
      font-size: 10px !important;
      color: #666 !important;
      flex: 1 !important;
      text-align: right !important;
    }

    .print-tip {
      background: #fffbf0 !important;
      border: 1px solid #ffd700 !important;
      padding: 10px !important;
      border-radius: 4px !important;
      font-size: 11px !important;
      margin: 20px 0 !important;
    }

    .print-legend {
      margin-top: 20px !important;
    }

    .print-legend-grid {
      display: grid !important;
      gap: 8px !important;
    }

    .print-legend-item {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      font-size: 11px !important;
    }

    .print-legend-emoji {
      font-size: 14px !important;
      width: 20px !important;
      text-align: center !important;
    }

    .print-legend-text {
      color: black !important;
    }
  }
</style>

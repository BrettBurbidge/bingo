<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { user } from "$lib/auth";
  import {
    getGame,
    updateParticipantScore,
    inviteUserToGame,
    joinGame,
    getGameInvites,
    deleteGameInvite,
    resendGameInvite,
    publishGame,
    unpublishGame,
    cloneGame,
    type GameInviteWithRelations,
  } from "$lib/client-games";
  import {
    inviteGameMaster,
    getGameMasterData,
    isUserGameCreatorOrMaster,
    resendGameMasterInvite,
    deleteGameMasterInvite,
    type GameMasterData,
    type GameMaster,
  } from "$lib/game-masters";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Badge } from "$lib/components/ui/badge";
  import { Separator } from "$lib/components/ui/separator";
  import * as Table from "$lib/components/ui/table";
  import type {
    Game,
    GameParticipant,
    Profile,
    GameInvite,
    GuestParticipant,
  } from "@prisma/client";

  type GameWithRelations = Game & {
    gameMaster: Profile;
    winner?: Profile | null;
    participants: (GameParticipant & { user: Profile })[];
    guestParticipants?: GuestParticipant[];
  };

  type AllParticipants = {
    id: string;
    name: string;
    score: number;
    hasWon: boolean;
    isGuest: boolean;
  };

  type GameParticipantWithUser = GameParticipant & { user: Profile };

  let game: GameWithRelations | null = null;
  let participants: GameParticipantWithUser[] = [];
  let userParticipant: GameParticipantWithUser | null = null;
  let allParticipants: AllParticipants[] = [];
  let gameInvites: GameInviteWithRelations[] = [];
  let gameMasterData: GameMasterData | null = null;
  let loading = true;
  let showInviteModal = false;
  let showGameMasterInviteModal = false;
  let showInviteManagement = false;
  let inviteEmail = "";
  let gameMasterInviteEmail = "";
  let inviteLoading = false;
  let gameMasterInviteLoading = false;
  let resendingInviteId: string | null = null;
  let resendingGameMasterInviteId: string | null = null;
  let deletingGameMasterInviteId: string | null = null;
  let publishLoading = false;
  let showShareModal = false;
  let showCloneModal = false;
  let cloneGameName = "";
  let cloneLoading = false;

  $: gameId = $page.params.id;
  $: sortedParticipants = allParticipants.sort((a, b) => b.score - a.score);
  $: isGameCreator = game?.gameMasterId === $user?.id;
  $: isGameMaster = game?.gameMasterId === $user?.id; // Will update this after loading game master data
  $: isPublished = !!game?.publishedAt;

  let publicUrl = "";

  // Set public URL after mount to avoid SSR issues
  onMount(() => {
    publicUrl = `${window.location.origin}/play/${gameId}`;
  });

  onMount(async () => {
    if ($user && gameId) {
      await loadGameData();
    }
  });

  // Reactive statement to load game data when user becomes available
  $: if ($user && gameId && !game) {
    loadGameData();
  }

  // Reactive statement to load invites when game data is loaded and user is game master
  $: if (game && isGameMaster && $user) {
    loadGameInvites();
    loadGameMasterData();
  }

  async function loadGameData() {
    try {
      loading = true;
      const gameData = await getGame(gameId);

      game = gameData;
      participants = gameData.participants;
      userParticipant =
        participants.find((p) => p.userId === $user?.id) || null;

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

      const guestParticipants: AllParticipants[] = (
        gameData.guestParticipants || []
      ).map((p) => ({
        id: p.id,
        name: p.guestName || p.email.split("@")[0], // Fallback to email prefix if no display name
        score: p.score,
        hasWon: p.hasWon,
        isGuest: true,
      }));

      allParticipants = [...authParticipants, ...guestParticipants];

      // If game is in setup and user is game master, redirect to setup
      if (game.status === "SETUP" && game.gameMasterId === $user?.id) {
        goto(`/game/${gameId}/setup`);
        return;
      }

      // Auto-join is removed - admins must manually join if they want to play
    } catch (error) {
      console.error("Error loading game data:", error);
    } finally {
      loading = false;
    }
  }

  async function loadGameInvites() {
    try {
      if ($user && isGameMaster) {
        gameInvites = await getGameInvites(gameId, $user.id);
      }
    } catch (error) {
      console.error("Error loading game invites:", error);
    }
  }

  async function loadGameMasterData() {
    try {
      if ($user && isGameCreator) {
        gameMasterData = await getGameMasterData(gameId, $user.id);
      }
    } catch (error) {
      console.error("Error loading game master data:", error);
    }
  }

  async function toggleCell(cellIndex: number) {
    if (!userParticipant || !$user) return;

    // Don't allow toggling the center cell (FREE space)
    if (cellIndex === 12) return;

    const completedCells = [...userParticipant.completedCells];
    const cellIndexInCompleted = completedCells.indexOf(cellIndex);

    if (cellIndexInCompleted > -1) {
      // Remove cell
      completedCells.splice(cellIndexInCompleted, 1);
    } else {
      // Add cell
      completedCells.push(cellIndex);
    }

    try {
      await updateParticipantScore(gameId, $user.id, completedCells);
      await loadGameData();
    } catch (error) {
      console.error("Error updating score:", error);
    }
  }

  async function handleInvite() {
    if (!inviteEmail.trim() || !$user) return;

    try {
      inviteLoading = true;
      const result = (await inviteUserToGame(
        gameId,
        inviteEmail.trim(),
        $user.id
      )) as any;
      inviteEmail = "";
      showInviteModal = false;
      await loadGameInvites();

      // Show feedback about email status
      if (result.emailSent) {
        console.log("✅ Invite sent and email delivered successfully!");
        // You could show a success toast here
      } else {
        console.warn(
          "⚠️ Invite created but email failed to send:",
          result.emailError
        );
        // You could show a warning toast here
        alert(
          `Invite created but email failed to send: ${result.emailError || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error sending invite:", error);
      // Show error message to user
      alert(
        `Failed to send invite: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      inviteLoading = false;
    }
  }

  async function handleGameMasterInvite() {
    if (!gameMasterInviteEmail.trim() || !$user) return;

    try {
      gameMasterInviteLoading = true;
      const result = (await inviteGameMaster(
        gameId,
        gameMasterInviteEmail.trim(),
        $user.id
      )) as any;
      gameMasterInviteEmail = "";
      showGameMasterInviteModal = false;
      await loadGameMasterData();

      // Show feedback about email status
      if (result.emailSent) {
        console.log(
          "✅ Game master invite sent and email delivered successfully!"
        );
        alert("Game master invitation sent successfully!");
      } else {
        console.warn(
          "⚠️ Game master invite created but email failed to send:",
          result.emailError
        );
        alert(
          `Game master invite created but email failed to send: ${result.emailError || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error sending game master invite:", error);
      alert(
        `Failed to send game master invite: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      gameMasterInviteLoading = false;
    }
  }

  async function handleDeleteInvite(inviteId: string) {
    if (!$user || !isGameMaster) return;

    try {
      await deleteGameInvite(gameId, inviteId, $user.id);
      await loadGameInvites();
    } catch (error) {
      console.error("Error deleting invite:", error);
    }
  }

  async function handleResendInvite(inviteId: string) {
    if (!$user || !isGameMaster) return;

    try {
      resendingInviteId = inviteId;
      const result = await resendGameInvite(gameId, inviteId, $user.id);

      // Show feedback about email status
      if (result.emailSent) {
        console.log("✅ Invite resent successfully!");
        alert("Invite email resent successfully!");
      } else {
        console.warn("⚠️ Failed to resend email:", result.emailError);
        alert(
          `Failed to resend email: ${result.emailError || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error resending invite:", error);
      alert(
        `Failed to resend invite: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      resendingInviteId = null;
    }
  }

  async function handleResendGameMasterInvite(inviteId: string) {
    if (!$user || !isGameMaster) return;

    try {
      resendingGameMasterInviteId = inviteId;
      const result = await resendGameMasterInvite(inviteId, $user.id);

      // Show feedback about email status
      if (result.emailSent) {
        console.log("✅ Game master invite resent successfully!");
        alert("Game master invitation email resent successfully!");
      } else {
        console.warn(
          "⚠️ Failed to resend game master email:",
          result.emailError
        );
        alert(
          `Failed to resend game master email: ${result.emailError || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error resending game master invite:", error);
      alert(
        `Failed to resend game master invite: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      resendingGameMasterInviteId = null;
    }
  }

  async function handleDeleteGameMasterInvite(inviteId: string) {
    if (!$user || !isGameMaster) return;

    if (
      !confirm("Are you sure you want to delete this game master invitation?")
    ) {
      return;
    }

    try {
      deletingGameMasterInviteId = inviteId;
      await deleteGameMasterInvite(inviteId, $user.id);

      // Reload the game master data to refresh the list
      await loadGameMasterData();

      console.log("✅ Game master invite deleted successfully!");
      alert("Game master invitation deleted successfully!");
    } catch (error) {
      console.error("Error deleting game master invite:", error);
      alert(
        `Failed to delete game master invite: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      deletingGameMasterInviteId = null;
    }
  }

  async function handlePublish() {
    if (!$user || !isGameMaster) return;

    try {
      publishLoading = true;
      await publishGame(gameId, $user.id);
      await loadGameData();
      showShareModal = true;
    } catch (error) {
      console.error("Error publishing game:", error);
      alert(
        `Failed to publish game: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      publishLoading = false;
    }
  }

  async function handleUnpublish() {
    if (!$user || !isGameMaster) return;

    try {
      publishLoading = true;
      await unpublishGame(gameId, $user.id);
      await loadGameData();
    } catch (error) {
      console.error("Error unpublishing game:", error);
      alert(
        `Failed to unpublish game: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      publishLoading = false;
    }
  }

  function copyPublicUrl() {
    navigator.clipboard
      .writeText(publicUrl)
      .then(() => {
        alert("Link copied to clipboard!");
      })
      .catch(() => {
        alert("Failed to copy link. Please copy manually: " + publicUrl);
      });
  }

  function getCellContent(row: number, col: number): string {
    if (!userParticipant?.boardData) return "";
    const cellIndex = row * 5 + col;
    return userParticipant.boardData[cellIndex] || "";
  }

  function getCellCardType(row: number, col: number): string {
    if (!userParticipant?.cardTypeData) return "see";
    const cellIndex = row * 5 + col;
    return userParticipant.cardTypeData[cellIndex] || "see";
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
    if (!userParticipant) return false;
    const cellIndex = row * 5 + col;
    return userParticipant.completedCells.includes(cellIndex);
  }

  function isCenterCell(row: number, col: number): boolean {
    return row === 2 && col === 2;
  }

  function getUserRank(userId: string): number {
    return sortedParticipants.findIndex((p) => p.id === userId) + 1;
  }

  async function handleCloneGame() {
    if (!$user || !cloneGameName.trim()) return;

    try {
      cloneLoading = true;
      const result = await cloneGame(gameId, $user.id, cloneGameName.trim());

      // Close modal and reset
      showCloneModal = false;
      cloneGameName = "";

      // Navigate to setup page for the new game
      alert(result.message);
      goto(`/game/${result.game.id}/setup`);
    } catch (error) {
      console.error("Error cloning game:", error);
      alert(
        `Failed to clone game: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      cloneLoading = false;
    }
  }
</script>

<svelte:head>
  <title>{game?.name || "Game"} - Bingo</title>
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
    <div class="space-y-4">
      <!-- Mobile Header -->
      <div class="lg:hidden">
        <div class="text-center space-y-2">
          <h1 class="text-2xl font-bold tracking-tight">{game.name}</h1>
          <div class="flex items-center justify-center gap-2">
            <Badge
              variant={game.status === "ACTIVE"
                ? "default"
                : game.status === "COMPLETED"
                  ? "secondary"
                  : "outline"}
            >
              {game.status}
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground">
            GM: {game.gameMaster.displayName || game.gameMaster.email}
          </p>
        </div>
        <div class="flex flex-col gap-2 mt-4">
          {#if isGameCreator && game.status === "ACTIVE"}
            <Button
              on:click={() => (showGameMasterInviteModal = true)}
              size="sm"
              class="w-full"
            >
              👑 Invite Game Masters
            </Button>
          {/if}

          <!-- Edit button for game masters on active/completed games -->
          {#if isGameCreator && (game.status === "ACTIVE" || game.status === "COMPLETED")}
            <Button
              href="/game/{gameId}/setup?edit=true"
              variant="outline"
              size="sm"
              class="w-full"
            >
              ✏️ Edit Game
            </Button>
          {/if}

          {#if isGameCreator && game.status === "ACTIVE"}
            {#if isPublished}
              <Button
                on:click={() => (showShareModal = true)}
                size="sm"
                class="w-full"
              >
                🔗 Share Game
              </Button>
              <Button
                on:click={handleUnpublish}
                disabled={publishLoading}
                variant="outline"
                size="sm"
                class="w-full"
              >
                {#if publishLoading}
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"
                  ></div>
                {/if}
                🔒 Make Private
              </Button>
            {:else}
              <Button
                on:click={handlePublish}
                disabled={publishLoading}
                size="sm"
                class="w-full"
              >
                {#if publishLoading}
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                  ></div>
                {/if}
                🌐 Publish Game
              </Button>
            {/if}
          {/if}

          <!-- Clone button for any game participant -->
          {#if game.wordList && game.wordList.length > 0}
            <Button
              on:click={() => (showCloneModal = true)}
              variant="outline"
              size="sm"
              class="w-full"
            >
              📋 Clone Game
            </Button>
          {/if}

          <Button variant="outline" href="/dashboard" size="sm" class="w-full">
            ← Back to Dashboard
          </Button>
        </div>
      </div>

      <!-- Desktop Header -->
      <div
        class="hidden lg:flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
      >
        <div>
          <h1 class="text-3xl font-bold tracking-tight">{game.name}</h1>
          <div class="flex items-center gap-2">
            <p class="text-muted-foreground">
              Game Master: {game.gameMaster.displayName ||
                game.gameMaster.email}
            </p>
            <Badge
              variant={game.status === "ACTIVE"
                ? "default"
                : game.status === "COMPLETED"
                  ? "secondary"
                  : "outline"}
            >
              {game.status}
            </Badge>
          </div>
        </div>
        <div class="flex gap-2">
          {#if isGameCreator && game.status === "ACTIVE"}
            <Button on:click={() => (showGameMasterInviteModal = true)}>
              👑 Invite Game Masters
            </Button>
          {/if}

          <!-- Edit button for game masters on active/completed games -->
          {#if isGameCreator && (game.status === "ACTIVE" || game.status === "COMPLETED")}
            <Button href="/game/{gameId}/setup?edit=true" variant="outline">
              ✏️ Edit Game
            </Button>
          {/if}

          {#if isGameCreator && game.status === "ACTIVE"}
            {#if isPublished}
              <Button on:click={() => (showShareModal = true)}>
                🔗 Share Game
              </Button>
              <Button
                on:click={handleUnpublish}
                disabled={publishLoading}
                variant="outline"
              >
                {#if publishLoading}
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"
                  ></div>
                {/if}
                🔒 Make Private
              </Button>
            {:else}
              <Button on:click={handlePublish} disabled={publishLoading}>
                {#if publishLoading}
                  <div
                    class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                  ></div>
                {/if}
                🌐 Publish Game
              </Button>
            {/if}
          {/if}

          <!-- Clone button for any game participant -->
          {#if game.wordList && game.wordList.length > 0}
            <Button on:click={() => (showCloneModal = true)} variant="outline">
              📋 Clone Game
            </Button>
          {/if}

          <Button variant="outline" href="/dashboard">Back to Dashboard</Button>
        </div>
      </div>
    </div>

    <!-- Winner Announcement -->
    <!-- Winner banner removed - games now use leaderboard-based scoring -->

    <!-- Mobile: Bingo Board First -->
    <div class="lg:hidden">
      {#if userParticipant}
        <!-- Mobile Stats Bar -->
        <div class="grid grid-cols-2 gap-2 mb-6">
          <Card.Root>
            <Card.Content class="pt-4 pb-3">
              <div class="flex items-center justify-between">
                <div class="text-sm text-muted-foreground">Score</div>
                <div class="text-xl font-bold">
                  🎯 {userParticipant.score}/25
                </div>
              </div>
            </Card.Content>
          </Card.Root>
          <Card.Root>
            <Card.Content class="pt-4 pb-3">
              <div class="flex items-center justify-between">
                <div class="text-sm text-muted-foreground">Rank</div>
                <div class="text-xl font-bold">
                  🏆 #{getUserRank(userParticipant.id)}
                </div>
              </div>
            </Card.Content>
          </Card.Root>
        </div>

        <!-- Mobile Bingo Board -->
        <Card.Root class="mb-6">
          <Card.Header class="pb-4">
            <Card.Title class="text-lg">Your Bingo Board</Card.Title>
            <Card.Description class="text-sm">
              Tap cells to mark them complete
            </Card.Description>
          </Card.Header>
          <Card.Content>
            <div class="grid grid-cols-5 gap-1.5 max-w-xs mx-auto">
              {#each Array(5) as _, row}
                {#each Array(5) as _, col}
                  {@const cellIndex = row * 5 + col}
                  {@const isCompleted = isCellCompleted(row, col)}
                  {@const isCenter = isCenterCell(row, col)}
                  {@const content = getCellContent(row, col)}
                  {@const cardType = getCellCardType(row, col)}
                  {@const cardTypeIcon = getCardTypeIcon(cardType)}

                  <button
                    class="border-2 p-1 text-[10px] font-medium rounded-lg transition-all duration-200 flex items-center justify-center text-center leading-tight min-h-[70px] active:scale-95 relative
                      {isCompleted || isCenter
                      ? 'bg-primary text-primary-foreground border-primary shadow-md'
                      : 'bg-card border-border active:bg-accent'}"
                    on:click={() => toggleCell(cellIndex)}
                    disabled={isCenter}
                  >
                    <!-- Card Type Icon in top left -->
                    {#if !isCenter}
                      <div
                        class="absolute top-1 left-1 text-[8px] {isCompleted
                          ? 'opacity-90 text-white drop-shadow-sm'
                          : 'opacity-70'}"
                      >
                        {cardTypeIcon}
                      </div>
                    {/if}

                    <!-- Main content -->
                    <span
                      class="break-words hyphens-auto text-center leading-tight max-w-full {!isCenter
                        ? 'mt-2'
                        : ''}"
                    >
                      {content}
                    </span>

                    {#if isCenter}
                      <div
                        class="absolute inset-0 flex items-center justify-center"
                      >
                        <Badge variant="secondary" class="text-xs px-1 py-0"
                          >FREE</Badge
                        >
                      </div>
                    {/if}
                  </button>
                {/each}
              {/each}
            </div>
          </Card.Content>
        </Card.Root>
      {/if}
    </div>

    <!-- Desktop: Original Layout -->
    <div class="hidden lg:block">
      {#if userParticipant}
        <!-- Desktop User Stats -->
        <div class="grid gap-4 md:grid-cols-4 mb-8">
          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium">Your Score</Card.Title>
              <div class="h-4 w-4 text-muted-foreground">🎯</div>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">{userParticipant.score}/25</div>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium">Your Rank</Card.Title>
              <div class="h-4 w-4 text-muted-foreground">🏆</div>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">
                #{getUserRank(userParticipant.userId)}
              </div>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium">Total Players</Card.Title>
              <div class="h-4 w-4 text-muted-foreground">👥</div>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">{participants.length}</div>
            </Card.Content>
          </Card.Root>

          <Card.Root>
            <Card.Header
              class="flex flex-row items-center justify-between space-y-0 pb-2"
            >
              <Card.Title class="text-sm font-medium">Progress</Card.Title>
              <div class="h-4 w-4 text-muted-foreground">📊</div>
            </Card.Header>
            <Card.Content>
              <div class="text-2xl font-bold">
                {Math.round((userParticipant.score / 25) * 100)}%
              </div>
            </Card.Content>
          </Card.Root>
        </div>
      {/if}

      <!-- Desktop Two Column Layout -->
      <div class="grid lg:grid-cols-2 gap-8">
        <!-- Desktop Bingo Board -->
        <div class="space-y-6">
          <Card.Root>
            <Card.Header>
              <Card.Title>Your Bingo Board</Card.Title>
              <Card.Description>
                Click cells to mark them as completed. The center square is
                always FREE!
              </Card.Description>
            </Card.Header>
            <Card.Content>
              {#if userParticipant}
                <div class="grid grid-cols-5 gap-2 max-w-md mx-auto">
                  {#each Array(5) as _, row}
                    {#each Array(5) as _, col}
                      {@const cellIndex = row * 5 + col}
                      {@const isCompleted = isCellCompleted(row, col)}
                      {@const isCenter = isCenterCell(row, col)}
                      {@const content = getCellContent(row, col)}
                      {@const cardType = getCellCardType(row, col)}
                      {@const cardTypeIcon = getCardTypeIcon(cardType)}

                      <button
                        class="border-2 p-1 text-[10px] font-medium rounded-lg transition-all duration-200 flex items-center justify-center text-center leading-tight min-h-[70px] active:scale-95 relative
                          {isCompleted || isCenter
                          ? 'bg-primary text-primary-foreground border-primary shadow-md'
                          : 'bg-card border-border active:bg-accent'}"
                        on:click={() => toggleCell(cellIndex)}
                        disabled={isCenter}
                      >
                        <!-- Card Type Icon in top left -->
                        {#if !isCenter}
                          <div
                            class="absolute top-1 left-1 text-[8px] {isCompleted
                              ? 'opacity-90 text-white drop-shadow-sm'
                              : 'opacity-70'}"
                          >
                            {cardTypeIcon}
                          </div>
                        {/if}

                        <!-- Main content -->
                        <span
                          class="break-words hyphens-auto text-center leading-tight max-w-full {!isCenter
                            ? 'mt-2'
                            : ''}"
                        >
                          {content}
                        </span>

                        {#if isCenter}
                          <div
                            class="absolute inset-0 flex items-center justify-center"
                          >
                            <Badge variant="secondary" class="text-xs px-1 py-0"
                              >FREE</Badge
                            >
                          </div>
                        {/if}
                      </button>
                    {/each}
                  {/each}
                </div>
              {:else}
                <div class="text-center py-8">
                  <div class="mx-auto h-12 w-12 mb-4 text-4xl">🚫</div>
                  <h3 class="text-lg font-semibold mb-2">Not a participant</h3>
                  <p class="text-muted-foreground mb-4">
                    You're not a participant in this game.
                  </p>
                  <Button href="/dashboard">Back to Dashboard</Button>
                </div>
              {/if}
            </Card.Content>
          </Card.Root>
        </div>

        <!-- Desktop Leaderboard -->
        <div class="space-y-6">
          <Card.Root>
            <Card.Header>
              <Card.Title>Leaderboard</Card.Title>
              <Card.Description
                >See how you stack up against other players</Card.Description
              >
            </Card.Header>
            <Card.Content>
              <Table.Root>
                <Table.Header>
                  <Table.Row>
                    <Table.Head class="w-12">Rank</Table.Head>
                    <Table.Head>Player</Table.Head>
                    <Table.Head class="text-right">Score</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {#each sortedParticipants as participant, index}
                    {@const isCurrentUser =
                      !participant.isGuest &&
                      userParticipant?.id === participant.id}
                    <Table.Row class={isCurrentUser ? "bg-accent/50" : ""}>
                      <Table.Cell class="font-medium">
                        <div class="flex items-center gap-2">
                          #{index + 1}
                          {#if index === 0}
                            <span class="text-yellow-500">🏆</span>
                          {:else if index === 1}
                            <span class="text-gray-400">🥈</span>
                          {:else if index === 2}
                            <span class="text-amber-600">🥉</span>
                          {/if}
                        </div>
                      </Table.Cell>
                      <Table.Cell>
                        <div class="flex items-center gap-2">
                          {participant.name}
                          {#if isCurrentUser}
                            <Badge variant="secondary" class="text-xs"
                              >You</Badge
                            >
                          {/if}
                          {#if participant.isGuest}
                            <Badge variant="outline" class="text-xs"
                              >Guest</Badge
                            >
                          {/if}
                          <!-- Winner badges removed - leaderboard determines ranking -->
                        </div>
                      </Table.Cell>
                      <Table.Cell class="text-right font-medium"
                        >{participant.score}/25</Table.Cell
                      >
                    </Table.Row>
                  {/each}
                </Table.Body>
              </Table.Root>
            </Card.Content>
          </Card.Root>
        </div>
      </div>
    </div>

    <!-- Mobile Leaderboard (Compact) -->
    <div class="lg:hidden">
      <Card.Root>
        <Card.Header>
          <Card.Title class="text-lg">Leaderboard</Card.Title>
          <Card.Description class="text-sm">Current standings</Card.Description>
        </Card.Header>
        <Card.Content>
          <div class="space-y-3">
            {#each sortedParticipants as participant, index}
              {@const isCurrentUser =
                !participant.isGuest && userParticipant?.id === participant.id}
              <div
                class="flex items-center justify-between p-3 rounded-lg {isCurrentUser
                  ? 'bg-accent/50'
                  : 'bg-muted/30'}"
              >
                <div class="flex items-center gap-3">
                  <div class="flex items-center gap-1">
                    <span class="font-semibold">#{index + 1}</span>
                    {#if index === 0}
                      <span class="text-yellow-500">🏆</span>
                    {:else if index === 1}
                      <span class="text-gray-400">🥈</span>
                    {:else if index === 2}
                      <span class="text-amber-600">🥉</span>
                    {/if}
                  </div>
                  <div>
                    <div class="font-medium text-sm">
                      {participant.name}
                    </div>
                    <div class="flex items-center gap-1">
                      {#if isCurrentUser}
                        <Badge variant="secondary" class="text-xs">You</Badge>
                      {/if}
                      {#if participant.isGuest}
                        <Badge variant="outline" class="text-xs">Guest</Badge>
                      {/if}
                      <!-- Winner badges removed - leaderboard determines ranking -->
                    </div>
                  </div>
                </div>
                <div class="text-lg font-bold">{participant.score}/25</div>
              </div>
            {/each}
          </div>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Game Master Management (Game Creator Only) -->
    {#if isGameCreator && gameMasterData}
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-semibold tracking-tight">Game Masters</h2>
            <p class="text-muted-foreground">
              Manage who can help administer this game
            </p>
          </div>
          <Button on:click={() => (showGameMasterInviteModal = true)} size="sm">
            👑 Invite Game Master
          </Button>
        </div>

        <!-- Current Game Masters -->
        {#if gameMasterData.gameMasters.length > 0}
          <Card.Root>
            <Card.Header>
              <Card.Title>Current Game Masters</Card.Title>
              <Card.Description>Users who can manage this game</Card.Description
              >
            </Card.Header>
            <Card.Content>
              <div class="space-y-3">
                <!-- Original Game Creator -->
                <div
                  class="flex items-center justify-between p-3 rounded-lg bg-primary/5"
                >
                  <div>
                    <div class="font-medium">
                      {game?.gameMaster.displayName || game?.gameMaster.email}
                    </div>
                    <div class="text-sm text-muted-foreground">
                      Game Creator
                    </div>
                  </div>
                  <Badge variant="default">Owner</Badge>
                </div>

                <!-- Additional Game Masters -->
                {#each gameMasterData.gameMasters as gameMaster}
                  <div
                    class="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div>
                      <div class="font-medium">
                        {gameMaster.user.displayName || gameMaster.user.email}
                      </div>
                      <div class="text-sm text-muted-foreground">
                        Added {new Date(
                          gameMaster.createdAt
                        ).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge variant="secondary">Game Master</Badge>
                  </div>
                {/each}
              </div>
            </Card.Content>
          </Card.Root>
        {/if}

        <!-- Pending Game Master Invites -->
        {#if gameMasterData.invites.length > 0}
          <Card.Root>
            <Card.Header>
              <Card.Title>Pending Invitations</Card.Title>
              <Card.Description
                >Game master invites awaiting response</Card.Description
              >
            </Card.Header>
            <Card.Content>
              <div class="space-y-3">
                {#each gameMasterData.invites as invite}
                  <div
                    class="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div class="flex-1">
                      <div class="font-medium">{invite.email}</div>
                      <div class="text-sm text-muted-foreground">
                        Invited {new Date(
                          invite.createdAt
                        ).toLocaleDateString()}
                        {#if invite.status === "PENDING"}
                          • Expires {new Date(
                            invite.expiresAt
                          ).toLocaleDateString()}
                          <br />
                          <span class="text-xs"
                            >Click "Resend" to send another email reminder</span
                          >
                        {/if}
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <Badge
                        variant={invite.status === "PENDING"
                          ? "secondary"
                          : invite.status === "ACCEPTED"
                            ? "default"
                            : "destructive"}
                      >
                        {invite.status}
                      </Badge>
                      {#if invite.status === "PENDING"}
                        <div class="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            on:click={() =>
                              handleResendGameMasterInvite(invite.id)}
                            disabled={resendingGameMasterInviteId ===
                              invite.id ||
                              deletingGameMasterInviteId === invite.id}
                            class="text-orange-600 hover:text-orange-700"
                          >
                            {resendingGameMasterInviteId === invite.id
                              ? "Resending..."
                              : "👑 Resend"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            on:click={() =>
                              handleDeleteGameMasterInvite(invite.id)}
                            disabled={deletingGameMasterInviteId ===
                              invite.id ||
                              resendingGameMasterInviteId === invite.id}
                            class="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            {deletingGameMasterInviteId === invite.id
                              ? "Deleting..."
                              : "🗑️ Delete"}
                          </Button>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            </Card.Content>
          </Card.Root>
        {/if}
      </div>
    {/if}

    <!-- Invite Management (Game Master Only) -->
    {#if isGameMaster && gameInvites.length > 0}
      <div class="space-y-6">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-2xl font-semibold tracking-tight">
              Player Invites
            </h2>
            <p class="text-muted-foreground">
              You have sent {gameInvites.length} player invitation{gameInvites.length ===
              1
                ? ""
                : "s"} for this game
            </p>
          </div>
          {#if game?.status === "ACTIVE"}
            <Button on:click={() => (showInviteModal = true)} size="sm">
              Send Another Invite
            </Button>
          {/if}
        </div>

        <div class="grid gap-4">
          {#each gameInvites as invite}
            <Card.Root>
              <Card.Header>
                <div class="flex items-center justify-between">
                  <div>
                    <Card.Title class="text-lg">{invite.email}</Card.Title>
                    <Card.Description>
                      {#if invite.user}
                        {invite.user.displayName || invite.user.email} (registered)
                      {:else}
                        Unregistered user
                      {/if}
                    </Card.Description>
                  </div>
                  <div class="flex items-center gap-2">
                    <Badge
                      variant={invite.status === "PENDING"
                        ? "secondary"
                        : invite.status === "ACCEPTED"
                          ? "default"
                          : "destructive"}
                    >
                      {invite.status}
                    </Badge>
                    {#if invite.status === "PENDING"}
                      <Button
                        variant="outline"
                        size="sm"
                        on:click={() => handleResendInvite(invite.id)}
                        disabled={resendingInviteId === invite.id}
                        class="text-blue-600 hover:text-blue-700"
                      >
                        {resendingInviteId === invite.id
                          ? "Resending..."
                          : "📧 Resend"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        on:click={() => handleDeleteInvite(invite.id)}
                        class="text-destructive hover:text-destructive"
                      >
                        Cancel
                      </Button>
                    {/if}
                  </div>
                </div>
              </Card.Header>
              <Card.Content>
                <div class="flex items-center justify-between">
                  <div class="text-sm text-muted-foreground">
                    <p>
                      Sent: {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                    {#if invite.status === "PENDING"}
                      <p>
                        Expires: {new Date(
                          invite.expiresAt
                        ).toLocaleDateString()}
                      </p>
                      <p class="text-xs">
                        Click "Resend" to send another email reminder
                      </p>
                    {/if}
                  </div>
                  {#if invite.status === "PENDING"}
                    <div class="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        on:click={() => handleResendInvite(invite.id)}
                        disabled={resendingInviteId === invite.id}
                        class="text-blue-600 hover:text-blue-700"
                      >
                        {resendingInviteId === invite.id
                          ? "Resending..."
                          : "📧 Resend"}
                      </Button>
                    </div>
                  {/if}
                </div>
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Game Master Invite Dialog -->
    <Dialog.Root bind:open={showGameMasterInviteModal}>
      <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>👑 Invite Game Master</Dialog.Title>
          <Dialog.Description>
            Invite another user to help manage "{game?.name}". Game masters can
            publish/unpublish games and invite other game masters.
          </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
          <div class="space-y-2">
            <Label for="gameMasterInviteEmail">Email Address</Label>
            <Input
              id="gameMasterInviteEmail"
              bind:value={gameMasterInviteEmail}
              placeholder="admin@example.com"
              type="email"
            />
          </div>
          <div
            class="p-3 bg-orange-50 dark:bg-orange-950/50 rounded-lg border border-orange-200 dark:border-orange-800"
          >
            <p class="text-sm text-orange-800 dark:text-orange-200">
              ⚠️ Game masters have the same permissions as you, including the
              ability to invite other game masters.
            </p>
          </div>
        </div>
        <Dialog.Footer>
          <Button
            variant="outline"
            on:click={() => {
              showGameMasterInviteModal = false;
              gameMasterInviteEmail = "";
            }}
          >
            Cancel
          </Button>
          <Button
            on:click={handleGameMasterInvite}
            disabled={!gameMasterInviteEmail.trim() || gameMasterInviteLoading}
          >
            {gameMasterInviteLoading ? "Sending..." : "Send Invite"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Invite Dialog -->
    <Dialog.Root bind:open={showInviteModal}>
      <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>Invite Players</Dialog.Title>
          <Dialog.Description>
            Invite friends to join "{game?.name}" by entering their email
            address.
          </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
          <div class="space-y-2">
            <Label for="inviteEmail">Email Address</Label>
            <Input
              id="inviteEmail"
              bind:value={inviteEmail}
              placeholder="friend@example.com"
              type="email"
            />
          </div>
        </div>
        <Dialog.Footer>
          <Button
            variant="outline"
            on:click={() => {
              showInviteModal = false;
              inviteEmail = "";
            }}
          >
            Cancel
          </Button>
          <Button
            on:click={handleInvite}
            disabled={!inviteEmail.trim() || inviteLoading}
          >
            {inviteLoading ? "Sending..." : "Send Invite"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Share Game Dialog -->
    <Dialog.Root bind:open={showShareModal}>
      <Dialog.Content class="sm:max-w-[500px]">
        <Dialog.Header>
          <Dialog.Title>🌐 Share Your Game</Dialog.Title>
          <Dialog.Description>
            Your game "{game?.name}" is now public! Anyone with this link can
            join and play without creating an account.
          </Dialog.Description>
        </Dialog.Header>
        <div class="space-y-4">
          <div class="space-y-2">
            <Label>Public Game Link</Label>
            <div class="flex gap-2">
              <Input value={publicUrl} readonly class="font-mono text-sm" />
              <Button on:click={copyPublicUrl} variant="outline">
                📋 Copy
              </Button>
            </div>
          </div>
          <div
            class="p-4 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <h4 class="font-medium text-blue-900 dark:text-blue-100 mb-2">
              How it works:
            </h4>
            <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>
                • Anyone can visit this link and join with just their name
              </li>
              <li>• Names must be unique in your game</li>
              <li>• No signup or passwords required for guests</li>
              <li>• You keep full control as the game master</li>
            </ul>
          </div>
        </div>
        <Dialog.Footer>
          <Button variant="outline" on:click={() => (showShareModal = false)}>
            Close
          </Button>
          <Button on:click={copyPublicUrl}>📋 Copy Link</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Clone Game Dialog -->
    <Dialog.Root bind:open={showCloneModal}>
      <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>📋 Clone Game</Dialog.Title>
          <Dialog.Description>
            Create a new game using "{game?.name}" as a template. All words and
            card types will be copied, but no players or scores.
          </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
          <div class="space-y-2">
            <Label for="cloneGameName">New Game Name</Label>
            <Input
              id="cloneGameName"
              bind:value={cloneGameName}
              placeholder="Enter name for the new game..."
              maxlength="100"
            />
          </div>
          <div
            class="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-lg border border-blue-200 dark:border-blue-800"
          >
            <p class="text-sm text-blue-800 dark:text-blue-200">
              ℹ️ You'll be taken to the setup page where you can edit the words
              and settings before starting the new game.
            </p>
          </div>
        </div>
        <Dialog.Footer>
          <Button
            variant="outline"
            on:click={() => {
              showCloneModal = false;
              cloneGameName = "";
            }}
            disabled={cloneLoading}
          >
            Cancel
          </Button>
          <Button
            on:click={handleCloneGame}
            disabled={!cloneGameName.trim() || cloneLoading}
          >
            {cloneLoading ? "Creating..." : "Create Clone"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>
  </div>
{/if}

<script lang="ts">
  import { onMount } from "svelte";
  import { user } from "$lib/auth";
  import {
    getUserGames,
    getUserInvites,
    createGame,
    respondToInvite,
    deleteGame,
    cloneGame,
  } from "$lib/client-games";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";
  import { Badge } from "$lib/components/ui/badge";
  import { goto } from "$app/navigation";
  import type { Game, GameInvite } from "@prisma/client";

  type GameInviteWithRelations = GameInvite & {
    game: Game;
    user: { displayName: string | null; email: string } | null;
    inviter: { displayName: string | null; email: string };
  };

  let games: Game[] = [];
  let invites: GameInviteWithRelations[] = [];
  let loading = true;
  let showCreateGame = false;
  let gameName = "";
  let showDeleteConfirm = false;
  let gameToDelete: Game | null = null;
  let deleteLoading = false;
  let showCloneModal = false;
  let gameToClone: Game | null = null;
  let cloneGameName = "";
  let cloneLoading = false;

  onMount(async () => {
    if ($user) {
      await loadData();
    }
  });

  async function loadData() {
    try {
      loading = true;
      if ($user) {
        const [userGames, userInvites] = await Promise.all([
          getUserGames($user.id),
          getUserInvites($user.id),
        ]);
        games = userGames;
        invites = userInvites as GameInviteWithRelations[];
      }
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      loading = false;
    }
  }

  async function handleCreateGame() {
    if (!$user || !gameName.trim()) return;

    try {
      const game = await createGame(
        gameName.trim(),
        $user.id,
        $user.email || ""
      );
      gameName = "";
      showCreateGame = false;
      await loadData();
      goto(`/game/${game.id}/setup`);
    } catch (error) {
      console.error("Error creating game:", error);
    }
  }

  async function handleInviteResponse(
    inviteId: string,
    status: "ACCEPTED" | "DECLINED"
  ) {
    try {
      await respondToInvite(inviteId, status);
      await loadData();
    } catch (error) {
      console.error("Error responding to invite:", error);
    }
  }

  function confirmDeleteGame(game: Game) {
    gameToDelete = game;
    showDeleteConfirm = true;
  }

  async function handleDeleteGame() {
    if (!gameToDelete || !$user) return;

    try {
      deleteLoading = true;
      const result = await deleteGame(gameToDelete.id, $user.id);
      showDeleteConfirm = false;
      gameToDelete = null;
      await loadData();
      console.log(result.message);
    } catch (error) {
      console.error("Error deleting game:", error);
      alert(
        `Failed to delete game: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      deleteLoading = false;
    }
  }

  function cancelDelete() {
    showDeleteConfirm = false;
    gameToDelete = null;
  }

  function confirmCloneGame(game: Game) {
    gameToClone = game;
    cloneGameName = `Copy of ${game.name}`;
    showCloneModal = true;
  }

  async function handleCloneGame() {
    if (!gameToClone || !$user || !cloneGameName.trim()) return;

    try {
      cloneLoading = true;
      const result = await cloneGame(
        gameToClone.id,
        $user.id,
        cloneGameName.trim()
      );
      showCloneModal = false;
      gameToClone = null;
      cloneGameName = "";
      await loadData();
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

  function cancelClone() {
    showCloneModal = false;
    gameToClone = null;
    cloneGameName = "";
  }
</script>

<svelte:head>
  <title>Dashboard - Bingo</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center h-64">
    <div
      class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"
    ></div>
  </div>
{:else}
  <div class="space-y-8">
    <!-- Header -->
    <div
      class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
    >
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p class="text-muted-foreground">
          Welcome back! Ready for some bingo fun?
        </p>
      </div>
      <Button on:click={() => (showCreateGame = true)} size="lg">
        Create New Game
      </Button>
    </div>

    <!-- Stats Overview -->
    <div class="grid gap-4 md:grid-cols-3">
      <Card.Root>
        <Card.Header
          class="flex flex-row items-center justify-between space-y-0 pb-2"
        >
          <Card.Title class="text-sm font-medium">Total Games</Card.Title>
          <div class="h-4 w-4 text-muted-foreground">🎮</div>
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">{games.length}</div>
          <p class="text-xs text-muted-foreground">
            Games you're participating in
          </p>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header
          class="flex flex-row items-center justify-between space-y-0 pb-2"
        >
          <Card.Title class="text-sm font-medium">Pending Invites</Card.Title>
          <div class="h-4 w-4 text-muted-foreground">📬</div>
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">{invites.length}</div>
          <p class="text-xs text-muted-foreground">
            Invitations waiting for response
          </p>
        </Card.Content>
      </Card.Root>

      <Card.Root>
        <Card.Header
          class="flex flex-row items-center justify-between space-y-0 pb-2"
        >
          <Card.Title class="text-sm font-medium">Games Created</Card.Title>
          <div class="h-4 w-4 text-muted-foreground">👑</div>
        </Card.Header>
        <Card.Content>
          <div class="text-2xl font-bold">
            {games.filter((game) => game.gameMasterId === $user?.id).length}
          </div>
          <p class="text-xs text-muted-foreground">
            Games where you're the master
          </p>
        </Card.Content>
      </Card.Root>
    </div>

    <!-- Pending Invites -->
    {#if invites.length > 0}
      <div class="space-y-6">
        <div>
          <h2 class="text-2xl font-semibold tracking-tight">Pending Invites</h2>
          <p class="text-muted-foreground">
            You have {invites.length} invitation{invites.length === 1
              ? ""
              : "s"} waiting for your response
          </p>
        </div>

        <div class="grid gap-4">
          {#each invites as invite}
            <Card.Root>
              <Card.Header>
                <div class="flex items-center justify-between">
                  <div>
                    <Card.Title class="text-lg">{invite.game.name}</Card.Title>
                    <Card.Description>
                      Invited by {invite.inviter.displayName ||
                        invite.inviter.email}
                    </Card.Description>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
              </Card.Header>
              <Card.Content>
                <div class="flex gap-2">
                  <Button
                    size="sm"
                    on:click={() => handleInviteResponse(invite.id, "ACCEPTED")}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    on:click={() => handleInviteResponse(invite.id, "DECLINED")}
                  >
                    Decline
                  </Button>
                </div>
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      </div>
    {/if}

    <!-- My Games -->
    <div class="space-y-6">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">My Games</h2>
        <p class="text-muted-foreground">
          {games.length === 0
            ? "No games yet. Create your first game to get started!"
            : `You're participating in ${games.length} game${games.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {#if games.length === 0}
        <Card.Root>
          <Card.Content class="pt-6">
            <div class="text-center py-8">
              <div class="mx-auto h-12 w-12 mb-4 text-4xl">🎯</div>
              <h3 class="text-lg font-semibold mb-2">Ready to play?</h3>
              <p class="text-muted-foreground mb-4">
                Create your first game and start the bingo fun!
              </p>
              <Button on:click={() => (showCreateGame = true)}>
                Create Your First Game
              </Button>
            </div>
          </Card.Content>
        </Card.Root>
      {:else}
        <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {#each games as game}
            <Card.Root class="hover:shadow-md transition-shadow">
              <Card.Header class="pb-3">
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <Card.Title class="text-lg font-semibold truncate"
                      >{game.name}</Card.Title
                    >
                    <div class="flex items-center gap-2 mt-1">
                      <Badge
                        variant={game.gameMasterId === $user?.id
                          ? "default"
                          : "secondary"}
                        class="text-xs"
                      >
                        {game.gameMasterId === $user?.id ? "Master" : "Player"}
                      </Badge>
                      {#if game.publishedAt}
                        <Badge variant="outline" class="text-xs"
                          >🌐 Public</Badge
                        >
                      {/if}
                    </div>
                  </div>
                  <Badge
                    variant={game.status === "ACTIVE" ? "default" : "secondary"}
                    class="ml-2 text-xs"
                  >
                    {game.status}
                  </Badge>
                </div>
              </Card.Header>

              <Card.Content class="pt-0">
                <div class="space-y-3">
                  <!-- Primary Action Button -->
                  <Button href="/game/{game.id}" class="w-full" size="default">
                    {#if game.gameMasterId === $user?.id}
                      ⚙️ Manage Game
                    {:else}
                      👁️ View Game
                    {/if}
                  </Button>

                  <!-- Less prominent publish date -->
                  <div class="text-xs text-muted-foreground/70 text-center">
                    {#if game.publishedAt}
                      Published {new Date(
                        game.publishedAt
                      ).toLocaleDateString()}
                    {:else}
                      Created {new Date(game.createdAt).toLocaleDateString()}
                    {/if}
                  </div>
                </div>

                <div class="space-y-2 mt-3">
                  <div class="flex gap-2">
                    {#if game.publishedAt}
                      <Button
                        href="/play/{game.id}"
                        variant="outline"
                        size="sm"
                        class="flex-1 text-xs"
                      >
                        🔗 Public Link
                      </Button>
                    {/if}

                    <!-- Edit button for game masters on active/completed games -->
                    {#if game.gameMasterId === $user?.id && (game.status === "ACTIVE" || game.status === "COMPLETED")}
                      <Button
                        href="/game/{game.id}/setup?edit=true"
                        variant="outline"
                        size="sm"
                        class="text-xs flex-1"
                      >
                        ✏️ Edit
                      </Button>
                    {/if}

                    <!-- Clone button for games that have been set up (have word lists) -->
                    {#if game.status !== "SETUP"}
                      <Button
                        on:click={() => confirmCloneGame(game)}
                        variant="outline"
                        size="sm"
                        class="text-xs flex-1"
                      >
                        📋 Clone
                      </Button>
                    {/if}

                    {#if game.gameMasterId === $user?.id}
                      <Button
                        on:click={() => confirmDeleteGame(game)}
                        variant="outline"
                        size="sm"
                        class="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 {game.publishedAt ||
                        game.status !== 'SETUP'
                          ? ''
                          : 'flex-1'}"
                      >
                        🗑️ Delete
                      </Button>
                    {/if}
                  </div>
                </div>
              </Card.Content>
            </Card.Root>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Create Game Dialog -->
    <Dialog.Root bind:open={showCreateGame}>
      <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>Create New Game</Dialog.Title>
          <Dialog.Description>
            Start a new bingo game and invite your friends to join the fun!
          </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
          <div class="space-y-2">
            <Label for="gameName">Game Name</Label>
            <Input
              id="gameName"
              bind:value={gameName}
              placeholder="Enter a fun game name..."
            />
          </div>
        </div>
        <Dialog.Footer>
          <Button
            variant="outline"
            on:click={() => {
              showCreateGame = false;
              gameName = "";
            }}
          >
            Cancel
          </Button>
          <Button on:click={handleCreateGame} disabled={!gameName.trim()}>
            Create Game
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Delete Confirmation Dialog -->
    <Dialog.Root bind:open={showDeleteConfirm}>
      <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title class="text-destructive">Delete Game</Dialog.Title>
          <Dialog.Description>
            {#if gameToDelete}
              Are you sure you want to delete "{gameToDelete.name}"?
            {/if}
          </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
          <div class="bg-red-50 border border-red-200 rounded-md p-3">
            <p class="text-sm text-red-800">
              <strong>Warning:</strong> This action cannot be undone. All game data,
              participants, and scores will be permanently deleted.
            </p>
          </div>
        </div>
        <Dialog.Footer>
          <Button
            variant="outline"
            on:click={cancelDelete}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            on:click={handleDeleteGame}
            disabled={deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete Game"}
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog.Root>

    <!-- Clone Game Dialog -->
    <Dialog.Root bind:open={showCloneModal}>
      <Dialog.Content class="sm:max-w-[425px]">
        <Dialog.Header>
          <Dialog.Title>📋 Clone Game</Dialog.Title>
          <Dialog.Description>
            {#if gameToClone}
              Create a new game using "{gameToClone.name}" as a template. All
              words and card types will be copied, but no players or scores.
            {/if}
          </Dialog.Description>
        </Dialog.Header>
        <div class="grid gap-4 py-4">
          <div class="space-y-2">
            <Label for="cloneGameName">New Game Name</Label>
            <Input
              id="cloneGameName"
              bind:value={cloneGameName}
              placeholder="Enter name for the new game..."
              maxlength={100}
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
            on:click={cancelClone}
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

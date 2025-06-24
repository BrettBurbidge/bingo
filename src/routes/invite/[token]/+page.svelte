<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { user } from "$lib/auth";
  import { joinGame } from "$lib/client-games";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import type { GameInvite, Game, Profile } from "@prisma/client";

  type InviteWithGame = GameInvite & {
    game: Game & { gameMaster: Profile };
    inviter: Profile;
  };

  let invite: InviteWithGame | null = null;
  let loading = true;
  let joining = false;
  let error: string | null = null;

  $: token = $page.params.token;

  onMount(async () => {
    await loadInvite();
  });

  async function loadInvite() {
    try {
      loading = true;
      const response = await fetch(`/api/invites/token/${token}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        error = errorData.error || "Invite not found";
        return;
      }

      invite = await response.json();

      // If user is already signed in and this invite is for them, auto-join
      if ($user && invite && invite.email === $user.email) {
        await handleJoinGame();
      }
    } catch (err) {
      console.error("Error loading invite:", err);
      error = "Failed to load invite";
    } finally {
      loading = false;
    }
  }

  async function handleJoinGame() {
    if (!$user || !invite) return;

    try {
      joining = true;
      await joinGame(
        invite.gameId, 
        $user.id, 
        $user.email, 
        $user.user_metadata?.display_name
      );
      goto(`/game/${invite.gameId}`);
    } catch (err) {
      console.error("Error joining game:", err);
      error = "Failed to join game";
    } finally {
      joining = false;
    }
  }

  function handleSignUp() {
    // Store the invite token in localStorage so we can auto-join after signup
    localStorage.setItem('pendingInviteToken', token);
    goto(`/?invite=${token}`);
  }
</script>

<svelte:head>
  <title>Game Invitation - Bingo</title>
</svelte:head>

{#if loading}
  <div class="flex justify-center items-center h-64">
    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
{:else if error}
  <div class="text-center py-12 max-w-md mx-auto">
    <div class="mx-auto h-12 w-12 mb-4 text-4xl">❌</div>
    <h1 class="text-2xl font-bold mb-4">Invitation Error</h1>
    <p class="text-muted-foreground mb-6">{error}</p>
    <Button href="/">Go to Home</Button>
  </div>
{:else if !invite}
  <div class="text-center py-12 max-w-md mx-auto">
    <div class="mx-auto h-12 w-12 mb-4 text-4xl">🚫</div>
    <h1 class="text-2xl font-bold mb-4">Invite Not Found</h1>
    <p class="text-muted-foreground mb-6">
      This invitation doesn't exist or has expired.
    </p>
    <Button href="/">Go to Home</Button>
  </div>
{:else}
  <div class="max-w-2xl mx-auto space-y-8">
    <!-- Header -->
    <div class="text-center">
      <div class="mx-auto h-16 w-16 mb-4 text-6xl">🎮</div>
      <h1 class="text-3xl font-bold tracking-tight mb-2">You're Invited!</h1>
      <p class="text-muted-foreground">
                    Join the fun and play Bingo with your friends
      </p>
    </div>

    <!-- Game Details -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <Card.Title class="text-xl">{invite.game.name}</Card.Title>
          <Badge variant={invite.game.status === "ACTIVE" ? "default" : "secondary"}>
            {invite.game.status}
          </Badge>
        </div>
        <Card.Description>
          Invited by {invite.inviter.displayName || invite.inviter.email}
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <p class="text-sm font-medium text-muted-foreground">Game Master</p>
            <p>{invite.game.gameMaster.displayName || invite.game.gameMaster.email}</p>
          </div>
          <div>
            <p class="text-sm font-medium text-muted-foreground">Status</p>
            <p class="capitalize">{invite.game.status.toLowerCase()}</p>
          </div>
        </div>

        {#if invite.game.status === "SETUP"}
          <div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p class="text-sm text-blue-800 dark:text-blue-200">
              🎯 This game is still being set up. You'll be able to join once the game master finishes creating the board!
            </p>
          </div>
        {:else if invite.game.status === "COMPLETED"}
          <div class="bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <p class="text-sm text-gray-800 dark:text-gray-200">
              🏁 This game has already finished, but you can still view the results!
            </p>
          </div>
        {/if}
      </Card.Content>
    </Card.Root>

    <!-- Action Buttons -->
    <div class="text-center space-y-4">
      {#if !$user}
        <!-- User not signed in -->
        <div class="space-y-4">
          <div class="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              💡 You need to create an account to join the game. Don't worry, it's quick and free!
            </p>
          </div>
          <div class="flex gap-2 justify-center">
            <Button on:click={handleSignUp} class="w-full sm:w-auto">
              Sign Up & Join Game
            </Button>
            <Button variant="outline" href="/" class="w-full sm:w-auto">
              Maybe Later
            </Button>
          </div>
        </div>
      {:else if invite.email !== $user.email}
        <!-- User signed in but wrong email -->
        <div class="space-y-4">
          <div class="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <p class="text-sm text-orange-800 dark:text-orange-200">
              ⚠️ This invitation was sent to <strong>{invite.email}</strong>, but you're signed in as <strong>{$user.email}</strong>.
            </p>
          </div>
          <div class="flex gap-2 justify-center">
            <Button variant="outline" href="/dashboard">
              Go to Dashboard
            </Button>
            <Button variant="outline" on:click={() => goto('/')}>
              Sign Out & Try Again
            </Button>
          </div>
        </div>
      {:else}
        <!-- User signed in with correct email -->
        <div class="space-y-4">
          <div class="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p class="text-sm text-green-800 dark:text-green-200">
              ✅ Great! You're all set to join this game.
            </p>
          </div>
          <div class="flex gap-2 justify-center">
            <Button 
              on:click={handleJoinGame} 
              disabled={joining}
              class="w-full sm:w-auto"
            >
              {joining ? "Joining..." : "Join Game"}
            </Button>
            <Button variant="outline" href="/dashboard" class="w-full sm:w-auto">
              My Dashboard
            </Button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Info Box -->
    <Card.Root class="bg-muted/50">
      <Card.Content class="pt-6">
        <div class="text-center space-y-2">
                        <h3 class="font-semibold">What is Bingo?</h3>
          <p class="text-sm text-muted-foreground">
            A fun multiplayer game where players compete to be the first to get 5 in a row on their bingo board. 
                          Perfect for trips, parties, or just hanging out with friends!
          </p>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{/if} 
<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { user } from "$lib/auth";
  import { getGameMasterInvite, respondToGameMasterInvite } from "$lib/game-masters";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";
  import type { GameMasterInvite } from "$lib/game-masters";

  let invite: GameMasterInvite | null = null;
  let loading = true;
  let responding = false;
  let error: string | null = null;

  $: token = $page.params.token;

  onMount(async () => {
    await loadInvite();
  });

  async function loadInvite() {
    try {
      loading = true;
      invite = await getGameMasterInvite(token);

      // If user is already signed in and this invite is for them, show the accept UI
      if ($user && invite && invite.email === $user.email) {
        // Ready to show accept/decline options
      }
    } catch (err) {
      console.error("Error loading game master invite:", err);
      error = "Invite not found or has expired";
    } finally {
      loading = false;
    }
  }

  async function handleAccept() {
    if (!$user || !invite) return;

    try {
      responding = true;
      const result = await respondToGameMasterInvite(
        token, 
        "accept", 
        $user.id, 
        $user.email
      );
      
      if (result.success && result.gameId) {
        goto(`/game/${result.gameId}?message=${encodeURIComponent("You are now a game master for this game!")}`);
      }
    } catch (err) {
      console.error("Error accepting invite:", err);
      error = "Failed to accept invitation";
    } finally {
      responding = false;
    }
  }

  async function handleDecline() {
    if (!$user || !invite) return;

    try {
      responding = true;
      await respondToGameMasterInvite(token, "decline", $user.id, $user.email);
      goto("/?message=" + encodeURIComponent("Game master invitation declined"));
    } catch (err) {
      console.error("Error declining invite:", err);
      error = "Failed to decline invitation";
    } finally {
      responding = false;
    }
  }

  function handleSignUp() {
    // Store the invite token in localStorage so we can auto-accept after signup
    localStorage.setItem('pendingGameMasterInviteToken', token);
    goto(`/?gmInvite=${token}`);
  }
</script>

<svelte:head>
  <title>Game Master Invitation - Bingo</title>
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
      This game master invitation doesn't exist or has expired.
    </p>
    <Button href="/">Go to Home</Button>
  </div>
{:else}
  <div class="max-w-2xl mx-auto space-y-8">
    <!-- Header -->
    <div class="text-center">
      <div class="mx-auto h-16 w-16 mb-4 text-6xl">👑</div>
      <h1 class="text-3xl font-bold tracking-tight mb-2">You're Invited to be a Game Master!</h1>
      <p class="text-muted-foreground">
        Help manage and administer this Bingo game
      </p>
    </div>

    <!-- Game Details -->
    <Card.Root>
      <Card.Header>
        <div class="flex items-center justify-between">
          <Card.Title class="text-xl">{invite.game.name}</Card.Title>
          <Badge variant="secondary">Game Master Invite</Badge>
        </div>
        <Card.Description>
          Invited by {invite.inviter.displayName || invite.inviter.email}
        </Card.Description>
      </Card.Header>
      <Card.Content class="space-y-4">
        <div class="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <h3 class="font-semibold text-orange-800 dark:text-orange-200 mb-2">👑 Game Master Privileges</h3>
          <ul class="text-sm text-orange-800 dark:text-orange-200 space-y-1">
            <li>• Publish and unpublish the game</li>
            <li>• Invite other game masters</li>
            <li>• Manage game settings alongside the creator</li>
            <li>• Help administer the game during play</li>
          </ul>
        </div>
        
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <p class="text-sm font-medium text-muted-foreground">Game Creator</p>
            <p>{invite.inviter.displayName || invite.inviter.email}</p>
          </div>
          <div>
            <p class="text-sm font-medium text-muted-foreground">Expires</p>
            <p>{new Date(invite.expiresAt).toLocaleDateString()}</p>
          </div>
        </div>
      </Card.Content>
    </Card.Root>

    <!-- Action Buttons -->
    <div class="text-center space-y-4">
      {#if !$user}
        <!-- User not signed in -->
        <div class="space-y-4">
          <div class="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <p class="text-sm text-yellow-800 dark:text-yellow-200">
              💡 You need to create an account to accept this game master invitation. Don't worry, it's quick and free!
            </p>
          </div>
          <div class="flex flex-col gap-3 justify-center">
            <Button on:click={handleSignUp} size="lg" class="w-full text-lg py-4 bg-orange-600 hover:bg-orange-700">
              👑 Sign Up & Become Game Master
            </Button>
            <Button variant="outline" href="/" size="sm" class="w-full sm:w-auto">
              Maybe Later
            </Button>
          </div>
        </div>
      {:else if invite.email !== $user.email}
        <!-- User signed in but wrong email -->
        <div class="space-y-4">
          <div class="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
            <p class="text-sm text-orange-800 dark:text-orange-200">
              ⚠️ This game master invitation was sent to <strong>{invite.email}</strong>, but you're signed in as <strong>{$user.email}</strong>.
            </p>
          </div>
          <div class="flex flex-col gap-2 justify-center">
            <div class="flex gap-2 justify-center">
              <Button variant="outline" href="/dashboard">
                Go to Dashboard
              </Button>
              <Button variant="outline" on:click={() => goto('/')}>
                Sign Out & Try Again
              </Button>
            </div>
            <div class="text-center">
              <Button variant="link" href="/forgot-password" class="text-xs">
                Forgot your password?
              </Button>
            </div>
          </div>
        </div>
      {:else}
        <!-- User signed in with correct email -->
        <div class="space-y-4">
          <div class="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p class="text-sm text-green-800 dark:text-green-200">
              🎉 Perfect! You're signed in with the correct email address. Ready to become a game master?
            </p>
          </div>
          
          <div class="flex gap-2 justify-center">
            <Button 
              on:click={handleAccept} 
              disabled={responding}
              class="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
            >
              {#if responding}
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              {/if}
              👑 Accept & Become Game Master
            </Button>
            <Button 
              variant="outline" 
              on:click={handleDecline}
              disabled={responding}
              class="w-full sm:w-auto"
            >
              Decline
            </Button>
          </div>
        </div>
      {/if}
    </div>

    <!-- Additional Info -->
    <Card.Root>
      <Card.Content class="pt-6">
        <div class="text-center text-sm text-muted-foreground space-y-2">
          <p><strong>What does this mean?</strong></p>
          <p>
            As a Game Master, you'll have administrative privileges for this game. 
            You can help the game creator manage the game and ensure it runs smoothly.
          </p>
          <p class="text-xs">
            This invitation will expire on {new Date(invite.expiresAt).toLocaleDateString()}.
          </p>
        </div>
      </Card.Content>
    </Card.Root>
  </div>
{/if} 
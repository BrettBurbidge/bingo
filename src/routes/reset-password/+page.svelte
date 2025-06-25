<script lang="ts">
  import { updatePassword, user } from "$lib/auth";
  import { supabase } from "$lib/supabase";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let password = "";
  let confirmPassword = "";
  let loading = false;
  let error = "";
  let success = false;
  let isValidSession = false;

  onMount(async () => {
    // Check if we have auth tokens in the URL (from password reset email)
    const accessToken = $page.url.searchParams.get('access_token');
    const refreshToken = $page.url.searchParams.get('refresh_token');
    const type = $page.url.searchParams.get('type');
    
    if (accessToken && refreshToken && type === 'recovery') {
      try {
        // Set the session using the tokens from the URL
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) throw error;
        
        isValidSession = true;
        
        // Clean up the URL by removing the query parameters
        const url = new URL(window.location.href);
        url.searchParams.delete('access_token');
        url.searchParams.delete('refresh_token');
        url.searchParams.delete('type');
        window.history.replaceState({}, '', url.toString());
        
      } catch (error) {
        console.error('Error setting session:', error);
        goto('/forgot-password');
      }
    } else if ($user) {
      // User is already logged in
      isValidSession = true;
    } else {
      // No valid session, redirect to forgot password
      goto('/forgot-password');
    }
  });

  async function handleSubmit() {
    if (!password.trim()) {
      error = "Please enter a new password";
      return;
    }

    if (password.length < 6) {
      error = "Password must be at least 6 characters long";
      return;
    }

    if (password !== confirmPassword) {
      error = "Passwords do not match";
      return;
    }

    loading = true;
    error = "";

    try {
      await updatePassword(password);
      success = true;
      
      // Redirect to dashboard after a short delay
      setTimeout(() => {
        goto('/dashboard');
      }, 2000);
    } catch (e) {
      error = e instanceof Error ? e.message : "An error occurred while updating your password";
    }

    loading = false;
  }

  function goToSignIn() {
    goto("/");
  }
</script>

<svelte:head>
  <title>Set New Password - Bingo</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center space-y-2">
      <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
        <span class="text-2xl">🔒</span>
      </div>
      
      <Card.Title class="text-2xl">Set New Password</Card.Title>
      <Card.Description>
        {success 
          ? "Password updated successfully!"
          : "Create a strong password for your account"}
      </Card.Description>
    </Card.Header>

    <Card.Content class="space-y-4">
      {#if success}
        <div class="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div class="flex items-start gap-3">
            <div class="flex-shrink-0">
              <span class="text-green-600 dark:text-green-400">✅</span>
            </div>
            <div>
              <h4 class="text-sm font-medium text-green-800 dark:text-green-200">Password updated!</h4>
              <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                Your password has been successfully updated. You will be redirected to your dashboard shortly.
              </p>
            </div>
          </div>
        </div>

        <Button on:click={() => goto('/dashboard')} class="w-full">
          Go to Dashboard
        </Button>
      {:else if isValidSession}
        <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
          <div class="space-y-2">
            <Label for="password">New Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              bind:value={password}
              placeholder="Enter your new password"
              disabled={loading}
              minlength={6}
            />
            <p class="text-xs text-muted-foreground">
              Password must be at least 6 characters long
            </p>
          </div>

          <div class="space-y-2">
            <Label for="confirmPassword">Confirm New Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              bind:value={confirmPassword}
              placeholder="Confirm your new password"
              disabled={loading}
            />
          </div>

          {#if error}
            <div class="p-3 rounded-md bg-destructive/15 border border-destructive/20">
              <p class="text-sm text-destructive">{error}</p>
            </div>
          {/if}

          <Button type="submit" disabled={loading} class="w-full" size="lg">
            {loading ? "Updating Password..." : "Update Password"}
          </Button>
        </form>

        <div class="text-center">
          <Button variant="link" on:click={goToSignIn}>
            Back to Sign In
          </Button>
        </div>
      {:else}
        <div class="text-center py-4">
          <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p class="text-sm text-muted-foreground">Verifying reset link...</p>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div> 
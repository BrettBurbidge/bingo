<script lang="ts">
  import { resetPassword } from "$lib/auth";
  import { goto } from "$app/navigation";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Input } from "$lib/components/ui/input";
  import { Label } from "$lib/components/ui/label";

  let email = "";
  let loading = false;
  let error = "";
  let success = false;

  async function handleSubmit() {
    if (!email.trim()) {
      error = "Please enter your email address";
      return;
    }

    loading = true;
    error = "";

    try {
      await resetPassword(email);
      success = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "An error occurred";
    }

    loading = false;
  }

  function goBack() {
    goto("/");
  }
</script>

<svelte:head>
  <title>Reset Password - Bingo</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center space-y-2">
      <div class="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
        <span class="text-2xl">🔑</span>
      </div>
      
      <Card.Title class="text-2xl">Reset Your Password</Card.Title>
      <Card.Description>
        {success 
          ? "Check your email for reset instructions"
          : "Enter your email address and we'll send you a link to reset your password"}
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
              <h4 class="text-sm font-medium text-green-800 dark:text-green-200">Reset email sent!</h4>
              <p class="text-sm text-green-700 dark:text-green-300 mt-1">
                We've sent a password reset link to <strong>{email}</strong>
              </p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-2">
                📧 Check your spam folder if you don't see the email within a few minutes.
              </p>
            </div>
          </div>
        </div>

        <div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 class="font-medium text-blue-900 dark:text-blue-100 mb-2">📋 What to do next:</h3>
          <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Check your email inbox</li>
            <li>• Look for an email from Supabase</li>
            <li>• Click the reset password link</li>
            <li>• Create a new password</li>
          </ul>
        </div>

        <Button on:click={goBack} variant="outline" class="w-full">
          Back to Sign In
        </Button>
      {:else}
        <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
          <div class="space-y-2">
            <Label for="email">Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              bind:value={email}
              placeholder="name@example.com"
              disabled={loading}
            />
          </div>

          {#if error}
            <div class="p-3 rounded-md bg-destructive/15 border border-destructive/20">
              <p class="text-sm text-destructive">{error}</p>
            </div>
          {/if}

          <Button type="submit" disabled={loading} class="w-full" size="lg">
            {loading ? "Sending Reset Email..." : "Send Reset Email"}
          </Button>
        </form>

        <div class="text-center">
          <Button variant="link" on:click={goBack}>
            Back to Sign In
          </Button>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div> 
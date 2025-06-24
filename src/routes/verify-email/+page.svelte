<script lang="ts">
  import { user, emailVerified, resendVerification } from "$lib/auth";
  import { goto } from "$app/navigation";
  import { onMount } from "svelte";
  import Button from "$lib/components/ui/button.svelte";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";

  let resendLoading = false;
  let resendSuccess = false;
  let resendError = "";
  let checkingStatus = true;

  // Redirect if not logged in or already verified
  $: if ($user === null) {
    goto("/");
  } else if ($emailVerified) {
    goto("/dashboard");
  }

  onMount(() => {
    // Stop the loading indicator
    checkingStatus = false;
    
    // Auto-check verification status every 10 seconds
    const interval = setInterval(async () => {
      if ($user && !$emailVerified) {
        const { supabase } = await import("$lib/supabase");
        const { data } = await supabase.auth.getSession();
        if (data.session?.user?.email_confirmed_at) {
          emailVerified.set(true);
        }
      }
    }, 10000);

    return () => clearInterval(interval);
  });

  async function handleResendVerification() {
    if (!$user?.email) return;
    
    resendLoading = true;
    resendError = "";
    resendSuccess = false;

    try {
      await resendVerification($user.email);
      resendSuccess = true;
    } catch (error) {
      resendError = error instanceof Error ? error.message : "Failed to resend verification";
    }

    resendLoading = false;
  }

  function goToDashboard() {
    goto("/dashboard");
  }
</script>

<svelte:head>
  <title>Verify Your Email - Bingo</title>
</svelte:head>

<div class="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
  <Card.Root class="w-full max-w-md">
    <Card.Header class="text-center space-y-2">
      <div class="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center mb-4">
        <span class="text-2xl">📧</span>
      </div>
      
      <Card.Title class="text-2xl">Verify Your Email</Card.Title>
      <Card.Description>
        We've sent a verification link to<br />
        <strong class="text-foreground">{$user?.email}</strong>
      </Card.Description>
    </Card.Header>

    <Card.Content class="space-y-4">
      {#if checkingStatus}
        <div class="text-center py-4">
          <div class="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
          <p class="text-sm text-muted-foreground">Checking verification status...</p>
        </div>
      {:else}
        <div class="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 class="font-medium text-blue-900 dark:text-blue-100 mb-2">📋 What to do next:</h3>
          <ul class="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Check your email inbox</li>
            <li>• Look for an email from Supabase</li>
            <li>• Click the verification link</li>
            <li>• Return to this page to continue</li>
          </ul>
        </div>

        <div class="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p class="text-sm text-amber-800 dark:text-amber-200">
            <strong>⚠️ Don't see the email?</strong><br />
            Check your spam/junk folder. Verification emails can sometimes end up there.
          </p>
        </div>

        {#if resendSuccess}
          <div class="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p class="text-sm text-green-800 dark:text-green-200">
              ✅ <strong>Verification email sent!</strong><br />
              Please check your inbox again.
            </p>
          </div>
        {/if}

        {#if resendError}
          <div class="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p class="text-sm text-red-800 dark:text-red-200">
              ❌ <strong>Error:</strong> {resendError}
            </p>
          </div>
        {/if}

        <div class="flex flex-col gap-2">
          <Button 
            variant="outline" 
            disabled={resendLoading}
            on:click={handleResendVerification}
            class="w-full"
          >
            {resendLoading ? "Sending..." : "Resend Verification Email"}
          </Button>
          
          <Button 
            variant="ghost" 
            on:click={goToDashboard}
            class="w-full"
          >
            Continue to Dashboard
          </Button>
        </div>

        <div class="text-center pt-4">
          <p class="text-xs text-muted-foreground">
            This page will automatically refresh to check your verification status.
          </p>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div> 
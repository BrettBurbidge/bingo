<script lang="ts">
  import { user, emailVerified, resendVerification } from "$lib/auth";
  import Button from "$lib/components/ui/button.svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { onMount } from "svelte";

  let showBanner = false;
  let resendLoading = false;
  let resendSuccess = false;
  let resendError = "";

  $: {
    // Show banner if user is logged in but email not verified
    showBanner = Boolean($user && !$emailVerified);
  }

  async function handleResendVerification() {
    if (!$user?.email) return;
    
    resendLoading = true;
    resendError = "";
    resendSuccess = false;

    try {
      await resendVerification($user.email);
      resendSuccess = true;
      setTimeout(() => {
        resendSuccess = false;
      }, 5000);
    } catch (error) {
      resendError = error instanceof Error ? error.message : "Failed to resend verification";
      setTimeout(() => {
        resendError = "";
      }, 5000);
    }

    resendLoading = false;
  }

  // Auto-refresh email verification status every 30 seconds
  onMount(() => {
    const interval = setInterval(async () => {
      if ($user && !$emailVerified) {
        // Refresh session to check if email was verified
        const { data } = await import("$lib/supabase").then(m => m.supabase.auth.getSession());
        if (data.session?.user?.email_confirmed_at) {
          emailVerified.set(true);
        }
      }
    }, 30000);

    return () => clearInterval(interval);
  });
</script>

{#if showBanner}
  <div class="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800">
    <div class="container mx-auto px-4 py-3">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div class="flex items-start sm:items-center gap-3">
          <div class="flex-shrink-0 mt-0.5 sm:mt-0">
            <Badge variant="outline" class="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700">
              ⚠️ Email Not Verified
            </Badge>
          </div>
          <div class="min-w-0">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              Please verify your email address to access all features
            </p>
            <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Check your inbox for a verification link from Supabase. It may take a few minutes to arrive.
            </p>
          </div>
        </div>
        
        <div class="flex items-center gap-2 flex-shrink-0">
          {#if resendSuccess}
            <Badge variant="default" class="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 border-green-300 dark:border-green-700">
              ✅ Verification email sent!
            </Badge>
          {:else if resendError}
            <Badge variant="destructive" class="text-xs">
              {resendError}
            </Badge>
          {/if}
          
          <Button 
            variant="outline" 
            size="sm" 
            disabled={resendLoading}
            on:click={handleResendVerification}
            class="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800"
          >
            {resendLoading ? "Sending..." : "Resend Email"}
          </Button>
          
          <Button 
            variant="outline" 
            size="sm"
            href="/verify-email"
            class="bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-800"
          >
            View Details
          </Button>
        </div>
      </div>
    </div>
  </div>
{/if} 
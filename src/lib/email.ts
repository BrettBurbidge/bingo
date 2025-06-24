import { Resend } from "resend";
import { RESEND_API_KEY } from "$env/static/private";
import { env } from "$env/dynamic/private";

const resend = new Resend(RESEND_API_KEY);

// Get the from email address from environment with fallback
const getFromEmail = () => {
  return env.RESEND_FROM_EMAIL || "Bingo <onboarding@resend.dev>";
};

// Check if we're using the test domain
const isUsingTestDomain = () => {
  const fromEmail = getFromEmail();
  return fromEmail.includes("@resend.dev");
};

export interface GameInviteEmailData {
  gameId: string;
  gameName: string;
  inviterName: string;
  inviterEmail: string;
  inviteToken: string;
  isRegistered: boolean;
}

export async function sendGameInviteEmail(
  toEmail: string,
  data: GameInviteEmailData
): Promise<void> {
  // Get the current base URL dynamically
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://your-domain.com" // Replace with your actual domain
      : `https://localhost:${process.env.PORT || 5173}`;

  const inviteUrl = `${baseUrl}/invite/${data.inviteToken}`;

  const subject = `🎮 You're invited to play "${data.gameName}" - Bingo!`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0066cc; margin: 0;">🎯 Bingo</h1>
      </div>
      
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0 0 10px 0;">You're Invited to Play!</h2>
        <h3 style="margin: 0; font-weight: normal;">"${data.gameName}"</h3>
      </div>

      <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
        <p style="margin: 0 0 15px 0;">
          <strong>${data.inviterName}</strong> (${data.inviterEmail}) has invited you to join their Bingo game!
        </p>
        
        ${
          data.isRegistered
            ? `<p>Since you already have an account, just click the link below to join the game:</p>`
            : `<p>To join the game, you'll need to create a free account first. Don't worry, it only takes a minute!</p>`
        }
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" 
           style="background: #0066cc; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          ${data.isRegistered ? "Join Game" : "Sign Up & Join Game"}
        </a>
      </div>

      <div style="border-top: 1px solid #dee2e6; padding-top: 20px; color: #6c757d; font-size: 14px;">
        <p><strong>What is Bingo?</strong></p>
        <p>It's a fun multiplayer bingo game where players compete to be the first to get 5 in a row! Perfect for trips, parties, or just hanging out with friends.</p>
        
        <p style="margin-top: 20px;">
          <small>This invite will expire in 7 days. If you have any questions, reply to this email.</small>
        </p>
      </div>
    </div>
  `;

  const text = `
You're invited to play "${data.gameName}" - Bingo!

${data.inviterName} (${data.inviterEmail}) has invited you to join their Bingo game.

${
  data.isRegistered
    ? "Click the link below to join the game:"
    : "To join the game, you'll need to create a free account first:"
}

${inviteUrl}

What is Bingo?
It's a fun multiplayer bingo game where players compete to be the first to get 5 in a row!

This invite will expire in 7 days.
  `;

  console.log(`📧 Sending invite email to: ${toEmail}`);
  console.log(`🔗 Invite URL: ${inviteUrl}`);
  console.log(`📨 From: ${getFromEmail()}`);

  try {
    const { data: emailData, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [toEmail],
      subject,
      html,
      text,
    });

    if (error) {
      console.error("❌ Resend API error:", error);

      // Provide specific guidance for common development issues
      if (
        error.message?.includes(
          "You can only send testing emails to your own email address"
        )
      ) {
        console.log(`
🔧 Development Mode Email Limitation:
   When using Resend's test domain (@resend.dev), you can only send emails to your verified email address.
   
   Options:
   1. Use your own email address for testing
   2. Set up a verified domain in Resend (https://resend.com/domains)
   3. Update RESEND_FROM_EMAIL in .env to use your verified domain
   
   Current from address: ${getFromEmail()}
   Attempted to send to: ${toEmail}
        `);
      }

      throw new Error(`Resend API error: ${JSON.stringify(error)}`);
    }

    console.log("✅ Email sent successfully!", emailData);
  } catch (error) {
    console.error("❌ Failed to send email:", error);
    throw new Error(
      `Failed to send invitation email: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

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

export interface GameMasterInviteEmailData {
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

export async function sendGameMasterInviteEmail(
  toEmail: string,
  data: GameMasterInviteEmailData
): Promise<void> {
  // Get the current base URL dynamically
  const baseUrl =
    process.env.NODE_ENV === "production"
      ? "https://your-domain.com" // Replace with your actual domain
      : `https://localhost:${process.env.PORT || 5173}`;

  const inviteUrl = `${baseUrl}/game-master-invite/${data.inviteToken}`;

  const subject = `👑 You're invited to be a Game Master for "${data.gameName}" - Bingo!`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #0066cc; margin: 0;">🎯 Bingo</h1>
      </div>
      
      <div style="background: linear-gradient(135deg, #f39c12 0%, #e74c3c 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px;">
        <h2 style="margin: 0 0 10px 0;">👑 You're Invited to be a Game Master!</h2>
        <h3 style="margin: 0; font-weight: normal;">"${data.gameName}"</h3>
      </div>

      <div style="padding: 20px; background: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
        <p style="margin: 0 0 15px 0;">
          <strong>${data.inviterName}</strong> (${data.inviterEmail}) has invited you to be a Game Master for their Bingo game!
        </p>
        
        <p style="margin: 0 0 15px 0;">
          <strong>As a Game Master, you'll be able to:</strong>
        </p>
        <ul style="margin: 0 0 15px 20px; padding: 0;">
          <li>Publish and unpublish the game</li>
          <li>Invite other game masters</li>
          <li>Manage the game alongside the creator</li>
        </ul>
        
        ${
          data.isRegistered
            ? `<p>Since you already have an account, just click the link below to accept:</p>`
            : `<p>To accept this invitation, you'll need to create a free account first. Don't worry, it only takes a minute!</p>`
        }
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${inviteUrl}" 
           style="background: #e74c3c; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
          ${data.isRegistered ? "Accept Game Master Invite" : "Sign Up & Become Game Master"}
        </a>
      </div>

      <div style="border-top: 1px solid #dee2e6; padding-top: 20px; color: #6c757d; font-size: 14px;">
        <p><strong>What is a Game Master?</strong></p>
        <p>Game Masters help manage Bingo games by having the authority to publish games for players to join and invite other trusted users to also be Game Masters.</p>
        
        <p style="margin-top: 20px;">
          <small>This invite will expire in 7 days. If you have any questions, reply to this email.</small>
        </p>
      </div>
    </div>
  `;

  const text = `
👑 You're invited to be a Game Master for "${data.gameName}" - Bingo!

${data.inviterName} (${data.inviterEmail}) has invited you to be a Game Master for their Bingo game.

As a Game Master, you'll be able to:
- Publish and unpublish the game
- Invite other game masters  
- Manage the game alongside the creator

${
  data.isRegistered
    ? "Click the link below to accept:"
    : "To accept this invitation, you'll need to create a free account first:"
}

${inviteUrl}

What is a Game Master?
Game Masters help manage Bingo games by having the authority to publish games for players to join and invite other trusted users to also be Game Masters.

This invite will expire in 7 days.
  `;

  console.log(`📧 Sending game master invite email to: ${toEmail}`);
  console.log(`🔗 Game Master Invite URL: ${inviteUrl}`);
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

    console.log("✅ Game master email sent successfully!", emailData);
  } catch (error) {
    console.error("❌ Failed to send game master email:", error);
    throw new Error(
      `Failed to send game master invitation email: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

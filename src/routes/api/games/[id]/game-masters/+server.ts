import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";
import { sendGameMasterInviteEmail } from "$lib/email";

export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const { email, message, invitedBy } = await request.json();
    const gameId = params.id;

    if (!email || !invitedBy) {
      return json(
        { error: "Email and invitedBy are required" },
        { status: 400 }
      );
    }

    // Check if user is the game creator or an existing game master
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        gameMasters: true,
      },
    });

    if (!game) {
      return json({ error: "Game not found" }, { status: 404 });
    }

    const isGameCreator = game.gameMasterId === invitedBy;
    const isGameMaster = game.gameMasters.some((gm) => gm.userId === invitedBy);

    if (!isGameCreator && !isGameMaster) {
      return json(
        { error: "Only game masters can invite other game masters" },
        { status: 403 }
      );
    }

    // Check if already invited or is already a game master
    const existingInvite = await prisma.gameMasterInvite.findUnique({
      where: { gameId_email: { gameId, email } },
    });

    if (existingInvite && existingInvite.status === "PENDING") {
      return json(
        { error: "User already has a pending invitation" },
        { status: 400 }
      );
    }

    // Check if user is already a game master
    const existingProfile = await prisma.profile.findUnique({
      where: { email },
    });

    if (existingProfile) {
      const existingGameMaster = await prisma.gameMaster.findUnique({
        where: { gameId_userId: { gameId, userId: existingProfile.id } },
      });

      if (existingGameMaster) {
        return json(
          { error: "User is already a game master for this game" },
          { status: 400 }
        );
      }
    }

    // Get inviter details
    const inviter = await prisma.profile.findUnique({
      where: { id: invitedBy },
    });

    if (!inviter) {
      return json({ error: "Inviter not found" }, { status: 404 });
    }

    // Create invitation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to accept

    const invite = await prisma.gameMasterInvite.create({
      data: {
        gameId,
        email,
        invitedBy,
        userId: existingProfile?.id,
        expiresAt,
      },
      include: {
        game: true,
        inviter: true,
      },
    });

    // Send invitation email
    let emailSent = false;
    let emailErrorMsg = null;

    try {
      await sendGameMasterInviteEmail(email, {
        gameId,
        gameName: game.name,
        inviterName: inviter.displayName || inviter.email,
        inviterEmail: inviter.email,
        inviteToken: invite.token,
        isRegistered: !!existingProfile,
      });
      emailSent = true;
      console.log(
        `✅ Game master invitation email sent successfully to ${email}`
      );
    } catch (emailError) {
      console.error(
        `❌ Failed to send game master email to ${email}:`,
        emailError
      );
      emailErrorMsg = emailError;
      // Continue - invite was created even if email failed
    }

    console.log(`Game master invite created for ${email} to game ${game.name}`);

    return json({
      success: true,
      invite,
      emailSent,
      emailError: emailErrorMsg ? String(emailErrorMsg) : null,
    });
  } catch (error) {
    console.error("Error creating game master invite:", error);
    return json({ error: "Failed to create invite" }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ params, url }) => {
  try {
    const gameId = params.id;
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return json({ error: "Missing userId parameter" }, { status: 400 });
    }

    // Check if user is authorized to view this data
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        gameMasters: true,
      },
    });

    if (!game) {
      return json({ error: "Game not found" }, { status: 404 });
    }

    const isGameCreator = game.gameMasterId === userId;
    const isGameMaster = game.gameMasters.some((gm) => gm.userId === userId);

    if (!isGameCreator && !isGameMaster) {
      return json(
        { error: "Only game masters can view this data" },
        { status: 403 }
      );
    }

    // Get all game master invites for this game
    const invites = await prisma.gameMasterInvite.findMany({
      where: { gameId },
      include: {
        inviter: true,
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get current game masters
    const gameMasters = await prisma.gameMaster.findMany({
      where: { gameId },
      include: {
        user: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return json({ invites, gameMasters });
  } catch (error) {
    console.error("Error fetching game master data:", error);
    return json({ error: "Failed to fetch data" }, { status: 500 });
  }
};

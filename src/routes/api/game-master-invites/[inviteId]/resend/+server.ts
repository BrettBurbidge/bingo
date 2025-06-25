import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
import { sendGameMasterInviteEmail } from "$lib/email";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const inviteId = params.inviteId;
    const { userId } = await request.json();

    if (!userId) {
      return json({ error: "User ID is required" }, { status: 400 });
    }

    // Get the invite details with game and inviter info
    const invite = await prisma.gameMasterInvite.findUnique({
      where: { id: inviteId },
      include: {
        game: {
          include: {
            gameMasters: true,
          },
        },
        inviter: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    if (!invite) {
      return json({ error: "Invite not found" }, { status: 404 });
    }

    // Verify the user is authorized to resend this invite (game creator or game master)
    const isGameCreator = invite.game.gameMasterId === userId;
    const isGameMaster = invite.game.gameMasters.some(
      (gm) => gm.userId === userId
    );

    if (!isGameCreator && !isGameMaster) {
      return json(
        { error: "Only game masters can resend invites for this game" },
        { status: 403 }
      );
    }

    if (invite.status !== "PENDING") {
      return json(
        { error: "Only pending invites can be resent" },
        { status: 400 }
      );
    }

    // Check if invite has expired
    if (new Date() > invite.expiresAt) {
      return json(
        { error: "This invite has expired. Please create a new one." },
        { status: 400 }
      );
    }

    // Resend the game master invitation email
    let emailSent = false;
    let emailErrorMsg = null;

    try {
      await sendGameMasterInviteEmail(invite.email, {
        gameId: invite.gameId,
        gameName: invite.game.name,
        inviterName: invite.inviter.displayName || invite.inviter.email,
        inviterEmail: invite.inviter.email,
        inviteToken: invite.token,
        isRegistered: !!invite.user,
      });
      emailSent = true;
      console.log(
        `✅ Resent game master invitation email to ${invite.email} for game ${invite.game.name}`
      );
    } catch (emailError) {
      console.error(
        `❌ Failed to resend game master email to ${invite.email}:`,
        emailError
      );
      emailErrorMsg = emailError;
    }

    return json({
      emailSent,
      emailError: emailErrorMsg ? String(emailErrorMsg) : null,
    });
  } catch (error) {
    console.error("Error resending game master invite:", error);
    return json({ error: "Internal server error" }, { status: 500 });
  }
};

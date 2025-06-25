import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const GET: RequestHandler = async ({ params }) => {
  try {
    const token = params.token;

    const invite = await prisma.gameMasterInvite.findUnique({
      where: { token },
      include: {
        game: true,
        inviter: true,
        user: true,
      },
    });

    if (!invite) {
      return json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status !== "PENDING") {
      return json({ error: "Invite already responded to" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return json({ error: "Invite has expired" }, { status: 400 });
    }

    return json({ invite });
  } catch (error) {
    console.error("Error fetching game master invite:", error);
    return json({ error: "Failed to fetch invite" }, { status: 500 });
  }
};

export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const { action, userId, userEmail } = await request.json();
    const token = params.token;

    if (!action || !userId) {
      return json({ error: "Action and userId are required" }, { status: 400 });
    }

    const invite = await prisma.gameMasterInvite.findUnique({
      where: { token },
      include: {
        game: true,
      },
    });

    if (!invite) {
      return json({ error: "Invite not found" }, { status: 404 });
    }

    if (invite.status !== "PENDING") {
      return json({ error: "Invite already responded to" }, { status: 400 });
    }

    if (invite.expiresAt < new Date()) {
      return json({ error: "Invite has expired" }, { status: 400 });
    }

    if (action === "accept") {
      // Ensure user profile exists
      let profile = await prisma.profile.findUnique({
        where: { id: userId },
      });

      if (!profile) {
        if (!userEmail) {
          return json(
            { error: "User email required for new profiles" },
            { status: 400 }
          );
        }

        profile = await prisma.profile.create({
          data: {
            id: userId,
            email: userEmail,
            displayName: userEmail.split("@")[0],
          },
        });
      }

      // Create game master relationship
      await prisma.gameMaster.create({
        data: {
          gameId: invite.gameId,
          userId: userId,
        },
      });

      // Update invite status
      await prisma.gameMasterInvite.update({
        where: { token },
        data: {
          status: "ACCEPTED",
          userId: userId,
        },
      });

      return json({
        success: true,
        message: "You are now a game master for this game!",
        gameId: invite.gameId,
      });
    } else if (action === "decline") {
      // Update invite status
      await prisma.gameMasterInvite.update({
        where: { token },
        data: {
          status: "DECLINED",
          userId: userId,
        },
      });

      return json({
        success: true,
        message: "Invitation declined",
      });
    } else {
      return json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error responding to game master invite:", error);
    return json({ error: "Failed to respond to invite" }, { status: 500 });
  }
};

import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const inviteId = params.inviteId;
    const { userId } = await request.json();

    if (!userId) {
      return json({ error: "User ID is required" }, { status: 400 });
    }

    // Find the invite and verify permissions
    const invite = await prisma.gameMasterInvite.findUnique({
      where: { id: inviteId },
      include: {
        game: {
          include: {
            gameMasters: true,
          },
        },
      },
    });

    if (!invite) {
      return json({ error: "Invite not found" }, { status: 404 });
    }

    // Check if user has permission to delete this invite
    // Must be game creator or game master
    const isGameCreator = invite.game.gameMasterId === userId;
    const isGameMaster = invite.game.gameMasters.some(
      (gm) => gm.userId === userId
    );

    if (!isGameCreator && !isGameMaster) {
      return json({ error: "Permission denied" }, { status: 403 });
    }

    // Delete the invite
    await prisma.gameMasterInvite.delete({
      where: { id: inviteId },
    });

    return json({
      success: true,
      message: "Game master invite deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting game master invite:", error);
    return json({ error: "Failed to delete invite" }, { status: 500 });
  }
};

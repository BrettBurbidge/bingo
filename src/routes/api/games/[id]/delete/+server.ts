import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const DELETE: RequestHandler = async ({ params, request }) => {
  try {
    const { userId } = await request.json();
    const gameId = params.id;

    if (!userId || !gameId) {
      throw error(400, "User ID and Game ID are required");
    }

    // Verify user is the game master
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      select: {
        id: true,
        gameMasterId: true,
        name: true,
        status: true,
      },
    });

    if (!game) {
      throw error(404, "Game not found");
    }

    if (game.gameMasterId !== userId) {
      throw error(403, "Only the game master can delete this game");
    }

    // Delete the game (this will cascade delete all related data)
    await prisma.game.delete({
      where: { id: gameId },
    });

    return json({
      success: true,
      message: `Game "${game.name}" has been deleted successfully`,
    });
  } catch (err) {
    console.error("Error deleting game:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to delete game");
  }
};

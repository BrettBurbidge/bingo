import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const POST: RequestHandler = async ({ params, request }) => {
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
        publishedAt: true,
      },
    });

    if (!game) {
      throw error(404, "Game not found");
    }

    if (game.gameMasterId !== userId) {
      throw error(403, "Only the game master can unpublish this game");
    }

    if (!game.publishedAt) {
      throw error(400, "Game is not published");
    }

    // Unpublish the game
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: { publishedAt: null },
    });

    return json(updatedGame);
  } catch (err) {
    console.error("Error unpublishing game:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to unpublish game");
  }
};

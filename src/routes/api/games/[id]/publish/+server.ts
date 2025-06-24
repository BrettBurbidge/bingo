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
        status: true,
        publishedAt: true,
      },
    });

    if (!game) {
      throw error(404, "Game not found");
    }

    if (game.gameMasterId !== userId) {
      throw error(403, "Only the game master can publish this game");
    }

    if (game.status !== "ACTIVE") {
      throw error(400, "Only active games can be published");
    }

    if (game.publishedAt) {
      throw error(400, "Game is already published");
    }

    // Publish the game
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: { publishedAt: new Date() },
    });

    return json(updatedGame);
  } catch (err) {
    console.error("Error publishing game:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to publish game");
  }
};

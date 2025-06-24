import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const GET: RequestHandler = async ({ params }) => {
  try {
    const gameId = params.id;

    if (!gameId) {
      throw error(400, "Game ID is required");
    }

    // Get published game with all participants
    const game = await prisma.game.findUnique({
      where: {
        id: gameId,
        publishedAt: {
          not: null,
        },
      },
      include: {
        gameMaster: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
          orderBy: {
            score: "desc",
          },
        },
        guestParticipants: {
          orderBy: {
            score: "desc",
          },
        },
      },
    });

    if (!game) {
      throw error(404, "Published game not found");
    }

    if (game.status !== "ACTIVE") {
      throw error(400, "Game is not active");
    }

    return json(game);
  } catch (err) {
    console.error("Error fetching published game:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to fetch published game");
  }
};

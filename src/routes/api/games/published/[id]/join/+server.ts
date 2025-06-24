import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { guestName } = await request.json();
    const gameId = params.id;

    if (!guestName?.trim() || !gameId) {
      throw error(400, "Guest name and Game ID are required");
    }

    const trimmedName = guestName.trim();

    // Verify game exists and is published and active
    const game = await prisma.game.findUnique({
      where: {
        id: gameId,
        publishedAt: {
          not: null,
        },
      },
      select: {
        id: true,
        status: true,
        wordList: true,
      },
    });

    if (!game) {
      throw error(404, "Published game not found");
    }

    if (game.status !== "ACTIVE") {
      throw error(400, "Game is not active");
    }

    // Check if guest name is already taken in this game
    const existingGuest = await prisma.guestParticipant.findUnique({
      where: {
        gameId_guestName: {
          gameId: gameId,
          guestName: trimmedName,
        },
      },
    });

    if (existingGuest) {
      throw error(409, "Name is already taken in this game");
    }

    // Check if authenticated user with same display name exists
    const authParticipants = await prisma.gameParticipant.findMany({
      where: { gameId },
      include: {
        user: {
          select: {
            displayName: true,
            email: true,
          },
        },
      },
    });

    const nameTaken = authParticipants.some(
      (p) =>
        p.user.displayName?.toLowerCase() === trimmedName.toLowerCase() ||
        p.user.email?.split("@")[0].toLowerCase() === trimmedName.toLowerCase()
    );

    if (nameTaken) {
      throw error(409, "Name is already taken in this game");
    }

    // Generate random bingo board from game's word list
    function generateBingoBoard(wordList: string[]): string[] {
      if (wordList.length < 24) {
        throw new Error("Word list must contain at least 24 words");
      }

      const shuffled = [...wordList].sort(() => 0.5 - Math.random());
      const board = shuffled.slice(0, 24);

      // Insert "FREE" at position 12 (center)
      board.splice(12, 0, "FREE");

      return board;
    }

    const boardData = generateBingoBoard(game.wordList);

    // Create guest participant
    const guestParticipant = await prisma.guestParticipant.create({
      data: {
        gameId: gameId,
        guestName: trimmedName,
        boardData: boardData,
        completedCells: [12], // Center cell is always completed
        score: 1, // Starting score for FREE space
      },
    });

    return json(guestParticipant);
  } catch (err) {
    console.error("Error joining game as guest:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to join game as guest");
  }
};

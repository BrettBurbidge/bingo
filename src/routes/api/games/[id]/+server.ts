import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
import { calculateScore } from "$lib/scoring";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  try {
    const gameId = params.id;

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        gameMaster: true,
        winner: true,
        participants: {
          include: {
            user: true,
          },
        },
        guestParticipants: true,
      },
    });

    if (!game) {
      return json({ error: "Game not found" }, { status: 404 });
    }

    return json(game);
  } catch (error) {
    console.error("Error fetching game:", error);
    return json({ error: "Failed to fetch game" }, { status: 500 });
  }
};

export const PUT: RequestHandler = async ({ request, params }) => {
  try {
    const gameId = params.id;
    const { userId, completedCells, photoUrls } = await request.json();

    if (!userId || !Array.isArray(completedCells)) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get the game to access special squares and history
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return json({ error: "Game not found" }, { status: 404 });
    }

    // Get current participant to check for new squares
    const currentParticipant = await prisma.gameParticipant.findUnique({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
    });

    if (!currentParticipant) {
      return json({ error: "Participant not found" }, { status: 404 });
    }

    // Update mark history for first-to-mark bonus tracking
    const newSquares = completedCells.filter(
      (cell) => !currentParticipant.completedCells.includes(cell)
    );
    let updatedMarkHistory = [...(game.squareMarkHistory as any[])];

    for (const newSquare of newSquares) {
      const existingHistory = updatedMarkHistory.find(
        (h: any) => h.cellIndex === newSquare
      );
      if (!existingHistory) {
        updatedMarkHistory.push({
          cellIndex: newSquare,
          firstParticipantId: currentParticipant.id,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update game mark history
    await prisma.game.update({
      where: { id: gameId },
      data: {
        squareMarkHistory: updatedMarkHistory,
      },
    });

    // Calculate advanced score using new scoring system
    const gameWithHistory = { ...game, squareMarkHistory: updatedMarkHistory };
    const { score, breakdown } = calculateScore(
      completedCells,
      gameWithHistory,
      currentParticipant.id
    );

    // No more win conditions - games continue running based on leaderboard/points
    // Players no longer "win" by getting 5 in a row

    const updateData: any = {
      completedCells,
      score,
      scoreBreakdown: breakdown,
      hasWon: false, // Always false - no more traditional wins
    };

    // Include photoUrls if provided
    if (photoUrls && Array.isArray(photoUrls)) {
      updateData.photoUrls = photoUrls;
    }

    const participant = await prisma.gameParticipant.update({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
      data: updateData,
      include: {
        user: true,
      },
    });

    // Game continues running - no automatic completion or winner setting
    // Games can only be manually ended by game masters
    // Winner is determined by highest score on the leaderboard

    return json(participant);
  } catch (error) {
    console.error("Error updating participant:", error);
    return json({ error: "Failed to update participant" }, { status: 500 });
  }
};

// Remove the checkForWin function as it's no longer needed
// Games now continue running with points-based leaderboard scoring

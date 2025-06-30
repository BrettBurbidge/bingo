import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";
import { calculateScore } from "$lib/scoring";

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const { guestId, completedCells, photoUrls } = await request.json();
    const gameId = params.id;

    if (!guestId || !gameId || !Array.isArray(completedCells)) {
      throw error(400, "Guest ID, Game ID, and completed cells are required");
    }

    // Verify guest participant exists and game is published and active
    const guestParticipant = await prisma.guestParticipant.findUnique({
      where: { id: guestId },
      include: {
        game: {
          select: {
            id: true,
            status: true,
            publishedAt: true,
            bonusSquare: true,
            wildcardSquare: true,
            squareMarkHistory: true,
          },
        },
      },
    });

    if (!guestParticipant) {
      throw error(404, "Guest participant not found");
    }

    if (guestParticipant.gameId !== gameId) {
      throw error(400, "Guest does not belong to this game");
    }

    if (!guestParticipant.game.publishedAt) {
      throw error(400, "Game is not published");
    }

    if (guestParticipant.game.status === "SETUP") {
      throw error(400, "Game is not yet available");
    }

    // Update mark history for first-to-mark bonus tracking
    const newSquares = completedCells.filter(
      (cell) => !guestParticipant.completedCells.includes(cell)
    );
    let updatedMarkHistory = [
      ...(guestParticipant.game.squareMarkHistory as any[]),
    ];

    for (const newSquare of newSquares) {
      const existingHistory = updatedMarkHistory.find(
        (h: any) => h.cellIndex === newSquare
      );
      if (!existingHistory) {
        updatedMarkHistory.push({
          cellIndex: newSquare,
          firstParticipantId: guestParticipant.id,
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
    const gameWithHistory = {
      ...guestParticipant.game,
      squareMarkHistory: updatedMarkHistory,
    };
    const { score, breakdown } = calculateScore(
      completedCells,
      gameWithHistory,
      guestParticipant.id
    );

    // No more win conditions - games continue running based on leaderboard/points
    // Players no longer "win" by getting 5 in a row

    // Prepare update data
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

    // Update guest participant
    const updatedParticipant = await prisma.guestParticipant.update({
      where: { id: guestId },
      data: updateData,
    });

    // Game continues running - no automatic completion based on patterns
    // Games can only be manually ended by game masters

    return json(updatedParticipant);
  } catch (err) {
    console.error("Error updating guest score:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to update guest score");
  }
};

// Remove the checkWinCondition function as it's no longer needed
// Games now continue running with points-based leaderboard scoring

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

    // Check for win condition (5 in a row)
    const hasWon = checkWinCondition(completedCells);

    // Prepare update data
    const updateData: any = {
      completedCells,
      score,
      scoreBreakdown: breakdown,
      hasWon,
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

    // If this is the first person to win and game is still active, mark the game as completed
    if (
      hasWon &&
      !guestParticipant.hasWon &&
      guestParticipant.game.status === "ACTIVE"
    ) {
      await prisma.game.update({
        where: { id: gameId },
        data: { status: "COMPLETED" },
      });
    }

    return json(updatedParticipant);
  } catch (err) {
    console.error("Error updating guest score:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to update guest score");
  }
};

function checkWinCondition(completedCells: number[]): boolean {
  // Bingo win patterns (5x5 grid)
  const winPatterns = [
    // Rows
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Columns
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonals
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  return winPatterns.some((pattern) =>
    pattern.every((cell) => completedCells.includes(cell))
  );
}

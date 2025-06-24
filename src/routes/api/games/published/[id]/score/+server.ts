import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const PUT: RequestHandler = async ({ params, request }) => {
  try {
    const { guestId, completedCells } = await request.json();
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

    if (guestParticipant.game.status !== "ACTIVE") {
      throw error(400, "Game is not active");
    }

    // Calculate score (number of completed cells)
    const score = completedCells.length;

    // Check for win condition (5 in a row)
    const hasWon = checkWinCondition(completedCells);

    // Update guest participant
    const updatedParticipant = await prisma.guestParticipant.update({
      where: { id: guestId },
      data: {
        completedCells,
        score,
        hasWon,
      },
    });

    // If this is the first person to win, mark the game as completed
    if (hasWon && !guestParticipant.hasWon) {
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

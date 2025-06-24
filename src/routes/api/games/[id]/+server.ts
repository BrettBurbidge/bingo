import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
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
    const { userId, completedCells } = await request.json();

    if (!userId || !Array.isArray(completedCells)) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    // Calculate score (number of completed cells)
    const score = completedCells.length;

    // Check for win condition (5 in a row)
    const hasWon = checkForWin(completedCells);

    const participant = await prisma.gameParticipant.update({
      where: {
        gameId_userId: {
          gameId,
          userId,
        },
      },
      data: {
        completedCells,
        score,
        hasWon,
      },
      include: {
        user: true,
      },
    });

    // If this participant won and no one has won yet, mark them as winner
    if (hasWon) {
      const game = await prisma.game.findUnique({
        where: { id: gameId },
      });

      if (game && !game.winnerId) {
        await prisma.game.update({
          where: { id: gameId },
          data: {
            winnerId: userId,
            status: "COMPLETED",
          },
        });
      }
    }

    return json(participant);
  } catch (error) {
    console.error("Error updating participant:", error);
    return json({ error: "Failed to update participant" }, { status: 500 });
  }
};

function checkForWin(completedCells: number[]): boolean {
  // Define winning patterns (5 in a row: horizontal, vertical, diagonal)
  const winningPatterns = [
    // Horizontal
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19],
    [20, 21, 22, 23, 24],
    // Vertical
    [0, 5, 10, 15, 20],
    [1, 6, 11, 16, 21],
    [2, 7, 12, 17, 22],
    [3, 8, 13, 18, 23],
    [4, 9, 14, 19, 24],
    // Diagonal
    [0, 6, 12, 18, 24],
    [4, 8, 12, 16, 20],
  ];

  // Check if any winning pattern is completely filled
  return winningPatterns.some((pattern) =>
    pattern.every((cell) => completedCells.includes(cell))
  );
}

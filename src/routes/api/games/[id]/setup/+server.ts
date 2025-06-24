import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
import { generateGameSpecialSquares } from "$lib/scoring";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const gameId = params.id;
    const { wordList, gameMasterId } = await request.json();

    if (!wordList || !Array.isArray(wordList) || wordList.length !== 24) {
      return json({ error: "Must provide exactly 24 words" }, { status: 400 });
    }

    if (!gameMasterId) {
      return json({ error: "Game master ID required" }, { status: 400 });
    }

    // Verify the game exists and user is the game master
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return json({ error: "Game not found" }, { status: 404 });
    }

    if (game.gameMasterId !== gameMasterId) {
      return json(
        { error: "Only game master can setup the game" },
        { status: 403 }
      );
    }

    if (game.status !== "SETUP") {
      return json({ error: "Game is not in setup phase" }, { status: 400 });
    }

    // Generate a randomized board for the game master
    const gameMasterBoard = generateRandomizedBoard(wordList);

    // Generate special squares for advanced scoring
    const { bonusSquare, wildcardSquare } = generateGameSpecialSquares();

    // Update game with words and start it
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        wordList,
        bonusSquare,
        wildcardSquare,
        status: "ACTIVE",
      },
    });

    // Auto-join the game master as a participant
    await prisma.gameParticipant.create({
      data: {
        gameId,
        userId: gameMasterId,
        boardData: gameMasterBoard,
        completedCells: [12], // Center cell starts completed
      },
    });

    return json(updatedGame);
  } catch (error) {
    console.error("Error setting up game:", error);
    return json({ error: "Failed to setup game" }, { status: 500 });
  }
};

function generateRandomizedBoard(wordList: string[]): string[] {
  // Shuffle the word list
  const shuffled = [...wordList].sort(() => Math.random() - 0.5);

  // Create 25-cell board with FREE SPACE in center (index 12)
  const board: string[] = [];
  let wordIndex = 0;

  for (let i = 0; i < 25; i++) {
    if (i === 12) {
      board[i] = "FREE SPACE";
    } else {
      board[i] = shuffled[wordIndex];
      wordIndex++;
    }
  }

  return board;
}

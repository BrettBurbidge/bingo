import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
import { generateGameSpecialSquares } from "$lib/scoring";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const gameId = params.id;
    const { wordList, cardTypes, gameMasterId } = await request.json();

    if (!wordList || !Array.isArray(wordList) || wordList.length !== 24) {
      return json({ error: "Must provide exactly 24 words" }, { status: 400 });
    }

    if (!cardTypes || !Array.isArray(cardTypes) || cardTypes.length !== 24) {
      return json(
        { error: "Must provide exactly 24 card types" },
        { status: 400 }
      );
    }

    // Validate card types are either "see" or "action"
    const validTypes = cardTypes.every(
      (type) => type === "see" || type === "action"
    );
    if (!validTypes) {
      return json(
        { error: "Card types must be either 'see' or 'action'" },
        { status: 400 }
      );
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
    const { boardData, cardTypeData } = generateRandomizedBoard(
      wordList,
      cardTypes
    );

    // Generate special squares for advanced scoring
    const { bonusSquare, wildcardSquare } = generateGameSpecialSquares();

    // Update game with words, card types and start it
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        wordList,
        cardTypes,
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
        boardData: boardData,
        cardTypeData: cardTypeData,
        completedCells: [12], // Center cell starts completed
      },
    });

    return json(updatedGame);
  } catch (error) {
    console.error("Error setting up game:", error);
    return json({ error: "Failed to setup game" }, { status: 500 });
  }
};

function generateRandomizedBoard(
  wordList: string[],
  cardTypes: string[]
): { boardData: string[]; cardTypeData: string[] } {
  // Create combined array of words and their types
  const combined = wordList.map((word, index) => ({
    word,
    type: cardTypes[index],
  }));

  // Shuffle the combined array
  const shuffled = [...combined].sort(() => Math.random() - 0.5);

  // Create 25-cell board with FREE SPACE in center (index 12)
  const boardData: string[] = [];
  const cardTypeData: string[] = [];
  let wordIndex = 0;

  for (let i = 0; i < 25; i++) {
    if (i === 12) {
      boardData[i] = "FREE SPACE";
      cardTypeData[i] = "free"; // Special type for free space
    } else {
      boardData[i] = shuffled[wordIndex].word;
      cardTypeData[i] = shuffled[wordIndex].type;
      wordIndex++;
    }
  }

  return { boardData, cardTypeData };
}

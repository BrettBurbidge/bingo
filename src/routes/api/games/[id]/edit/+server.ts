import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
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
        { error: "Only game master can edit the game" },
        { status: 403 }
      );
    }

    // Don't allow editing games in SETUP phase (use setup endpoint instead)
    if (game.status === "SETUP") {
      return json(
        {
          error: "Games in setup phase should use the setup endpoint",
        },
        { status: 400 }
      );
    }

    // Update game with new words and card types (keep existing status)
    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        wordList,
        cardTypes,
        // Keep existing status, bonusSquare, wildcardSquare, etc.
      },
    });

    // Note: We don't update participant board data here since that would affect ongoing games
    // Players keep their existing randomized boards but see updated word list in game info

    return json({
      success: true,
      game: updatedGame,
      message: "Game words and types updated successfully",
    });
  } catch (error) {
    console.error("Error editing game:", error);
    return json({ error: "Failed to edit game" }, { status: 500 });
  }
};

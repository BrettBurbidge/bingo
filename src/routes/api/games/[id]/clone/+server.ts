import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { userId, newGameName } = await request.json();
    const sourceGameId = params.id;

    if (!userId || !sourceGameId) {
      throw error(400, "User ID and Source Game ID are required");
    }

    if (!newGameName || newGameName.trim() === "") {
      throw error(400, "New game name is required");
    }

    // Get the source game
    const sourceGame = await prisma.game.findUnique({
      where: { id: sourceGameId },
      select: {
        id: true,
        name: true,
        wordList: true,
        cardTypes: true,
        gameMasterId: true,
        participants: {
          where: { userId },
          select: { id: true },
        },
        gameMasters: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    if (!sourceGame) {
      throw error(404, "Source game not found");
    }

    // Check if user has access to this game (is game master, additional game master, or participant)
    const isGameMaster = sourceGame.gameMasterId === userId;
    const isAdditionalGameMaster = sourceGame.gameMasters.length > 0;
    const isParticipant = sourceGame.participants.length > 0;

    if (!isGameMaster && !isAdditionalGameMaster && !isParticipant) {
      throw error(403, "You don't have access to clone this game");
    }

    // Ensure user profile exists
    let profile = await prisma.profile.findUnique({
      where: { id: userId },
    });

    if (!profile) {
      throw error(400, "User profile not found");
    }

    // Create new game with copied data
    const newGame = await prisma.game.create({
      data: {
        name: newGameName.trim(),
        gameMasterId: userId,
        status: "SETUP",
        wordList: sourceGame.wordList || [],
        cardTypes: sourceGame.cardTypes || [],
        // Don't copy: participants, photos, scores, special squares, etc.
      },
    });

    return json({
      success: true,
      game: newGame,
      message: `Game "${newGameName}" created as a copy of "${sourceGame.name}"`,
    });
  } catch (err) {
    console.error("Error cloning game:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Failed to clone game");
  }
};

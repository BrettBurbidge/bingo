import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/prisma";

export const POST: RequestHandler = async ({ request, params }) => {
  try {
    const gameId = params.id;

    if (!gameId) {
      return json({ error: "Game ID is required" }, { status: 400 });
    }

    const body = await request.json();
    const { email, displayName } = body;

    if (!email || typeof email !== "string" || !email.trim()) {
      return json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    const trimmedEmail = email.trim().toLowerCase();
    const finalDisplayName = displayName?.trim() || trimmedEmail.split("@")[0];

    // Get the published game
    const game = await prisma.game.findFirst({
      where: {
        id: gameId,
        publishedAt: {
          not: null,
        },
      },
      select: {
        id: true,
        name: true,
        status: true,
        wordList: true,
        cardTypes: true,
      },
    });

    if (!game) {
      return json({ error: "Published game not found" }, { status: 404 });
    }

    if (game.status !== "ACTIVE") {
      return json({ error: "Game is not active" }, { status: 400 });
    }

    // Check if guest already exists
    const existingGuest = await prisma.guestParticipant.findFirst({
      where: {
        gameId: gameId,
        email: trimmedEmail,
      },
    });

    if (existingGuest) {
      // Return existing guest (allows rejoining from different devices)
      return json(existingGuest);
    }

    // Generate random bingo board from game's word list
    function generateBingoBoard(
      wordList: string[],
      cardTypes: string[]
    ): { boardData: string[]; cardTypeData: string[] } {
      if (wordList.length < 24) {
        throw new Error("Word list must contain at least 24 words");
      }

      // Create combined array of words and their types
      const combined = wordList.map((word, index) => ({
        word,
        type: cardTypes[index] || "see", // Default to "see" if no type specified
      }));

      const shuffled = [...combined].sort(() => 0.5 - Math.random());
      const words = shuffled.slice(0, 24);

      // Create board data and card type data
      const boardData: string[] = [];
      const cardTypeData: string[] = [];

      // Insert "FREE" at position 12 (center)
      for (let i = 0; i < 25; i++) {
        if (i === 12) {
          boardData[i] = "FREE";
          cardTypeData[i] = "free";
        } else {
          const wordIndex = i < 12 ? i : i - 1;
          boardData[i] = words[wordIndex].word;
          cardTypeData[i] = words[wordIndex].type;
        }
      }

      return { boardData, cardTypeData };
    }

    const { boardData, cardTypeData } = generateBingoBoard(
      game.wordList,
      game.cardTypes || []
    );

    // Create guest participant
    const guestParticipant = await prisma.guestParticipant.create({
      data: {
        gameId: gameId,
        email: trimmedEmail,
        guestName: finalDisplayName,
        boardData: boardData,
        cardTypeData: cardTypeData,
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

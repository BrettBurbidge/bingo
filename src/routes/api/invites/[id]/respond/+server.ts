import { json } from "@sveltejs/kit";
import { prisma } from "$lib/prisma";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ params, request }) => {
  try {
    const { id } = params;
    const { status } = await request.json();

    if (!status || !["ACCEPTED", "DECLINED"].includes(status)) {
      return json({ error: "Invalid status" }, { status: 400 });
    }

    const invite = await prisma.gameInvite.update({
      where: { id },
      data: { status },
    });

    // If accepted, add user to game participants
    if (status === "ACCEPTED" && invite.userId) {
      await prisma.gameParticipant.create({
        data: {
          gameId: invite.gameId,
          userId: invite.userId,
          completedCells: [12], // Center cell (index 12 in 0-24 grid) is free
          score: 1, // Start with 1 for the free space
        },
      });
    }

    return json(invite);
  } catch (error) {
    console.error("Error responding to invite:", error);
    return json({ error: "Failed to respond to invite" }, { status: 500 });
  }
};

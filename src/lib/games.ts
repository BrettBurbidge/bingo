import type {
  Game,
  GameParticipant,
  GameInvite,
  Profile,
  GameInviteStatus,
} from "@prisma/client";

// Type aliases for better developer experience
type GameWithRelations = Game & {
  gameMaster: Profile;
  participants: (GameParticipant & { user: Profile })[];
};

type GameParticipantWithUser = GameParticipant & { user: Profile };

type GameInviteWithRelations = GameInvite & {
  game: Game;
  user: Profile;
  inviter: Profile;
};

export async function createGame(
  name: string,
  boardData: string[][],
  gameMasterId: string
): Promise<Game> {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      gameMasterId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create game");
  }

  return response.json();
}

export async function getGame(
  gameId: string
): Promise<GameWithRelations | null> {
  const response = await fetch(`/api/games/${gameId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch game");
  }

  return response.json();
}

export async function getUserGames(userId: string): Promise<Game[]> {
  const response = await fetch(`/api/games?userId=${userId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch games");
  }

  return response.json();
}

export async function joinGame(
  gameId: string,
  userId: string
): Promise<GameParticipant> {
  const response = await fetch(`/api/games/${gameId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to join game");
  }

  return response.json();
}

export async function getGameParticipants(
  gameId: string
): Promise<GameParticipantWithUser[]> {
  const response = await fetch(`/api/games/${gameId}/participants`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch participants");
  }

  return response.json();
}

export async function updateParticipantScore(
  gameId: string,
  userId: string,
  completedCells: number[],
  photoUrls?: string[]
): Promise<GameParticipant> {
  const response = await fetch(`/api/games/${gameId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      completedCells,
      photoUrls,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update participant score");
  }

  return response.json();
}

export async function inviteUserToGame(
  gameId: string,
  userEmail: string,
  invitedBy: string
): Promise<GameInvite> {
  const response = await fetch("/api/invites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      gameId,
      userEmail,
      invitedBy,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to invite user");
  }

  return response.json();
}

export async function getUserInvites(
  userId: string
): Promise<GameInviteWithRelations[]> {
  const response = await fetch(`/api/invites?userId=${userId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch invites");
  }

  return response.json();
}

export async function respondToInvite(
  inviteId: string,
  status: "ACCEPTED" | "DECLINED"
): Promise<GameInvite> {
  const response = await fetch(`/api/invites/${inviteId}/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to respond to invite");
  }

  return response.json();
}

export function generateBingoBoard(): string[][] {
  // Generate a 5x5 bingo board with empty strings for now
  // User can customize the content later
  const board: string[][] = [];

  for (let i = 0; i < 5; i++) {
    const row: string[] = [];
    for (let j = 0; j < 5; j++) {
      if (i === 2 && j === 2) {
        row.push("FREE"); // Center cell is always free
      } else {
        row.push(`Cell ${i * 5 + j + 1}`); // Placeholder text
      }
    }
    board.push(row);
  }

  return board;
}

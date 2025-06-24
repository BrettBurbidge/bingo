import type {
  Game,
  GameParticipant,
  GameInvite,
  Profile,
  GuestParticipant,
} from "@prisma/client";

// Type aliases for better developer experience
export type GameWithRelations = Game & {
  gameMaster: Profile;
  participants: (GameParticipant & { user: Profile })[];
  guestParticipants?: GuestParticipant[];
};

export type GameParticipantWithUser = GameParticipant & { user: Profile };

export type GameInviteWithRelations = GameInvite & {
  game: Game;
  user: Profile | null; // Can be null for unregistered users
  inviter?: Profile; // Optional for some queries
};

export type PublishedGameWithRelations = Game & {
  gameMaster: Profile;
  participants: (GameParticipant & { user: Profile })[];
  guestParticipants: GuestParticipant[];
};

export async function createGame(
  name: string,
  gameMasterId: string,
  userEmail: string
): Promise<Game> {
  const response = await fetch("/api/games", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      gameMasterId,
      userEmail,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create game");
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

export async function setupGame(
  gameId: string,
  wordList: string[],
  gameMasterId: string
): Promise<Game> {
  const response = await fetch(`/api/games/${gameId}/setup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wordList,
      gameMasterId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to setup game");
  }

  return response.json();
}

export async function joinGame(
  gameId: string,
  userId: string,
  userEmail?: string,
  displayName?: string
): Promise<GameParticipantWithUser> {
  const response = await fetch(`/api/games/${gameId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      userEmail,
      displayName,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to join game");
  }

  return response.json();
}

export async function getGame(gameId: string): Promise<GameWithRelations> {
  const response = await fetch(`/api/games/${gameId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch game");
  }

  return response.json();
}

export async function updateParticipantScore(
  gameId: string,
  userId: string,
  completedCells: number[]
): Promise<GameParticipantWithUser> {
  const response = await fetch(`/api/games/${gameId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      completedCells,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update score");
  }

  return response.json();
}

export async function getSentInvites(
  userId: string
): Promise<GameInviteWithRelations[]> {
  const response = await fetch(`/api/invites/sent?userId=${userId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch sent invites");
  }

  return response.json();
}

export async function deleteInvite(
  inviteId: string,
  userId: string
): Promise<void> {
  const response = await fetch(`/api/invites/${inviteId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete invite");
  }
}

// Game-specific invite management functions
export async function getGameInvites(
  gameId: string,
  userId: string
): Promise<GameInviteWithRelations[]> {
  const response = await fetch(`/api/games/${gameId}/invites?userId=${userId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch game invites");
  }

  return response.json();
}

export async function deleteGameInvite(
  gameId: string,
  inviteId: string,
  userId: string
): Promise<void> {
  const response = await fetch(`/api/games/${gameId}/invites/${inviteId}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete invite");
  }
}

export async function resendGameInvite(
  gameId: string,
  inviteId: string,
  userId: string
): Promise<{ emailSent: boolean; emailError?: string }> {
  const response = await fetch(
    `/api/games/${gameId}/invites/${inviteId}/resend`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId }),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to resend invite");
  }

  return response.json();
}

// Published Games Functions
export async function publishGame(
  gameId: string,
  userId: string
): Promise<Game> {
  const response = await fetch(`/api/games/${gameId}/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to publish game");
  }

  return response.json();
}

export async function unpublishGame(
  gameId: string,
  userId: string
): Promise<Game> {
  const response = await fetch(`/api/games/${gameId}/unpublish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to unpublish game");
  }

  return response.json();
}

export async function getPublishedGame(
  gameId: string
): Promise<PublishedGameWithRelations> {
  const response = await fetch(`/api/games/published/${gameId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch published game");
  }

  return response.json();
}

export async function joinGameAsGuest(
  gameId: string,
  guestName: string
): Promise<GuestParticipant> {
  const response = await fetch(`/api/games/published/${gameId}/join`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ guestName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to join game as guest");
  }

  return response.json();
}

export async function updateGuestParticipantScore(
  gameId: string,
  guestId: string,
  completedCells: number[]
): Promise<GuestParticipant> {
  const response = await fetch(`/api/games/published/${gameId}/score`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      guestId,
      completedCells,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to update guest score");
  }

  return response.json();
}

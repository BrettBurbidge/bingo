// Game Master client functions

export interface GameMasterInvite {
  id: string;
  gameId: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED";
  createdAt: string;
  expiresAt: string;
  token: string;
  inviter: {
    id: string;
    email: string;
    displayName?: string;
  };
  user?: {
    id: string;
    email: string;
    displayName?: string;
  };
  game: {
    id: string;
    name: string;
  };
}

export interface GameMaster {
  id: string;
  gameId: string;
  userId: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    displayName?: string;
  };
}

export interface GameMasterData {
  invites: GameMasterInvite[];
  gameMasters: GameMaster[];
}

export async function inviteGameMaster(
  gameId: string,
  email: string,
  invitedBy: string,
  message?: string
): Promise<GameMasterInvite> {
  const response = await fetch(`/api/games/${gameId}/game-masters`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      invitedBy,
      message,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to invite game master");
  }

  const data = await response.json();
  return data.invite;
}

export async function getGameMasterData(
  gameId: string,
  userId: string
): Promise<GameMasterData> {
  const response = await fetch(
    `/api/games/${gameId}/game-masters?userId=${userId}`
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch game master data");
  }

  return response.json();
}

export async function getGameMasterInvite(
  token: string
): Promise<GameMasterInvite> {
  const response = await fetch(`/api/game-master-invites/${token}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to fetch invite");
  }

  const data = await response.json();
  return data.invite;
}

export async function respondToGameMasterInvite(
  token: string,
  action: "accept" | "decline",
  userId: string,
  userEmail?: string
): Promise<{ success: boolean; message: string; gameId?: string }> {
  const response = await fetch(`/api/game-master-invites/${token}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action,
      userId,
      userEmail,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to respond to invite");
  }

  return response.json();
}

export async function resendGameMasterInvite(
  inviteId: string,
  userId: string
): Promise<{ emailSent: boolean; emailError?: string }> {
  const response = await fetch(`/api/game-master-invites/${inviteId}/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to resend game master invite");
  }

  return response.json();
}

export async function deleteGameMasterInvite(
  inviteId: string,
  userId: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`/api/game-master-invites/${inviteId}/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete game master invite");
  }

  return response.json();
}

export function isUserGameMaster(
  userId: string,
  gameMasters: GameMaster[]
): boolean {
  return gameMasters.some((gm) => gm.userId === userId);
}

export function isUserGameCreatorOrMaster(
  userId: string,
  gameCreatorId: string,
  gameMasters: GameMaster[]
): boolean {
  return userId === gameCreatorId || isUserGameMaster(userId, gameMasters);
}

// Scoring Rules for Bingo Game

export const scoringRules = {
  markSquare: {
    points: 1,
    description: "Awarded for every square marked",
  },
  firstToMarkSquare: {
    points: 2,
    condition:
      "Player is the first to mark a specific square (selected at random per game)",
    description: "Bonus for being first to mark a given square",
  },
  miniLineBonus: {
    points: 4,
    condition:
      "Player marks any 4 connected squares (horizontal, vertical, or diagonal)",
    description: "Mini-line of 4 squares",
  },
  diagonalLineBonus: {
    points: 5,
    condition:
      "Player completes a full diagonal line (top-left to bottom-right OR top-right to bottom-left)",
    description: "Full diagonal line",
  },
  fiveInRowBonus: {
    points: 6,
    condition: "Player completes 5 squares in a row (horizontal or vertical)",
    description: "Full line of 5",
  },
  cornerBonus: {
    points: 7,
    condition: "Player marks all 4 corners of the board",
    description: "All 4 corner squares",
  },
  borderBonus: {
    points: 10,
    condition:
      "Player marks all squares along the outer edge (perimeter) of the board",
    description: "Full outer border",
  },
  wildcardBonus: {
    multiplier: 2,
    condition: "Square is marked and it is the Wild Card of the game",
    description: "Wild Card square (selected at random each game)",
  },
};

export interface ScoreEntry {
  type: string;
  points: number;
  description: string;
  cellIndex?: number;
  timestamp: Date;
}

// Helper functions for scoring calculations
export function calculateScore(
  completedCells: number[],
  game: any,
  participantId: string
): { score: number; breakdown: ScoreEntry[] } {
  const breakdown: ScoreEntry[] = [];
  let totalScore = 0;

  // Basic point for each marked square
  for (const cellIndex of completedCells) {
    let points = scoringRules.markSquare.points;
    let description = scoringRules.markSquare.description;

    // Check if it's the wildcard square
    if (game.wildcardSquare === cellIndex) {
      points *= scoringRules.wildcardBonus.multiplier;
      description = `${description} (Wildcard x${scoringRules.wildcardBonus.multiplier})`;
    }

    breakdown.push({
      type: "markSquare",
      points,
      description,
      cellIndex,
      timestamp: new Date(),
    });

    totalScore += points;
  }

  // Check for bonus square (first to mark)
  if (game.bonusSquare !== null && completedCells.includes(game.bonusSquare)) {
    const markHistory = game.squareMarkHistory || [];
    const bonusSquareHistory = markHistory.find(
      (h: any) => h.cellIndex === game.bonusSquare
    );

    if (
      bonusSquareHistory &&
      bonusSquareHistory.firstParticipantId === participantId
    ) {
      breakdown.push({
        type: "firstToMarkSquare",
        points: scoringRules.firstToMarkSquare.points,
        description: scoringRules.firstToMarkSquare.description,
        cellIndex: game.bonusSquare,
        timestamp: new Date(),
      });
      totalScore += scoringRules.firstToMarkSquare.points;
    }
  }

  // Check for mini-lines (4 in a row)
  const miniLines = findMiniLines(completedCells);
  for (const line of miniLines) {
    breakdown.push({
      type: "miniLineBonus",
      points: scoringRules.miniLineBonus.points,
      description: scoringRules.miniLineBonus.description,
      timestamp: new Date(),
    });
    totalScore += scoringRules.miniLineBonus.points;
  }

  // Check for diagonal lines
  const diagonalLines = findDiagonalLines(completedCells);
  for (const line of diagonalLines) {
    breakdown.push({
      type: "diagonalLineBonus",
      points: scoringRules.diagonalLineBonus.points,
      description: scoringRules.diagonalLineBonus.description,
      timestamp: new Date(),
    });
    totalScore += scoringRules.diagonalLineBonus.points;
  }

  // Check for full lines (5 in a row)
  const fullLines = findFullLines(completedCells);
  for (const line of fullLines) {
    breakdown.push({
      type: "fiveInRowBonus",
      points: scoringRules.fiveInRowBonus.points,
      description: scoringRules.fiveInRowBonus.description,
      timestamp: new Date(),
    });
    totalScore += scoringRules.fiveInRowBonus.points;
  }

  // Check for corner bonus
  if (hasAllCorners(completedCells)) {
    breakdown.push({
      type: "cornerBonus",
      points: scoringRules.cornerBonus.points,
      description: scoringRules.cornerBonus.description,
      timestamp: new Date(),
    });
    totalScore += scoringRules.cornerBonus.points;
  }

  // Check for border bonus
  if (hasFullBorder(completedCells)) {
    breakdown.push({
      type: "borderBonus",
      points: scoringRules.borderBonus.points,
      description: scoringRules.borderBonus.description,
      timestamp: new Date(),
    });
    totalScore += scoringRules.borderBonus.points;
  }

  return { score: totalScore, breakdown };
}

// Generate random bonus and wildcard squares for a new game
export function generateGameSpecialSquares(): {
  bonusSquare: number;
  wildcardSquare: number;
} {
  const availableSquares = Array.from({ length: 25 }, (_, i) => i).filter(
    (i) => i !== 12
  ); // Exclude center

  const bonusSquare =
    availableSquares[Math.floor(Math.random() * availableSquares.length)];
  let wildcardSquare;

  do {
    wildcardSquare =
      availableSquares[Math.floor(Math.random() * availableSquares.length)];
  } while (wildcardSquare === bonusSquare);

  return { bonusSquare, wildcardSquare };
}

// Helper functions for pattern detection
function findMiniLines(completedCells: number[]): number[][] {
  const lines: number[][] = [];
  const grid = Array(5)
    .fill(null)
    .map(() => Array(5).fill(false));

  // Mark completed cells in grid
  for (const cell of completedCells) {
    const row = Math.floor(cell / 5);
    const col = cell % 5;
    grid[row][col] = true;
  }

  // Check horizontal lines of 4
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col <= 1; col++) {
      if (
        grid[row][col] &&
        grid[row][col + 1] &&
        grid[row][col + 2] &&
        grid[row][col + 3]
      ) {
        lines.push([
          row * 5 + col,
          row * 5 + col + 1,
          row * 5 + col + 2,
          row * 5 + col + 3,
        ]);
      }
    }
  }

  // Check vertical lines of 4
  for (let col = 0; col < 5; col++) {
    for (let row = 0; row <= 1; row++) {
      if (
        grid[row][col] &&
        grid[row + 1][col] &&
        grid[row + 2][col] &&
        grid[row + 3][col]
      ) {
        lines.push([
          row * 5 + col,
          (row + 1) * 5 + col,
          (row + 2) * 5 + col,
          (row + 3) * 5 + col,
        ]);
      }
    }
  }

  // Check diagonal lines of 4
  for (let row = 0; row <= 1; row++) {
    for (let col = 0; col <= 1; col++) {
      // Top-left to bottom-right
      if (
        grid[row][col] &&
        grid[row + 1][col + 1] &&
        grid[row + 2][col + 2] &&
        grid[row + 3][col + 3]
      ) {
        lines.push([
          row * 5 + col,
          (row + 1) * 5 + col + 1,
          (row + 2) * 5 + col + 2,
          (row + 3) * 5 + col + 3,
        ]);
      }
      // Top-right to bottom-left
      if (
        grid[row][col + 3] &&
        grid[row + 1][col + 2] &&
        grid[row + 2][col + 1] &&
        grid[row + 3][col]
      ) {
        lines.push([
          row * 5 + col + 3,
          (row + 1) * 5 + col + 2,
          (row + 2) * 5 + col + 1,
          (row + 3) * 5 + col,
        ]);
      }
    }
  }

  return lines;
}

function findDiagonalLines(completedCells: number[]): number[][] {
  const lines: number[][] = [];
  const grid = Array(5)
    .fill(null)
    .map(() => Array(5).fill(false));

  // Mark completed cells in grid
  for (const cell of completedCells) {
    const row = Math.floor(cell / 5);
    const col = cell % 5;
    grid[row][col] = true;
  }

  // Main diagonal (top-left to bottom-right)
  if (grid[0][0] && grid[1][1] && grid[2][2] && grid[3][3] && grid[4][4]) {
    lines.push([0, 6, 12, 18, 24]);
  }

  // Anti-diagonal (top-right to bottom-left)
  if (grid[0][4] && grid[1][3] && grid[2][2] && grid[3][1] && grid[4][0]) {
    lines.push([4, 8, 12, 16, 20]);
  }

  return lines;
}

function findFullLines(completedCells: number[]): number[][] {
  const lines: number[][] = [];
  const grid = Array(5)
    .fill(null)
    .map(() => Array(5).fill(false));

  // Mark completed cells in grid
  for (const cell of completedCells) {
    const row = Math.floor(cell / 5);
    const col = cell % 5;
    grid[row][col] = true;
  }

  // Check horizontal lines
  for (let row = 0; row < 5; row++) {
    if (grid[row].every((cell) => cell)) {
      lines.push([row * 5, row * 5 + 1, row * 5 + 2, row * 5 + 3, row * 5 + 4]);
    }
  }

  // Check vertical lines
  for (let col = 0; col < 5; col++) {
    if (grid.every((row) => row[col])) {
      lines.push([col, col + 5, col + 10, col + 15, col + 20]);
    }
  }

  return lines;
}

function hasAllCorners(completedCells: number[]): boolean {
  const corners = [0, 4, 20, 24];
  return corners.every((corner) => completedCells.includes(corner));
}

function hasFullBorder(completedCells: number[]): boolean {
  const borderCells = [
    0,
    1,
    2,
    3,
    4, // Top row
    5,
    9, // Left and right of row 1
    10,
    14, // Left and right of row 2
    15,
    19, // Left and right of row 3
    20,
    21,
    22,
    23,
    24, // Bottom row
  ];
  return borderCells.every((cell) => completedCells.includes(cell));
}

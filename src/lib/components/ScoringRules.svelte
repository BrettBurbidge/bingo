<script lang="ts">
  import { scoringRules } from "$lib/scoring";
  import * as Card from "$lib/components/ui/card";
  import { Badge } from "$lib/components/ui/badge";

  export let game: any = null;

  // Get special squares for this game
  $: bonusSquare = game?.bonusSquare;
  $: wildcardSquare = game?.wildcardSquare;
  
  function formatSquarePosition(cellIndex: number): string {
    if (cellIndex === null || cellIndex === undefined) return "";
    const row = Math.floor(cellIndex / 5) + 1;
    const col = (cellIndex % 5) + 1;
    return `Row ${row}, Col ${col}`;
  }
</script>

<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      🏆 Scoring Rules
    </Card.Title>
    <Card.Description>
      How points are awarded in this game
    </Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <!-- Basic Scoring -->
    <div class="grid gap-3">
      <div class="flex items-center justify-between p-3 bg-muted rounded-lg">
        <div>
          <div class="font-medium">Mark Square</div>
          <div class="text-sm text-muted-foreground">{scoringRules.markSquare.description}</div>
        </div>
        <Badge variant="secondary">+{scoringRules.markSquare.points}</Badge>
      </div>

      <!-- Special Squares for this game -->
      {#if bonusSquare !== null && bonusSquare !== undefined}
        <div class="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div>
            <div class="font-medium">🎯 Bonus Square ({formatSquarePosition(bonusSquare)})</div>
            <div class="text-sm text-muted-foreground">{scoringRules.firstToMarkSquare.description}</div>
          </div>
          <Badge variant="default">+{scoringRules.firstToMarkSquare.points}</Badge>
        </div>
      {/if}

      {#if wildcardSquare !== null && wildcardSquare !== undefined}
        <div class="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg">
          <div>
            <div class="font-medium">🃏 Wild Card ({formatSquarePosition(wildcardSquare)})</div>
            <div class="text-sm text-muted-foreground">{scoringRules.wildcardBonus.description}</div>
          </div>
          <Badge variant="default">x{scoringRules.wildcardBonus.multiplier}</Badge>
        </div>
      {/if}
    </div>

    <!-- Pattern Bonuses -->
    <div class="space-y-2">
      <h4 class="font-medium text-sm text-muted-foreground uppercase tracking-wide">Pattern Bonuses</h4>
      <div class="grid gap-2">
        <div class="flex items-center justify-between p-2 rounded">
          <div>
            <div class="text-sm font-medium">Mini-Line (4 connected)</div>
            <div class="text-xs text-muted-foreground">{scoringRules.miniLineBonus.description}</div>
          </div>
          <Badge variant="outline">+{scoringRules.miniLineBonus.points}</Badge>
        </div>

        <div class="flex items-center justify-between p-2 rounded">
          <div>
            <div class="text-sm font-medium">Diagonal Line</div>
            <div class="text-xs text-muted-foreground">{scoringRules.diagonalLineBonus.description}</div>
          </div>
          <Badge variant="outline">+{scoringRules.diagonalLineBonus.points}</Badge>
        </div>

        <div class="flex items-center justify-between p-2 rounded">
          <div>
            <div class="text-sm font-medium">Five in a Row</div>
            <div class="text-xs text-muted-foreground">{scoringRules.fiveInRowBonus.description}</div>
          </div>
          <Badge variant="outline">+{scoringRules.fiveInRowBonus.points}</Badge>
        </div>

        <div class="flex items-center justify-between p-2 rounded">
          <div>
            <div class="text-sm font-medium">All Corners</div>
            <div class="text-xs text-muted-foreground">{scoringRules.cornerBonus.description}</div>
          </div>
          <Badge variant="outline">+{scoringRules.cornerBonus.points}</Badge>
        </div>

        <div class="flex items-center justify-between p-2 rounded">
          <div>
            <div class="text-sm font-medium">Full Border</div>
            <div class="text-xs text-muted-foreground">{scoringRules.borderBonus.description}</div>
          </div>
          <Badge variant="outline">+{scoringRules.borderBonus.points}</Badge>
        </div>
      </div>
    </div>

    <div class="text-xs text-muted-foreground border-t pt-3">
      💡 <strong>Tip:</strong> Pattern bonuses stack! You can earn multiple bonuses for the same squares.
    </div>
  </Card.Content>
</Card.Root> 
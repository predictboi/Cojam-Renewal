// Data room: how the players picked, shown as one easy line per question ("Cojam says 62% Yes").
// DECISIONS "Data room". The contract between the API (`/public/data`, the split on a result row) and the PWA.
//
// Shares are whole percents of players, one player one vote. They are never called a probability.

/** Fewer players than this on a question: no share is shown ("Counting"). Admin parameter, this is the default. */
export const DATA_MIN_PLAYERS = 30;
/** The "top players" share needs at least this many of them on the question. */
export const DATA_MIN_TOP_PLAYERS = 10;

/** 1 = left (choice A), 2 = right (choice B), as on chain. */
export type DataSide = 1 | 2;

/** How the players of one question picked. */
export interface DataSplit {
  players: number;
  /** Percent of players on the right choice (choice B: yes, up, over), 0 to 100. Null below DATA_MIN_PLAYERS. */
  rightShare: number | null;
  /** The same among players in the top fifth by hit rate (at least 20 answered questions). Null when too few. */
  topRightShare: number | null;
}

/** An outside market on the same question, linked by hand or by the drafter; absent for most questions. */
export interface DataOutside {
  source: "polymarket";
  url: string;
  /** Its price of the right choice in whole percent, read when our day closed. */
  rightPrice: number;
  takenAt: number; // unix seconds
}

export interface DataMarket {
  marketId: string;
  slot: number;
  category: "crypto" | "markets" | "weather" | "sports" | "culture";
  text: Record<"en" | "ko" | "ja", { title: string; a: string; b: string }>;
  split: DataSplit;
  outside?: DataOutside;
  /** Set once the answer is known. */
  outcome: DataSide | null;
  /** True when the larger share picked the answer; null before the answer, on a 50:50 split or below the minimum. */
  crowdRight: boolean | null;
}

export interface DataDay {
  dayId: number;
  /** When the day's questions closed (unix seconds). Only closed days are listed. */
  closedAt: number;
  markets: DataMarket[];
}

/** GET /public/data?cursor= : no sign in, newest day first, 7 days a page. */
export interface DataRoom {
  /** How often the larger share was right, over every answered question that met the minimum. */
  crowd: { rightPercent: number | null; questions: number };
  days: DataDay[];
  nextCursor: string | null;
}

// src/modules/daily-notes/types/daily-note.types.ts

import {
  Mood,
  EnergyLevel,
  NoteBlock,
  NoteBlockType,
} from '../schemas/daily-note.schema';

export { NoteBlockType };

// ─── Safe note returned in API responses ────────────────────────────────────
export interface SafeDailyNote {
  _id: string;
  date: string;
  content: string;
  blocks: NoteBlock[];
  title?: string;
  mood?: Mood;
  energyLevel?: EnergyLevel;
  wellnessSummary?: string;
  gratitude: string[];
  wins: string[];
  improvements: string[];
  tags: string[];
  isPinned: boolean;
  wordCount: number;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Calendar views for daily notes ─────────────────────────────────────────

// One day cell (for weekly/monthly calendar grid)
export interface NoteCalendarDay {
  date: string;
  hasNote: boolean;
  note?: SafeDailyNote | null;
  // Quick-glance metadata (no content) for calendar grid performance
  mood?: Mood;
  wordCount?: number;
  tags?: string[];
}

export interface NoteWeeklyView {
  weekStart: string;
  weekEnd: string;
  days: NoteCalendarDay[];
  weekStats: NoteWeekStats;
}

export interface NoteMonthlyView {
  year: number;
  month: number;
  days: NoteCalendarDay[];
  monthStats: NoteMonthStats;
}

// ─── Stats & trends ──────────────────────────────────────────────────────────
export interface NoteWeekStats {
  notesWritten: number; // Out of 7 days
  totalWords: number;
  averageWords: number;
  averageMood: number | null; // null if no mood tracked this week
  averageEnergy: number | null;
  mostUsedTags: Array<{ tag: string; count: number }>;
  streakDays: number; // Consecutive days with a note
}

export interface NoteMonthStats extends NoteWeekStats {
  longestStreak: number;
  pinned: number;
  moodDistribution: Record<number, number>; // { 1: 2, 3: 5, 4: 10, ... }
  topTags: Array<{ tag: string; count: number }>;
}

export interface NoteStats {
  total: number;
  totalWords: number;
  averageWordCount: number;
  currentStreak: number; // Consecutive days ending today
  longestStreak: number;
  averageMood: number | null;
  averageEnergy: number | null;
  moodTrend: Array<{ date: string; mood: number }>; // Last 30 days
  energyTrend: Array<{ date: string; energy: number }>;
  wordCountTrend: Array<{ date: string; wordCount: number }>;
  topTags: Array<{ tag: string; count: number }>;
  recentNotes: SafeDailyNote[];
}

// ─── Search result ────────────────────────────────────────────────────────────
export interface NoteSearchResult {
  notes: SafeDailyNote[];
  total: number;
  page: number;
  limit: number;
}

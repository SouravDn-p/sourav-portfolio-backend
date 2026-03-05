import {
  TodoPriority,
  TodoStatus,
  RecurrencePattern,
} from '../schemas/todo.schema';

// ─── Single todo returned in API responses ────────────────────────────────────
export interface SafeTodo {
  _id: string;
  title: string;
  description?: string;
  dueDate: Date;
  dueTime?: string;
  priority: TodoPriority;
  status: TodoStatus;
  labels: string[];
  category?: string;
  order: number;
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  parentTodoId?: string;
  reminderTime?: Date;
  completedAt?: Date;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Calendar view types ──────────────────────────────────────────────────────

// One day cell in the calendar
export interface CalendarDay {
  date: string; // ISO date string "2025-03-15"
  todos: SafeTodo[];
  totalCount: number;
  completedCount: number;
  pendingCount: number;
  urgentCount: number;
}

// Daily view — single day, todos + summary
export interface DailyView {
  date: string;
  todos: SafeTodo[];
  summary: TodoDaySummary;
}

// Weekly view — 7 days
export interface WeeklyView {
  weekStart: string; // Monday ISO date
  weekEnd: string; // Sunday ISO date
  days: CalendarDay[];
  weekSummary: TodoWeekSummary;
}

// Monthly view — all days in the month (condensed for calendar grid)
export interface MonthlyView {
  year: number;
  month: number; // 1–12
  days: CalendarDay[];
  monthlySummary: TodoMonthSummary;
}

// ─── Summary types ────────────────────────────────────────────────────────────
export interface TodoDaySummary {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  cancelled: number;
  urgent: number;
  completionRate: number; // percentage 0–100
}

export interface TodoWeekSummary extends TodoDaySummary {
  mostProductiveDay: string | null; // ISO date
  averagePerDay: number;
}

export interface TodoMonthSummary extends TodoWeekSummary {
  mostProductiveWeek: string | null; // ISO week start date
  streakDays: number; // consecutive days with ≥1 completion
}

// ─── Stats response ───────────────────────────────────────────────────────────
export interface TodoStats {
  allTime: {
    total: number;
    completed: number;
    pending: number;
    completionRate: number;
  };
  byPriority: Record<TodoPriority, number>;
  byCategory: Array<{ category: string; count: number }>;
  byLabel: Array<{ label: string; count: number }>;
  recentCompletions: SafeTodo[];
  overdue: number;
}

export type TodoFilter = {
  userId: string;
  status?: TodoStatus;
  priority?: TodoPriority;
  category?: string;
  labels?: { $in: string[] };
  dueDate?: {
    $gte?: Date;
    $lt?: Date;
  };
};

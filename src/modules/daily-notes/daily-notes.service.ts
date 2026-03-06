import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DailyNote, DailyNoteDocument } from './schemas/daily-note.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  CreateDailyNoteDto,
  DailyNoteQueryDto,
  NoteCalendarQueryDto,
  UpdateDailyNoteDto,
} from './dto/create-daily-note.dto';
import {
  NoteCalendarDay,
  NoteMonthlyView,
  NoteSearchResult,
  NoteStats,
  NoteWeeklyView,
  SafeDailyNote,
} from './dto/daily-note.types';

@Injectable()
export class DailyNotesService {
  constructor(
    @InjectModel(DailyNote.name)
    private readonly noteModel: Model<DailyNoteDocument>,
  ) {}

  async findAll(
    userId: string,
    query: DailyNoteQueryDto,
  ): Promise<NoteSearchResult> {
    const filter: Record<string, any> = { userId };

    if (query.tag) filter.tags = { $in: [query.tag] };
    if (query.mood) filter.mood = query.mood;
    if (query.isPinned !== undefined) filter.isPinned = query.isPinned;

    if (query.startDate || query.endDate) {
      const dateFilter: { $gte?: string; $lte?: string } = {};
      if (query.startDate)
        dateFilter.$gte = this.normalizeDate(query.startDate);
      if (query.endDate) dateFilter.$lte = this.normalizeDate(query.endDate);
      filter.date = dateFilter;
    }

    // Full-text search in content (using regex; add $text index for production scale)
    if (query.search) {
      filter.content = { $regex: query.search, $options: 'i' };
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [notes, total] = await Promise.all([
      this.noteModel
        .find(filter)
        .sort({ date: -1 }) // Newest first
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.noteModel.countDocuments(filter),
    ]);

    return {
      notes: notes.map((n) => this.toSafeNote(n as DailyNoteDocument)),
      total,
      page,
      limit,
    };
  }

  async findOne(userId: string, id: string): Promise<SafeDailyNote> {
    const note = await this.noteModel.findById(id).lean().exec();
    if (!note) throw new NotFoundException(`Note #${id} not found`);
    this.assertOwnership(note as DailyNoteDocument, userId);
    return this.toSafeNote(note as DailyNoteDocument);
  }

  async findByDate(
    userId: string,
    date: string,
  ): Promise<SafeDailyNote | null> {
    const normalizedDate = this.normalizeDate(date);
    const note = await this.noteModel
      .findOne({ userId, date: normalizedDate })
      .lean()
      .exec();

    return note ? this.toSafeNote(note as DailyNoteDocument) : null;
  }

  async create(
    userId: string,
    dto: CreateDailyNoteDto,
  ): Promise<SafeDailyNote> {
    const date = this.normalizeDate(dto.date);

    const existing = await this.noteModel.findOne({ userId, date });
    if (existing) {
      throw new ConflictException(
        `A note already exists for ${date}. Use PATCH /daily-notes/date/${date} to update it.`,
      );
    }

    const note = await this.noteModel.create({ ...dto, date, userId });
    return this.toSafeNote(note);
  }

  // ─── UPDATE ──────────────────────────────────────────────────────────────
  async update(
    userId: string,
    id: string,
    dto: UpdateDailyNoteDto,
  ): Promise<SafeDailyNote> {
    const note = await this.noteModel.findById(id);
    if (!note) throw new NotFoundException(`Note #${id} not found`);
    this.assertOwnership(note, userId);

    const updated = await this.noteModel
      .findByIdAndUpdate(id, { $set: dto }, { new: true })
      .lean()
      .exec();

    return this.toSafeNote(updated as DailyNoteDocument);
  }

  async upsertByDate(
    userId: string,
    date: string,
    dto: UpdateDailyNoteDto,
  ): Promise<SafeDailyNote> {
    const normalizedDate = this.normalizeDate(date);

    // $setOnInsert only applies on creation
    // The rest of dto fields apply on both create and update
    const note = await this.noteModel.findOneAndUpdate(
      { userId, date: normalizedDate },
      {
        $set: { ...dto, date: normalizedDate, userId },
      },
      {
        returnDocument: 'after', // Return updated document
        upsert: true, // Create if not found
        runValidators: true,
      },
    );

    return this.toSafeNote(note);
  }

  // ─── DELETE ──────────────────────────────────────────────────────────────
  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const note = await this.noteModel.findById(id);
    if (!note) throw new NotFoundException(`Note #${id} not found`);
    this.assertOwnership(note, userId);
    await this.noteModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  async getWeeklyView(
    userId: string,
    query: NoteCalendarQueryDto,
  ): Promise<NoteWeeklyView> {
    const { weekStart, weekEnd } = this.getWeekRange(
      query.weekOf ? new Date(query.weekOf) : new Date(),
    );

    const notes = await this.noteModel
      .find({ userId, date: { $gte: weekStart, $lte: weekEnd } })
      .lean()
      .exec();

    const noteMap = new Map(
      (notes as DailyNoteDocument[]).map((n) => [n.date, n]),
    );

    // Build 7 calendar day cells
    const days: NoteCalendarDay[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = this.toDateString(d);
      const note = noteMap.get(dateStr);

      return {
        date: dateStr,
        hasNote: !!note,
        note: note ? this.toSafeNote(note) : null,
        mood: note?.mood,
        wordCount: note?.wordCount,
        tags: note?.tags ?? [],
      };
    });

    return {
      weekStart,
      weekEnd,
      days,
      weekStats: this.buildWeekStats(days),
    };
  }

  // ─── CALENDAR: MONTHLY VIEW ───────────────────────────────────────────────
  // For monthly view, we return lightweight cells (no full content)
  // for performance — full content loads when user clicks a day.
  async getMonthlyView(
    userId: string,
    query: NoteCalendarQueryDto,
  ): Promise<NoteMonthlyView> {
    const now = new Date();
    const year = query.year ?? now.getFullYear();
    const month = query.month ?? now.getMonth() + 1;

    const monthStart = this.toDateString(new Date(year, month - 1, 1));
    const monthEnd = this.toDateString(new Date(year, month, 0)); // last day

    const notes = await this.noteModel
      .find({ userId, date: { $gte: monthStart, $lte: monthEnd } })
      .select('-content') // ← exclude content 
      .lean()
      .exec();

    const noteMap = new Map(
      (notes as DailyNoteDocument[]).map((n) => [n.date, n]),
    );

    const daysInMonth = new Date(year, month, 0).getDate();
    const days: NoteCalendarDay[] = Array.from(
      { length: daysInMonth },
      (_, i) => {
        const dateStr = this.toDateString(new Date(year, month - 1, i + 1));
        const note = noteMap.get(dateStr);

        return {
          date: dateStr,
          hasNote: !!note,
          note: null, // Don't send content in monthly view — load on click
          mood: note?.mood,
          wordCount: note?.wordCount,
          tags: note?.tags ?? [],
        };
      },
    );

    return {
      year,
      month,
      days,
      monthStats: this.buildMonthStats(days, notes as DailyNoteDocument[]),
    };
  }

  // ─── STATS & TRENDS ───────────────────────────────────────────────────────
  async getStats(userId: string): Promise<NoteStats> {
    // Last 30 days for trend data
    const thirtyDaysAgo = this.toDateString(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    );

    const [allNotes, recentNotes] = await Promise.all([
      this.noteModel.find({ userId }).lean().exec(),
      this.noteModel
        .find({ userId, date: { $gte: thirtyDaysAgo } })
        .sort({ date: 1 })
        .lean()
        .exec(),
    ]);

    const total = allNotes.length;
    const totalWords = allNotes.reduce((sum, n) => sum + (n.wordCount || 0), 0);

    const moodsWithValues = allNotes.filter((n) => n.mood);
    const avgMood =
      moodsWithValues.length > 0
        ? moodsWithValues.reduce((sum, n) => sum + n.mood!, 0) /
          moodsWithValues.length
        : null;

    const energyWithValues = allNotes.filter((n) => n.energyLevel);
    const avgEnergy =
      energyWithValues.length > 0
        ? energyWithValues.reduce((sum, n) => sum + n.energyLevel!, 0) /
          energyWithValues.length
        : null;

    // Streak calculation
    const { currentStreak, longestStreak } = this.calculateStreaks(
      allNotes.map((n) => n.date),
    );

    // Tag frequency
    const tagMap = new Map<string, number>();
    allNotes.forEach((n) => {
      n.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    });
    const topTags = Array.from(tagMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total,
      totalWords,
      averageWordCount: total > 0 ? Math.round(totalWords / total) : 0,
      currentStreak,
      longestStreak,
      averageMood: avgMood ? Math.round(avgMood * 10) / 10 : null,
      averageEnergy: avgEnergy ? Math.round(avgEnergy * 10) / 10 : null,
      moodTrend: (recentNotes as DailyNoteDocument[])
        .filter((n) => n.mood)
        .map((n) => ({ date: n.date, mood: n.mood! })),
      energyTrend: (recentNotes as DailyNoteDocument[])
        .filter((n) => n.energyLevel)
        .map((n) => ({ date: n.date, energy: n.energyLevel! })),
      wordCountTrend: (recentNotes as DailyNoteDocument[]).map((n) => ({
        date: n.date,
        wordCount: n.wordCount,
      })),
      topTags,
      recentNotes: (recentNotes as DailyNoteDocument[])
        .slice(-5)
        .reverse()
        .map((n) => this.toSafeNote(n)),
    };
  }

  private normalizeDate(dateStr: string): string {
    return new Date(dateStr).toISOString().split('T')[0];
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /** Returns Monday start and Sunday end of the week containing `date` */
  private getWeekRange(date: Date): { weekStart: string; weekEnd: string } {
    const d = new Date(date);
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;

    const monday = new Date(d);
    monday.setDate(d.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    return {
      weekStart: this.toDateString(monday),
      weekEnd: this.toDateString(sunday),
    };
  }

  private buildWeekStats(days: NoteCalendarDay[]) {
    const notesWithData = days.filter((d) => d.hasNote);
    const totalWords = notesWithData.reduce(
      (sum, d) => sum + (d.wordCount ?? 0),
      0,
    );
    const moodsWithValues = notesWithData.filter((d) => d.mood);
    const tags = notesWithData.flatMap((d) => d.tags ?? []);
    const tagMap = new Map<string, number>();
    tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));

    // Streak (consecutive days in this week)
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].hasNote) streak++;
      else break;
    }

    return {
      notesWritten: notesWithData.length,
      totalWords,
      averageWords:
        notesWithData.length > 0
          ? Math.round(totalWords / notesWithData.length)
          : 0,
      averageMood:
        moodsWithValues.length > 0
          ? Math.round(
              (moodsWithValues.reduce((sum, d) => sum + d.mood!, 0) /
                moodsWithValues.length) *
                10,
            ) / 10
          : null,
      averageEnergy: null,
      mostUsedTags: Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5),
      streakDays: streak,
    };
  }

  private buildMonthStats(days: NoteCalendarDay[], notes: DailyNoteDocument[]) {
    const weekStats = this.buildWeekStats(days);
    const moodDist: Record<number, number> = {};
    notes.forEach((n) => {
      if (n.mood) moodDist[n.mood] = (moodDist[n.mood] || 0) + 1;
    });

    const tagMap = new Map<string, number>();
    notes.forEach((n) => {
      n.tags.forEach((t) => tagMap.set(t, (tagMap.get(t) || 0) + 1));
    });

    const { longestStreak } = this.calculateStreaks(notes.map((n) => n.date));

    return {
      ...weekStats,
      longestStreak,
      pinned: notes.filter((n) => n.isPinned).length,
      moodDistribution: moodDist,
      topTags: Array.from(tagMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    };
  }

  private calculateStreaks(dates: string[]): {
    currentStreak: number;
    longestStreak: number;
  } {
    if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const sorted = [...new Set(dates)].sort((a, b) => b.localeCompare(a)); // desc

    const today = this.toDateString(new Date());
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate: string | null = null;

    for (const date of sorted) {
      if (!lastDate) {
        // Start: if most recent entry isn't today or yesterday, streak is 0
        if (
          date === today ||
          date === this.toDateString(new Date(Date.now() - 86400000))
        ) {
          tempStreak = 1;
          currentStreak = 1;
        } else {
          currentStreak = 0;
        }
      } else {
        const prev = new Date(lastDate);
        prev.setDate(prev.getDate() - 1);
        if (date === this.toDateString(prev)) {
          tempStreak++;
          if (currentStreak > 0) currentStreak = tempStreak;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
          if (currentStreak > 0) currentStreak = 0; // gap found
        }
      }
      lastDate = date;
    }

    longestStreak = Math.max(longestStreak, tempStreak);
    return { currentStreak, longestStreak };
  }

  private assertOwnership(note: DailyNoteDocument, userId: string): void {
    if (note.userId !== userId) {
      throw new ForbiddenException('You do not own this note');
    }
  }

  private toSafeNote(note: DailyNoteDocument): SafeDailyNote {
    return {
      _id: note._id.toString(),
      date: note.date,
      content: note.content,
      blocks: note.blocks,
      title: note.title,
      mood: note.mood,
      energyLevel: note.energyLevel,
      wellnessSummary: note.wellnessSummary,
      gratitude: note.gratitude,
      wins: note.wins,
      improvements: note.improvements,
      tags: note.tags,
      isPinned: note.isPinned,
      wordCount: note.wordCount,
      userId: note.userId,
      createdAt: (note as unknown as { createdAt: Date }).createdAt,
      updatedAt: (note as unknown as { updatedAt: Date }).updatedAt,
    };
  }
}

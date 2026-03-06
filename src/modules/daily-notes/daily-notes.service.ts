import { ForbiddenException, Injectable } from '@nestjs/common';
import { DailyNote, DailyNoteDocument } from './schemas/daily-note.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { DailyNoteQueryDto } from './dto/create-daily-note.dto';
import { NoteSearchResult, SafeDailyNote } from './dto/daily-note.types';

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

  private normalizeDate(dateStr: string): string {
    return new Date(dateStr).toISOString().split('T')[0];
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
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

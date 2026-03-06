// src/modules/daily-notes/schemas/daily-note.schema.ts
//
// A DailyNote is a diary-style entry tied to a specific DATE (not datetime).
// Rule: ONE note per user per day. (Enforced via unique compound index)
// Users can edit/append throughout the day.
//
// Design choices:
// - date stored as "YYYY-MM-DD" string for simplicity (no UTC offset headaches)
// - mood + energy as numbers (1–5 scale) for chart/trend views
// - blocks: rich content blocks (text, bullets, code, etc.) for future editor support
// - tags for cross-day search/grouping
// - wordCount computed on save for analytics

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { NextFunction } from 'express';
import { HydratedDocument } from 'mongoose';

export type DailyNoteDocument = HydratedDocument<DailyNote>;

export enum Mood {
  TERRIBLE = 1,
  BAD = 2,
  NEUTRAL = 3,
  GOOD = 4,
  GREAT = 5,
}

export enum EnergyLevel {
  EXHAUSTED = 1,
  LOW = 2,
  MODERATE = 3,
  HIGH = 4,
  PEAK = 5,
}

export enum NoteBlockType {
  PARAGRAPH = 'paragraph',
  BULLET_LIST = 'bullet_list',
  NUMBERED_LIST = 'numbered_list',
  HEADING = 'heading',
  QUOTE = 'quote',
  CODE = 'code',
  DIVIDER = 'divider',
}

// A single content block in the note (extensible rich-text model)
export class NoteBlock {
  type!: NoteBlockType;
  content!: string; // Raw text content
  order!: number; // Display order
}

@Schema({ timestamps: true })
export class DailyNote {
  // ─── Date identity ──────────────────────────────────────────────────────
  // Stored as "YYYY-MM-DD" string — immutable after creation
  // ONE note per user per date (enforced by unique index below)
  @Prop({ required: true })
  date!: string;

  // ─── Content ────────────────────────────────────────────────────────────
  // Plain text content (primary field — simple approach)
  @Prop({ required: true, default: '' })
  content!: string;

  // Rich text blocks (optional — for future block editor support)
  // Stored alongside content for compatibility
  @Prop({
    type: [{ type: { type: String }, content: String, order: Number }],
    default: [],
  })
  blocks!: NoteBlock[];

  // Short summary/title for the day (auto-generated or user-written)
  @Prop({ default: null })
  title?: string;

  // ─── Mood & wellness tracking ────────────────────────────────────────────
  @Prop({ type: Number, min: 1, max: 5, default: null })
  mood?: Mood;

  @Prop({ type: Number, min: 1, max: 5, default: null })
  energyLevel?: EnergyLevel;

  // Free-form wellness text: "slept 7 hours, exercised 30 min"
  @Prop({ default: null })
  wellnessSummary?: string;

  // ─── Reflection prompts ──────────────────────────────────────────────────
  // Structured gratitude / wins / improvements
  @Prop({ type: [String], default: [] })
  gratitude!: string[]; // e.g. ["Good weather", "Finished a feature"]

  @Prop({ type: [String], default: [] })
  wins!: string[]; // Things that went well today

  @Prop({ type: [String], default: [] })
  improvements!: string[]; // What to do better tomorrow

  // ─── Classification ───────────────────────────────────────────────────────
  @Prop({ type: [String], default: [] })
  tags!: string[];

  // Is this note pinned / starred?
  @Prop({ default: false })
  isPinned!: boolean;

  // ─── Analytics ───────────────────────────────────────────────────────────
  // Word count of content (for trends chart)
  @Prop({ default: 0 })
  wordCount!: number;

  // ─── Ownership ────────────────────────────────────────────────────────────
  @Prop({ required: true, index: true })
  userId!: string;
}

export const DailyNoteSchema = SchemaFactory.createForClass(DailyNote);

// ─── Indexes ──────────────────────────────────────────────────────────────────
// UNIQUE: one note per user per date
DailyNoteSchema.index({ userId: 1, date: 1 }, { unique: true });

// For tag search
DailyNoteSchema.index({ userId: 1, tags: 1 });

// For mood/energy trend queries
DailyNoteSchema.index({ userId: 1, mood: 1 });

// Auto-calculate wordCount before saving
DailyNoteSchema.pre<DailyNoteDocument>('save', function (next: NextFunction) {
  if (this.content) {
    this.wordCount = this.content.trim().split(/\s+/).filter(Boolean).length;
  }
  next();
});

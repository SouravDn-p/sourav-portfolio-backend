import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TodoDocument = HydratedDocument<Todo>;

export enum TodoPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum TodoStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RecurrencePattern {
  DAILY = 'daily',
  WEEKDAYS = 'weekdays',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

@Schema({ timestamps: true })
export class Todo {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ default: null })
  description?: string;

  // dueDate stores the DATE portion (time zeroed to 00:00:00 UTC)
  // This makes calendar grouping trivial: group by dueDate
  @Prop({ required: true, type: Date })
  dueDate!: Date;

  // Separate time string (e.g. "14:30") so we don't fight timezone math
  // when displaying "due at 2:30 PM" on the frontend
  @Prop({ default: null })
  dueTime?: string;

  @Prop({ type: String, enum: TodoPriority, default: TodoPriority.MEDIUM })
  priority!: TodoPriority;

  @Prop({ type: String, enum: TodoStatus, default: TodoStatus.PENDING })
  status!: TodoStatus;

  @Prop({ type: [String], default: [] })
  labels!: string[];

  @Prop({ default: null })
  category?: string;

  // Manual sort order for todos on the same day (drag-drop support)
  @Prop({ default: 0 })
  order!: number;

  @Prop({ default: false })
  isRecurring!: boolean;

  @Prop({ type: String, enum: RecurrencePattern, default: null })
  recurrencePattern?: RecurrencePattern;

  // For recurring todos: points back to the first/original todo
  @Prop({ default: null })
  parentTodoId?: string;

  @Prop({ type: Date, default: null })
  reminderTime?: Date;

  @Prop({ type: Date, default: null })
  completedAt?: Date; // Set when status → COMPLETED

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId!: string;
}

export const TodoSchema = SchemaFactory.createForClass(Todo);

// Powers: "get all todos for this user in this date range" (calendar view)
TodoSchema.index({ userId: 1, dueDate: 1 });

// Powers: "get all todos for this user with this status"
TodoSchema.index({ userId: 1, status: 1 });

// Powers: "get all todos for this user in a category"
TodoSchema.index({ userId: 1, category: 1 });

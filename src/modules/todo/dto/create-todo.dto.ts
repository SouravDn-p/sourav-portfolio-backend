import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsArray,
  Matches,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  TodoPriority,
  TodoStatus,
  RecurrencePattern,
} from '../schemas/todo.schema';

export class CreateTodoDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  // ISO date string: "2025-03-15" or "2025-03-15T00:00:00.000Z"
  @IsDateString()
  dueDate!: string;

  // Time in HH:MM 24h format: "09:00", "14:30"
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'dueTime must be in HH:MM format (e.g. "09:30")',
  })
  dueTime?: string;

  @IsOptional()
  @IsEnum(TodoPriority)
  priority?: TodoPriority;

  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsEnum(RecurrencePattern)
  recurrencePattern?: RecurrencePattern;

  @IsOptional()
  @IsDateString()
  reminderTime?: string;
}

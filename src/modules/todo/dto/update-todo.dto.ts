import { PartialType } from '@nestjs/mapped-types';
import { CreateTodoDto } from './create-todo.dto';
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
export class UpdateTodoDto extends PartialType(CreateTodoDto) {}

import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TodoPriority, TodoStatus } from '../schemas/todo.schema';

export class TodoQueryDto {
  @IsOptional()
  @IsEnum(TodoStatus)
  status?: TodoStatus;

  @IsOptional()
  @IsEnum(TodoPriority)
  priority?: TodoPriority;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  label?: string;

  // Filter by exact date (YYYY-MM-DD)
  @IsOptional()
  @IsDateString()
  date?: string;

  // Filter by date range
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

// Calendar query params
export class CalendarQueryDto {
  // For daily view: "2025-03-15"
  @IsOptional()
  @IsDateString()
  date?: string;

  // For weekly view: any date in the week
  @IsOptional()
  @IsDateString()
  weekOf?: string;

  // For monthly view
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;
}

// Status update shortcut (PATCH /todos/:id/status)
export class UpdateTodoStatusDto {
  @IsEnum(TodoStatus)
  status!: TodoStatus;
}

// Reorder todos (PATCH /todos/reorder)
export class ReorderTodosDto {
  @IsString({ each: true })
  orderedIds!: string[];
}

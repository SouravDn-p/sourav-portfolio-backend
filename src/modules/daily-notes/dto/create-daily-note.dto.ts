import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Mood, EnergyLevel, NoteBlockType } from '../schemas/daily-note.schema';

// Validates individual rich text block
export class NoteBlockDto {
  @IsEnum(NoteBlockType)
  type!: NoteBlockType;

  @IsString()
  content!: string;

  @IsInt()
  @Min(0)
  order!: number;
}

export class CreateDailyNoteDto {
  // ISO date string "YYYY-MM-DD"
  @IsDateString()
  date!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NoteBlockDto)
  blocks?: NoteBlockDto[];

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  mood?: Mood;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energyLevel?: EnergyLevel;

  @IsOptional()
  @IsString()
  wellnessSummary?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gratitude?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wins?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  improvements?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

// src/modules/daily-notes/dto/update-daily-note.dto.ts
import { PartialType } from '@nestjs/mapped-types';
export class UpdateDailyNoteDto extends PartialType(CreateDailyNoteDto) {}

// ─────────────────────────────────────────────────────────────────────────────

// Query params for list / search
export class DailyNoteQueryDto {
  // Full text search in content
  @IsOptional()
  @IsString()
  search?: string;

  // Filter by tag
  @IsOptional()
  @IsString()
  tag?: string;

  // Filter by mood
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  mood?: number;

  // Only pinned notes
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isPinned?: boolean;

  // Date range
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

// Calendar view query
export class NoteCalendarQueryDto {
  @IsOptional()
  @IsDateString()
  weekOf?: string;

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

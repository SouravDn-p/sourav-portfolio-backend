import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ProjectStatus } from '../schemas/project.schema';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }: { value: unknown }): string[] | string => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return value as string[] | string;
  })
  tags!: string[];

  @IsUrl()
  liveUrl!: string;

  @IsOptional()
  @IsUrl()
  backendLiveUrl?: string;

  @IsOptional()
  @IsUrl()
  repoUrl?: string;

  @IsOptional()
  @IsUrl()
  backendRepoUrl?: string;

  @IsOptional()
  @IsString()
  startingDate?: string;

  @IsOptional()
  @IsString()
  updateDate?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  teamMember!: number;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
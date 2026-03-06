import { Controller, Get, Query } from '@nestjs/common';
import { DailyNotesService } from './daily-notes.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiResponse } from 'src/common/types/global';
import { NoteSearchResult, SafeDailyNote } from './dto/daily-note.types';
import { DailyNoteQueryDto } from './dto/create-daily-note.dto';
import type { JwtUser } from 'src/common/types/auth.types';

@Controller('daily-notes')
export class DailyNotesController {
  constructor(private readonly dailyNotesService: DailyNotesService) {}

  @Get('today')
  async getToday(
    @CurrentUser() user: JwtUser,
  ): Promise<ApiResponse<SafeDailyNote | null>> {
    const today = new Date().toISOString().split('T')[0];
    const data = await this.dailyNotesService.findByDate(user.userId, today);
    return ApiResponse.success(data);
  }

  @Get()
  async findAll(
    @CurrentUser() user: JwtUser,
    @Query() query: DailyNoteQueryDto,
  ): Promise<ApiResponse<NoteSearchResult>> {
    const data = await this.dailyNotesService.findAll(user.userId, query);
    return ApiResponse.success(data);
  }
}

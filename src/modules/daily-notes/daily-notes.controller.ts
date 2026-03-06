import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { DailyNotesService } from './daily-notes.service';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiResponse } from 'src/common/types/global';
import {
  NoteMonthlyView,
  NoteSearchResult,
  NoteWeeklyView,
  SafeDailyNote,
} from './dto/daily-note.types';
import {
  CreateDailyNoteDto,
  DailyNoteQueryDto,
  NoteCalendarQueryDto,
  UpdateDailyNoteDto,
} from './dto/create-daily-note.dto';
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

  // ─── Calendar views (before /:id) ─────────────────────────────────────────
  @Get('calendar/weekly')
  async getWeeklyView(
    @CurrentUser() user: JwtUser,
    @Query() query: NoteCalendarQueryDto,
  ): Promise<ApiResponse<NoteWeeklyView>> {
    const data = await this.dailyNotesService.getWeeklyView(user.userId, query);
    return ApiResponse.success(data);
  }

  @Get('calendar/monthly')
  async getMonthlyView(
    @CurrentUser() user: JwtUser,
    @Query() query: NoteCalendarQueryDto,
  ): Promise<ApiResponse<NoteMonthlyView>> {
    const data = await this.dailyNotesService.getMonthlyView(
      user.userId,
      query,
    );
    return ApiResponse.success(data);
  }

  // ─── Get by exact date ────────────────────────────────────────────────────
  @Get('date/:date')
  async findByDate(
    @CurrentUser() user: JwtUser,
    @Param('date') date: string,
  ): Promise<ApiResponse<SafeDailyNote | null>> {
    const data = await this.dailyNotesService.findByDate(user.userId, date);
    return ApiResponse.success(data);
  }

  // ─── Standard CRUD ─────────────────────────────────────────────────────────
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtUser,
    @Body() dto: CreateDailyNoteDto,
  ): Promise<ApiResponse<SafeDailyNote>> {
    const data = await this.dailyNotesService.create(user.userId, dto);
    return ApiResponse.success(data);
  }

  @Put('date/:date')
  async upsertByDate(
    @CurrentUser() user: JwtUser,
    @Param('date') date: string,
    @Body() dto: UpdateDailyNoteDto,
  ): Promise<ApiResponse<SafeDailyNote>> {
    const data = await this.dailyNotesService.upsertByDate(
      user.userId,
      date,
      dto,
    );
    return ApiResponse.success(data);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<SafeDailyNote>> {
    const data = await this.dailyNotesService.findOne(user.userId, id);
    return ApiResponse.success(data);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateDailyNoteDto,
  ): Promise<ApiResponse<SafeDailyNote>> {
    const data = await this.dailyNotesService.update(user.userId, id, dto);
    return ApiResponse.success(data);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const data = await this.dailyNotesService.remove(user.userId, id);
    return ApiResponse.success(data);
  }
}

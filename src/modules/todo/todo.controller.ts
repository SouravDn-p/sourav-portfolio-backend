import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TodoService } from './todo.service';
import { CreateTodoDto } from './dto/create-todo.dto';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { ApiResponse } from 'src/common/types/global';
// import { DailyView, MonthlyView, SafeTodo, TodoStats, WeeklyView } from './dto/todo.types';
import { DailyView, MonthlyView, SafeTodo, TodoStats, WeeklyView } from './dto/todo.types';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import type { JwtUser } from 'src/common/types/auth.types';
import {
  CalendarQueryDto,
  // CalendarQueryDto,
  ReorderTodosDto,
  TodoQueryDto,
  UpdateTodoDto,
  UpdateTodoStatusDto,
} from './dto/update-todo.dto';
import { Types } from 'mongoose';

@Controller('todo')
export class TodoController {
  constructor(private readonly todosService: TodoService) {}

  @Get()
  async findAll(
    @CurrentUser() user: JwtUser,
    @Query() query: TodoQueryDto,
  ): Promise<
    ApiResponse<{
      todos: SafeTodo[];
      total: number;
      page: number;
      limit: number;
    }>
  > {
    const data = await this.todosService.findAll(user.userId, query);
    return ApiResponse.success(data);
  }

  @Get('stats')
  async getStats(
    @CurrentUser() user: JwtUser,
  ): Promise<ApiResponse<TodoStats>> {
    const data = await this.todosService.getStats(user.userId);
    return ApiResponse.success(data);
  }

  // ─── Calendar views ────────────────────────────────────────────────────────

  @Get('calendar/daily')
  async getDailyView(
    @CurrentUser() user: JwtUser,
    @Query() query: CalendarQueryDto,
  ): Promise<ApiResponse<DailyView>> {
    const data = await this.todosService.getDailyView(user.userId, query);
    return ApiResponse.success(data);
  }

  @Get('calendar/weekly')
  async getWeeklyView(
    @CurrentUser() user: JwtUser,
    @Query() query: CalendarQueryDto,
  ): Promise<ApiResponse<WeeklyView>> {
    const data = await this.todosService.getWeeklyView(user.userId, query);
    return ApiResponse.success(data);
  }

  @Get('calendar/monthly')
  async getMonthlyView(
    @CurrentUser() user: JwtUser,
    @Query() query: CalendarQueryDto,
  ): Promise<ApiResponse<MonthlyView>> {
    const data = await this.todosService.getMonthlyView(user.userId, query);
    return ApiResponse.success(data);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createTodo(
    @CurrentUser() user: JwtUser,
    @Body() todoDto: CreateTodoDto,
  ): Promise<ApiResponse<SafeTodo>> {
    const data = await this.todosService.create(user.userId, todoDto);
    return ApiResponse.success(data);
  }

  @Patch('reorder')
  async reorder(
    @CurrentUser() user: JwtUser,
    @Body() dto: ReorderTodosDto,
  ): Promise<ApiResponse<null>> {
    await this.todosService.reorder(user.userId, dto);
    return ApiResponse.success(null);
  }

  @Get(':id')
  @HttpCode(HttpStatus.FOUND)
  async findOne(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<SafeTodo>> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`Invalid Todo ID`);
    }
    const data = await this.todosService.findOne(user.userId, id);
    return ApiResponse.success(data);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateTodoDto,
  ): Promise<ApiResponse<SafeTodo>> {
    const data = await this.todosService.update(user.userId, id, dto);
    return ApiResponse.success(data);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateTodoStatusDto,
  ): Promise<ApiResponse<SafeTodo>> {
    const data = await this.todosService.updateStatus(user.userId, id, dto);
    return ApiResponse.success(data);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const data = await this.todosService.remove(user.userId, id);
    return ApiResponse.success(data);
  }
}

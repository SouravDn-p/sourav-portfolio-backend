import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import {
  Todo,
  TodoDocument,
  TodoPriority,
  TodoStatus,
} from './schemas/todo.schema';
import { CreateTodoDto } from './dto/create-todo.dto';
import {
  CalendarDay,
  DailyView,
  MonthlyView,
  SafeTodo,
  TodoDaySummary,
  TodoFilter,
  TodoStats,
  WeeklyView,
} from './dto/todo.types';
import {
  CalendarQueryDto,
  ReorderTodosDto,
  TodoQueryDto,
  UpdateTodoDto,
  UpdateTodoStatusDto,
} from './dto/update-todo.dto';
import { Model } from 'mongoose';

@Injectable()
export class TodoService {
  constructor(
    @InjectModel(Todo.name) private readonly todoModel: Model<TodoDocument>,
  ) {}

  async findAll(
    userId: string,
    query: TodoQueryDto,
  ): Promise<{
    todos: SafeTodo[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: TodoFilter = { userId };

    if (query.status) {
      filter.status = query.status;
    }

    if (query.priority) {
      filter.priority = query.priority;
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.label) {
      filter.labels = { $in: [query.label] };
    }

    if (query.date) {
      const start = this.normalizeDate(query.date);
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1);

      filter.dueDate = { $gte: start, $lt: end };
    } else if (query.startDate || query.endDate) {
      const range: { $gte?: Date; $lt?: Date } = {};

      if (query.startDate) {
        range.$gte = this.normalizeDate(query.startDate);
      }

      if (query.endDate) {
        const end = this.normalizeDate(query.endDate);
        end.setUTCDate(end.getUTCDate() + 1);
        range.$lt = end;
      }

      filter.dueDate = range;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [todos, total] = await Promise.all([
      this.todoModel
        .find(filter)
        .populate({
          path: 'userId',
          select: 'firstName lastName email role',
        })
        .sort({ dueDate: 1, order: 1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.todoModel.countDocuments(filter),
    ]);

    return {
      todos: todos.map((t) => this.toSafeTodo(t)),
      total,
      page,
      limit,
    };
  }

  async findOne(userId: string, id: string): Promise<SafeTodo> {
    const todo = await this.todoModel.findById(id).lean().exec();
    if (!todo) throw new NotFoundException(`Todo #${id} not found`);
    this.assertOwnership(todo as TodoDocument, userId);
    return this.toSafeTodo(todo as TodoDocument);
  }

  async create(userId: string, dto: CreateTodoDto): Promise<SafeTodo> {
    // Normalize dueDate to start of day UTC so calendar grouping works correctly
    const dueDate = this.normalizeDate(dto.dueDate);

    const todo = await this.todoModel.create({
      ...dto,
      dueDate,
      userId,
    });

    return this.toSafeTodo(todo);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTodoDto,
  ): Promise<SafeTodo> {
    const todo = await this.todoModel.findById(id);
    if (!todo) throw new NotFoundException(`Todo #${id} not found`);
    this.assertOwnership(todo, userId);

    const updateData: Partial<Todo> = { ...dto } as Partial<Todo>;

    // Normalize dueDate if changed
    if (dto.dueDate) {
      updateData.dueDate = this.normalizeDate(dto.dueDate as string);
    }

    // Auto-set completedAt when status switches to COMPLETED
    if (
      dto.status === TodoStatus.COMPLETED &&
      todo.status !== TodoStatus.COMPLETED
    ) {
      updateData.completedAt = new Date();
    }
    // Clear completedAt if status moves away from COMPLETED
    if (dto.status && dto.status !== TodoStatus.COMPLETED) {
      updateData.completedAt = undefined;
    }

    const updated = await this.todoModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .lean()
      .exec();

    return this.toSafeTodo(updated as TodoDocument);
  }

  async updateStatus(
    userId: string,
    id: string,
    dto: UpdateTodoStatusDto,
  ): Promise<SafeTodo> {
    return this.update(userId, id, dto);
  }

  async reorder(userId: string, dto: ReorderTodosDto): Promise<void> {
    // Verify all todos belong to this user
    const todos = await this.todoModel
      .find({ _id: { $in: dto.orderedIds }, userId })
      .lean()
      .exec();

    if (todos.length !== dto.orderedIds.length) {
      throw new ForbiddenException(
        'One or more todos not found or unauthorized',
      );
    }

    // Bulk update order values
    const bulkOps = dto.orderedIds.map((todoId, index) => ({
      updateOne: {
        filter: { _id: todoId, userId },
        update: { $set: { order: index } },
      },
    }));

    await this.todoModel.bulkWrite(bulkOps);
  }

  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const todo = await this.todoModel.findById(id);
    if (!todo) throw new NotFoundException(`Todo #${id} not found`);
    this.assertOwnership(todo, userId);
    await this.todoModel.findByIdAndDelete(id);
    return { deleted: true };
  }

  async getStats(userId: string): Promise<TodoStats> {
    const now = new Date();

    const [allTodos, overdue, recentCompletions] = await Promise.all([
      this.todoModel.find({ userId }).lean().exec(),
      this.todoModel.countDocuments({
        userId,
        dueDate: { $lt: now },
        status: { $nin: [TodoStatus.COMPLETED, TodoStatus.CANCELLED] },
      }),
      this.todoModel
        .find({ userId, status: TodoStatus.COMPLETED })
        .sort({ completedAt: -1 })
        .limit(5)
        .lean()
        .exec(),
    ]);

    const total = allTodos.length;
    const completed = allTodos.filter(
      (t) => t.status === TodoStatus.COMPLETED,
    ).length;

    // Priority breakdown
    const byPriority = allTodos.reduce(
      (acc, t) => {
        acc[t.priority] = (acc[t.priority] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    // Category breakdown
    const categoryMap = new Map<string, number>();
    allTodos.forEach((t) => {
      if (t.category)
        categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1);
    });
    const byCategory = Array.from(categoryMap.entries()).map(
      ([category, count]) => ({
        category,
        count,
      }),
    );

    // Label breakdown
    const labelMap = new Map<string, number>();
    allTodos.forEach((t) => {
      t.labels.forEach((l: string) =>
        labelMap.set(l, (labelMap.get(l) || 0) + 1),
      );
    });
    const byLabel = Array.from(labelMap.entries()).map(([label, count]) => ({
      label,
      count,
    }));

    return {
      allTime: {
        total,
        completed,
        pending: total - completed,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      byPriority: byPriority,
      byCategory,
      byLabel,
      recentCompletions: recentCompletions.map((t) =>
        this.toSafeTodo(t as TodoDocument),
      ),
      overdue,
    };
  }

  // ─── CALENDAR: DAILY VIEW ─────────────────────────────────────────────────
  // Returns all todos for a specific day with summary stats
  async getDailyView(
    userId: string,
    query: CalendarQueryDto,
  ): Promise<DailyView> {
    const dateStr = query.date ?? new Date().toISOString().split('T')[0];
    const start = this.normalizeDate(dateStr);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    const todos = await this.todoModel
      .find({ userId, dueDate: { $gte: start, $lt: end } })
      .sort({ order: 1, priority: 1 })
      .lean()
      .exec();

    const safeTodos = todos.map((t) => this.toSafeTodo(t as TodoDocument));

    return {
      date: dateStr,
      todos: safeTodos,
      summary: this.buildDaySummary(safeTodos),
    };
  }

  // ─── CALENDAR: WEEKLY VIEW ────────────────────────────────────────────────
  // Returns 7 days of todos. weekOf = any date in that week (Mon–Sun)
  async getWeeklyView(
    userId: string,
    query: CalendarQueryDto,
  ): Promise<WeeklyView> {
    const referenceDate = query.weekOf ? new Date(query.weekOf) : new Date();

    const { weekStart, weekEnd } = this.getWeekRange(referenceDate);

    // Single query for all 7 days
    const todos = await this.todoModel
      .find({ userId, dueDate: { $gte: weekStart, $lt: weekEnd } })
      .sort({ dueDate: 1, order: 1 })
      .lean()
      .exec();

    // Group by day
    const days = this.buildWeekDays(weekStart, todos as TodoDocument[]);

    // const allTodos = days.flatMap((d) => d.todos);
    const summary = this.buildWeekSummary(days);

    return {
      weekStart: weekStart.toISOString().split('T')[0],
      weekEnd: new Date(weekEnd.getTime() - 1).toISOString().split('T')[0],
      days,
      weekSummary: summary,
    };
  }

  // ─── CALENDAR: MONTHLY VIEW ────────────────────────────────────────────────
  // Returns all days in a month — optimized for calendar grid rendering
  async getMonthlyView(
    userId: string,
    query: CalendarQueryDto,
  ): Promise<MonthlyView> {
    const now = new Date();
    const year = query.year ?? now.getUTCFullYear();
    const month = query.month ?? now.getUTCMonth() + 1;

    const monthStart = new Date(Date.UTC(year, month - 1, 1));
    const monthEnd = new Date(Date.UTC(year, month, 1)); // First of next month

    const todos = await this.todoModel
      .find({ userId, dueDate: { $gte: monthStart, $lt: monthEnd } })
      .sort({ dueDate: 1, order: 1 })
      .lean()
      .exec();

    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const days: CalendarDay[] = [];

    // Build a day entry for EVERY day in the month (even empty days)
    // This is what the frontend calendar grid needs
    for (let d = 1; d <= daysInMonth; d++) {
      const dayDate = new Date(Date.UTC(year, month - 1, d));
      const nextDay = new Date(Date.UTC(year, month - 1, d + 1));
      const dateStr = dayDate.toISOString().split('T')[0];

      const dayTodos = (todos as TodoDocument[]).filter((t) => {
        const td = new Date(t.dueDate);
        return td >= dayDate && td < nextDay;
      });

      const safeTodos = dayTodos.map((t) => this.toSafeTodo(t));

      days.push({
        date: dateStr,
        todos: safeTodos,
        totalCount: safeTodos.length,
        completedCount: safeTodos.filter(
          (t) => t.status === TodoStatus.COMPLETED,
        ).length,
        pendingCount: safeTodos.filter((t) => t.status === TodoStatus.PENDING)
          .length,
        urgentCount: safeTodos.filter((t) => t.priority === TodoPriority.URGENT)
          .length,
      });
    }

    return {
      year,
      month,
      days,
      monthlySummary: this.buildMonthSummary(days),
    };
  }

  private normalizeDate(dateStr: string): Date {
    const d = new Date(dateStr);
    return new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
  }

  /** Get the Monday and the following Monday (exclusive end) of a week */
  private getWeekRange(date: Date): { weekStart: Date; weekEnd: Date } {
    const d = new Date(date);
    const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(
      Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() + diffToMonday,
      ),
    );
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    return { weekStart, weekEnd };
  }

  /** Build 7 CalendarDay objects from flat todo array */
  private buildWeekDays(weekStart: Date, todos: TodoDocument[]): CalendarDay[] {
    return Array.from({ length: 7 }, (_, i) => {
      const dayDate = new Date(weekStart);
      dayDate.setUTCDate(dayDate.getUTCDate() + i);
      const nextDay = new Date(dayDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const dateStr = dayDate.toISOString().split('T')[0];

      const dayTodos = todos
        .filter((t) => {
          const td = new Date(t.dueDate);
          return td >= dayDate && td < nextDay;
        })
        .map((t) => this.toSafeTodo(t));

      return {
        date: dateStr,
        todos: dayTodos,
        totalCount: dayTodos.length,
        completedCount: dayTodos.filter(
          (t) => t.status === TodoStatus.COMPLETED,
        ).length,
        pendingCount: dayTodos.filter((t) => t.status === TodoStatus.PENDING)
          .length,
        urgentCount: dayTodos.filter((t) => t.priority === TodoPriority.URGENT)
          .length,
      };
    });
  }

  private buildDaySummary(todos: SafeTodo[]): TodoDaySummary {
    const total = todos.length;
    const completed = todos.filter(
      (t) => t.status === TodoStatus.COMPLETED,
    ).length;
    return {
      total,
      completed,
      pending: todos.filter((t) => t.status === TodoStatus.PENDING).length,
      inProgress: todos.filter((t) => t.status === TodoStatus.IN_PROGRESS)
        .length,
      cancelled: todos.filter((t) => t.status === TodoStatus.CANCELLED).length,
      urgent: todos.filter((t) => t.priority === TodoPriority.URGENT).length,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  private buildWeekSummary(days: CalendarDay[]) {
    const totals = days.reduce(
      (acc, d) => ({
        total: acc.total + d.totalCount,
        completed: acc.completed + d.completedCount,
        pending: acc.pending + d.pendingCount,
        urgent: acc.urgent + d.urgentCount,
      }),
      { total: 0, completed: 0, pending: 0, urgent: 0 },
    );

    const mostProductiveDay = days.reduce(
      (best, d) => (!best || d.completedCount > best.completedCount ? d : best),
      null as CalendarDay | null,
    );

    return {
      ...totals,
      inProgress: 0,
      cancelled: 0,
      completionRate:
        totals.total > 0
          ? Math.round((totals.completed / totals.total) * 100)
          : 0,
      mostProductiveDay: mostProductiveDay?.date ?? null,
      averagePerDay: Math.round((totals.total / 7) * 10) / 10,
    };
  }

  private buildMonthSummary(days: CalendarDay[]) {
    const weekSummary = this.buildWeekSummary(days);

    // Calculate streak (consecutive days with ≥1 completion, going backwards from today)
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;
    const sortedDays = [...days].sort((a, b) => b.date.localeCompare(a.date));
    for (const day of sortedDays) {
      if (day.date > today) continue;
      if (day.completedCount > 0) streak++;
      else break;
    }

    return {
      ...weekSummary,
      averagePerDay: Math.round((weekSummary.total / days.length) * 10) / 10,
      mostProductiveWeek: null, // Could implement week grouping here
      streakDays: streak,
    };
  }

  private assertOwnership(todo: TodoDocument, userId: string): void {
    if (todo.userId !== userId) {
      throw new ForbiddenException('You do not own this todo');
    }
  }

  private toSafeTodo(todo: TodoDocument): SafeTodo {
    return {
      _id: todo._id.toString(),
      title: todo.title,
      description: todo.description,
      dueDate: todo.dueDate,
      dueTime: todo.dueTime,
      priority: todo.priority,
      status: todo.status,
      labels: todo.labels,
      category: todo.category,
      order: todo.order,
      isRecurring: todo.isRecurring,
      recurrencePattern: todo.recurrencePattern,
      parentTodoId: todo.parentTodoId,
      reminderTime: todo.reminderTime,
      completedAt: todo.completedAt,
      userId: todo.userId,
      createdAt: (todo as unknown as { createdAt: Date }).createdAt,
      updatedAt: (todo as unknown as { updatedAt: Date }).updatedAt,
    };
  }
}

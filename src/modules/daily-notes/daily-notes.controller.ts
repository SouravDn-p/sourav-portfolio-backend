import { Controller } from '@nestjs/common';
import { DailyNotesService } from './daily-notes.service';

@Controller('daily-notes')
export class DailyNotesController {
  constructor(private readonly dailyNoteService: DailyNotesService) {}
}

// src/modules/daily-notes/daily-notes.module.ts

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DailyNotesController } from './daily-notes.controller';
import { DailyNotesService } from './daily-notes.service';
import { DailyNote, DailyNoteSchema } from './schemas/daily-note.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DailyNote.name, schema: DailyNoteSchema },
    ]),
  ],
  controllers: [DailyNotesController],
  providers: [DailyNotesService],
  exports: [DailyNotesService],
})
export class DailyNotesModule {}

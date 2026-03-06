import { Injectable } from '@nestjs/common';
import { DailyNote, DailyNoteDocument } from './schemas/daily-note.schema';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

@Injectable()
export class DailyNotesService {
  constructor(
    @InjectModel(DailyNote.name)
    private readonly noteModel: Model<DailyNoteDocument>,
  ) {}
}

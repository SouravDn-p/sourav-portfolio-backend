import { Test, TestingModule } from '@nestjs/testing';
import { DailyNotesService } from './daily-notes.service';

describe('DailyNotesService', () => {
  let service: DailyNotesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DailyNotesService],
    }).compile();

    service = module.get<DailyNotesService>(DailyNotesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { CloudinaryService } from '../../services/cloudinary/cloudinary.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: ProjectsService;
  let cloudinaryService: CloudinaryService;

  const mockProjectsService = {
    getAllProjects: jest.fn(),
    getProjects: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadFile: jest.fn(),
    deleteFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjectsController],
      providers: [
        {
          provide: ProjectsService,
          useValue: mockProjectsService,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
      ],
    }).compile();

    controller = module.get<ProjectsController>(ProjectsController);
    projectsService = module.get<ProjectsService>(ProjectsService);
    cloudinaryService = module.get<CloudinaryService>(CloudinaryService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getProjects', () => {
    it('should return paginated projects', async () => {
      const result = {
        projects: [],
        total: 0,
        page: 1,
        limit: 10,
      };
      mockProjectsService.getProjects.mockResolvedValue(result);

      const query: ProjectQueryDto = { page: 1, limit: 10 };
      expect(await controller.getProjects(query)).toEqual({
        success: true,
        data: result,
        message: 'Success',
      });
    });
  });

  describe('findOne', () => {
    it('should return a single project', async () => {
      const result = { _id: '1', title: 'Test Project' };
      mockProjectsService.findOne.mockResolvedValue(result);

      expect(await controller.findOne('1')).toEqual({
        success: true,
        data: result,
        message: 'Success',
      });
    });
  });

  describe('createProject', () => {
    it('should create a project', async () => {
      const createDto: CreateProjectDto = {
        title: 'Test Project',
        description: 'Test Description',
        tags: ['test'],
        liveUrl: 'https://example.com',
        teamMember: 1,
      };
      
      const mockFile = {
        buffer: Buffer.from('test'),
        mimetype: 'image/jpeg',
      } as Express.Multer.File;
      
      const uploadResult = { url: 'https://example.com/image.jpg', publicId: 'test' };
      const createResult = { _id: '1', ...createDto, image: 'https://example.com/image.jpg' };
      
      mockCloudinaryService.uploadFile.mockResolvedValue(uploadResult);
      mockProjectsService.create.mockResolvedValue(createResult);

      expect(await controller.createProject(createDto, mockFile)).toEqual({
        success: true,
        data: createResult,
        message: 'Success',
      });
    });

    it('should throw BadRequestException when no file is provided', async () => {
      const createDto: CreateProjectDto = {
        title: 'Test Project',
        description: 'Test Description',
        tags: ['test'],
        liveUrl: 'https://example.com',
        teamMember: 1,
      };

      await expect(controller.createProject(createDto, undefined as any)).rejects.toThrow('image is required');
    });
  });

  describe('update', () => {
    it('should update a project', async () => {
      const updateDto: UpdateProjectDto = { title: 'Updated Project' };
      const result = { _id: '1', title: 'Updated Project' };
      
      mockProjectsService.update.mockResolvedValue(result);

      expect(await controller.update('1', updateDto, undefined)).toEqual({
        success: true,
        data: result,
        message: 'Success',
      });
    });
  });

  describe('remove', () => {
    it('should delete a project', async () => {
      const result = { deleted: true };
      mockProjectsService.delete.mockResolvedValue(result);

      expect(await controller.remove('1')).toEqual({
        success: true,
        data: result,
        message: 'Success',
      });
    });
  });
});

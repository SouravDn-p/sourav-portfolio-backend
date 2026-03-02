import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ApiResponse } from '../../common/types/global';
import { imageMulterOptions } from 'src/config/multer.config';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProjectDto } from './dto/create-project.dto';
import { CloudinaryService } from '../../services/cloudinary/cloudinary.service';
import { Public } from 'src/common/decorators/public.decorator';
import { SafeProject } from './schemas/project.types';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from '../users/schemas/user.schema';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectsService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  async getProjects(
    @Query() query: ProjectQueryDto,
  ): Promise<ApiResponse<{ projects: SafeProject[]; total: number; page: number; limit: number }>> {
    const result = await this.projectService.getProjects(query);
    return ApiResponse.success(result);
  }

  @Get(':id')
  @Public()
  async findOne(@Param('id') id: string): Promise<ApiResponse<SafeProject>> {
    const data = await this.projectService.findOne(id);
    return ApiResponse.success(data);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('image', imageMulterOptions))
  async createProject(
    @Body() createUserDto: CreateProjectDto,
    @UploadedFile()
    File: Express.Multer.File,
  ) {
    if (!File) {
      throw new BadRequestException('image is required');
    }

    const upload = await this.cloudinaryService.uploadFile(File, 'projects');

    const imageUrl = upload.url;

    const project = await this.projectService.create(createUserDto, imageUrl);

    return ApiResponse.success(project);
  }

  // ─── PATCH /projects/:id ─────────────────────────────────────────────────
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('image', imageMulterOptions))
  async update(
    @Param('id') id: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @UploadedFile()
    file: Express.Multer.File | undefined,
  ): Promise<ApiResponse<SafeProject>> {
    const data = await this.projectService.update(id, updateProjectDto, file);
    return ApiResponse.success(data);
  }
  // ─── DELETE /projects/:id ────────────────────────────────────────────────
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async remove(
    @Param('id') id: string,
  ): Promise<ApiResponse<{ deleted: boolean }>> {
    const data = await this.projectService.delete(id);
    return ApiResponse.success(data);
  }
}

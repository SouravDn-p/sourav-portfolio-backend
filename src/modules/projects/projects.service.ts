import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { Project, ProjectDocument } from './schemas/project.schema';
import { CreateProjectDto } from './dto/create-project.dto';
import { CloudinaryService } from '../../services/cloudinary/cloudinary.service';
import { CreateProjectResponse, SafeProject } from './schemas/project.types';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectQueryDto } from './dto/project-query.dto';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectModel(Project.name)
    private readonly projectModel: Model<ProjectDocument>,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ─── CREATE ──────────────────────────────────────────────────────────────────

  async create(
    createProjectDto: CreateProjectDto,
    imageUrl: string,
  ): Promise<CreateProjectResponse> {
    const project = await this.projectModel.create({
      ...createProjectDto,
      image: imageUrl,
    });

    return {
      _id: project.id,
      title: project.title,
      description: project.description,
      tags:
        project.tags?.map((tag) => {
          // Remove extra quotes if they exist
          if (
            typeof tag === 'string' &&
            tag.startsWith('"') &&
            tag.endsWith('"')
          ) {
            return tag.slice(1, -1);
          }
          return tag;
        }) || [],
      image: project.image,
      liveUrl: project.liveUrl,
      backendLiveUrl: project.backendLiveUrl ?? null,
      repoUrl: project.repoUrl ?? null,
      backendRepoUrl: project.backendRepoUrl ?? null,
      startingDate: project.startingDate ?? null,
      teamMember: project.teamMember,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async getAllProjects(): Promise<SafeProject[]> {
    const projects = await this.projectModel
      .find()
      .select(
        'title description tags image liveUrl backendLiveUrl repoUrl backendRepoUrl startingDate teamMember status createdAt updatedAt',
      )
      .lean<SafeProject[]>();
    return projects.map((project) => ({
      ...project,
      tags:
        project.tags?.map((tag) => {
          // Remove extra quotes if they exist
          if (
            typeof tag === 'string' &&
            tag.startsWith('"') &&
            tag.endsWith('"')
          ) {
            return tag.slice(1, -1);
          }
          return tag;
        }) || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));
  }

  async getProjects(query: ProjectQueryDto): Promise<{
    projects: SafeProject[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { status, tag, search, page = 1, limit = 10 } = query;

    const filter: {
      status?: string;
      tags?: { $in: string[] };
      $or?: Array<
        | { title?: { $regex: string; $options: string } }
        | { description?: { $regex: string; $options: string } }
      >;
    } = {};

    // Filter by status
    if (status) {
      filter.status = status;
    }

    // Filter by tag
    if (tag) {
      filter.tags = { $in: [tag] };
    }

    // Search in title and description
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [projects, total] = await Promise.all([
      this.projectModel
        .find(filter)
        .select(
          'title description tags image liveUrl backendLiveUrl repoUrl backendRepoUrl startingDate teamMember status createdAt updatedAt',
        )
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
        .lean<SafeProject[]>(),
      this.projectModel.countDocuments(filter),
    ]);

    const formattedProjects = projects.map((project) => ({
      ...project,
      tags:
        project.tags?.map((tag) => {
          // Remove extra quotes if they exist
          if (
            typeof tag === 'string' &&
            tag.startsWith('"') &&
            tag.endsWith('"')
          ) {
            return tag.slice(1, -1);
          }
          return tag;
        }) || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    }));

    return {
      projects: formattedProjects,
      total,
      page,
      limit,
    };
  }

  // ─── GET ONE ──────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<SafeProject> {
    const project = await this.projectModel
      .findById(id)
      .select(
        'title description tags image liveUrl backendLiveUrl repoUrl backendRepoUrl startingDate teamMember status createdAt updatedAt',
      )
      .lean<SafeProject>()
      .exec();
    if (!project) throw new NotFoundException(`Project #${id} not found`);

    return {
      ...project,
      tags:
        project.tags?.map((tag) => {
          // Remove extra quotes if they exist
          if (
            typeof tag === 'string' &&
            tag.startsWith('"') &&
            tag.endsWith('"')
          ) {
            return tag.slice(1, -1);
          }
          return tag;
        }) || [],
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  async update(
    id: string,
    updateProjectDto: UpdateProjectDto,
    file: Express.Multer.File | undefined,
  ): Promise<SafeProject> {
    // Validate that at least one field is provided for update
    const hasUpdateFields = Object.keys(updateProjectDto).length > 0 || file;
    if (!hasUpdateFields) {
      throw new BadRequestException(
        'At least one field must be provided for update',
      );
    }

    const exist = await this.projectModel.findById(id);
    if (!exist) throw new NotFoundException(`Project #${id} not found`);

    let imageUrl = exist.image;
    let shouldDeleteOldImage = false;

    // Handle image upload
    if (file) {
      const { url } = await this.cloudinaryService.uploadFile(file, 'projects');
      imageUrl = url;
      shouldDeleteOldImage = true;
    }

    // Prepare update data
    const updateData: Partial<Omit<Project, 'createdAt' | 'updatedAt'>> = { ...updateProjectDto };
    if (file) {
      updateData.image = imageUrl;
    }

    // Update the project
    const project = await this.projectModel
      .findByIdAndUpdate(id, updateData, { new: true, runValidators: true })
      .select(
        'title description tags image liveUrl backendLiveUrl repoUrl backendRepoUrl startingDate teamMember status createdAt updatedAt',
      )
      .lean<SafeProject>()
      .exec();

    if (!project) {
      throw new NotFoundException(`Project #${id} not found after update`);
    }

    // Delete old image from Cloudinary if a new one was uploaded
    if (shouldDeleteOldImage && exist.image) {
      try {
        // Extract public ID from Cloudinary URL
        const publicId = this.extractPublicIdFromUrl(exist.image);
        if (publicId) {
          await this.cloudinaryService.deleteFile(publicId);
        }
      } catch (error) {
        // Log error but don't fail the update operation
        console.error('Failed to delete old image from Cloudinary:', error);
      }
    }

    return {
      _id: project._id.toString(),
      title: project.title,
      description: project.description,
      tags:
        project.tags?.map((tag) => {
          // Remove extra quotes if they exist
          if (
            typeof tag === 'string' &&
            tag.startsWith('"') &&
            tag.endsWith('"')
          ) {
            return tag.slice(1, -1);
          }
          return tag;
        }) || [],
      image: project.image,
      liveUrl: project.liveUrl,
      backendLiveUrl: project.backendLiveUrl ?? null,
      repoUrl: project.repoUrl ?? null,
      backendRepoUrl: project.backendRepoUrl ?? null,
      startingDate: project.startingDate ?? null,
      teamMember: project.teamMember,
      status: project.status,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }

  private extractPublicIdFromUrl(url: string): string | null {
    // Extract public ID from Cloudinary URL
    // Example: https://res.cloudinary.com/demo/image/upload/v1234567890/sample.jpg
    // Public ID would be: sample
    const match = url.match(/\/([^/]+)\.[^.]+$/);
    return match ? match[1] : null;
  }

  async delete(id: string): Promise<{ deleted: boolean }> {
    const project = await this.projectModel.findById(id);
    if (!project) throw new NotFoundException(`Project #${id} not found`);

    // Delete image from Cloudinary
    if (project.image) {
      try {
        const publicId = this.extractPublicIdFromUrl(project.image);
        if (publicId) {
          await this.cloudinaryService.deleteFile(publicId);
        }
      } catch (error) {
        // Log error but don't fail the deletion operation
        console.error('Failed to delete image from Cloudinary:', error);
      }
    }

    await this.projectModel.findByIdAndDelete(id);
    return { deleted: true };
  }
}

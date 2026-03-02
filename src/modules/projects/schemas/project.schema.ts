import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

// Extend Project class to include Mongoose timestamps
export interface ProjectWithDate {
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectStatus {
  PENDING = 'Pending',
  STARTING = 'Starting',
  COMPLETED = 'Completed',
}

@Schema({ timestamps: true })
export class Project implements ProjectWithDate {
  @Prop({ required: true, trim: true })
  title!: string;

  @Prop({ required: true })
  description!: string;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  @Prop({ required: true })
  image!: string;

  @Prop({ required: true })
  liveUrl!: string;

  @Prop({ default: null })
  backendLiveUrl?: string;

  @Prop({ default: null })
  repoUrl?: string;

  @Prop({ default: null })
  backendRepoUrl?: string;

  @Prop({ default: null })
  startingDate?: string;

  @Prop({ default: null })
  updateDate?: string;

  @Prop({ required: true })
  teamMember!: number;

  @Prop({ type: String, enum: ProjectStatus, default: ProjectStatus.PENDING })
  status!: ProjectStatus;

  // These are added by Mongoose timestamps
  createdAt!: Date;
  updatedAt!: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);

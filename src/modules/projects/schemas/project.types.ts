import { ProjectStatus } from '../schemas/project.schema';

export interface CreateProjectResponse {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  image: string;
  liveUrl: string;
  backendLiveUrl: string | null;
  repoUrl: string | null;
  backendRepoUrl: string | null;
  startingDate: string | null;
  teamMember: number;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface SafeProject {
  _id: string;
  title: string;
  description: string;
  tags: string[];
  image: string;
  liveUrl: string;
  backendLiveUrl: string | null;
  repoUrl: string | null;
  backendRepoUrl: string | null;
  startingDate: string | null;
  teamMember: number;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectQuery {
  status?: ProjectStatus;
  tag?: string;
  search?: string;
}

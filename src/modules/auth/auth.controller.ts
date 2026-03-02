import { UsersService } from './../users/users.service';
import {
  Body,
  Controller,
  Post,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
  Get,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginDto } from '../users/dto/login.dto';

import { CreateUserResponse, SafeUser } from '../users/types/user.types';
import { ApiResponse } from 'src/common/types/global';
import type { JwtUser } from 'src/common/types/auth.types';
import { Public } from 'src/common/decorators/public.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CloudinaryService } from 'src/services/cloudinary/cloudinary.service';
import { imageMulterOptions } from 'src/config/multer.config';

const ACCESS_MAX_AGE = 15 * 60 * 1000;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function buildCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict' as const,
    maxAge,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly cloudinaryServe: CloudinaryService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('image', imageMulterOptions))
  async register(
    @Body() createUserDto: CreateUserDto,
    @UploadedFile()
    file: Express.Multer.File,
  ): Promise<ApiResponse<CreateUserResponse>> {
    const exist = await this.usersService.findByEmail(createUserDto.email);

    if (exist) {
      throw new BadRequestException('Email ALready Register');
    }
    let imageUrl: string | null = null;

    if (file) {
      const upload = await this.cloudinaryServe.uploadFile(
        file,
        'nest-practice',
      );
      imageUrl = upload.url;
    }
    const data = await this.authService.register(createUserDto, imageUrl);
    return ApiResponse.success(data);
  }

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<{ user: SafeUser }>> {
    const result = await this.authService.login(loginDto);

    res.cookie(
      'accessToken',
      result.accessToken,
      buildCookieOptions(ACCESS_MAX_AGE),
    );
    res.cookie(
      'refreshToken',
      result.refreshToken,
      buildCookieOptions(REFRESH_MAX_AGE),
    );

    return ApiResponse.success({ user: result.user });
  }

  @Post('refresh')
  @Public()
  @UseGuards(AuthGuard('jwt-refresh'))
  @HttpCode(HttpStatus.OK)
  async refresh(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<null>> {
    const tokens = await this.authService.refresh(user);

    res.cookie(
      'accessToken',
      tokens.accessToken,
      buildCookieOptions(ACCESS_MAX_AGE),
    );
    res.cookie(
      'refreshToken',
      tokens.refreshToken,
      buildCookieOptions(REFRESH_MAX_AGE),
    );

    return ApiResponse.success(null);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: JwtUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiResponse<null>> {
    await this.authService.logout(user.userId);
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    return ApiResponse.success(null);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(
    @CurrentUser() user: JwtUser,
  ): Promise<ApiResponse<SafeUser | null>> {
    const safeUser = await this.authService['usersService'].findSafeById(
      user.userId,
    );
    return ApiResponse.success(safeUser);
  }
}

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ApiResponse } from '../types/global';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();

    return next.handle().pipe(
      map((data: T | ApiResponse<T>) => {
        const statusCode = response.statusCode;
        const path = request.originalUrl;
        const timestamp = new Date().toISOString();

        const meta = {
          statusCode,
          path,
          timestamp,
        };

        // If controller already returned ApiResponse
        if (this.isApiResponse(data)) {
          return {
            ...data,
            statusCode,
            meta: {
              ...(data.meta || {}),
              ...meta,
            },
          };
        }

        // Otherwise wrap raw data
        return {
          statusCode,
          success: true,
          message: this.getSuccessMessage(statusCode),
          data,
          meta,
        };
      }),
    );
  }

  private isApiResponse(data: unknown): data is ApiResponse<unknown> {
    return (
      data !== null &&
      typeof data === 'object' &&
      'success' in data &&
      'message' in data
    );
  }

  private getSuccessMessage(statusCode: number): string {
    switch (statusCode) {
      case 200:
        return 'Request successful';
      case 201:
        return 'Resource created successfully';
      case 204:
        return 'Request processed successfully';
      default:
        return 'Operation completed successfully';
    }
  }
}

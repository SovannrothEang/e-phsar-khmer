import type { Request } from 'express';
import type { RequestUser } from './api-response.types';

export interface RequestWithUser extends Request {
  user?: RequestUser;
}

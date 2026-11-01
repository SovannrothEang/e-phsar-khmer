export interface PaginationMeta {
  nextCursor: string | null;
  hasMore: boolean;
  limit: number;
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ErrorDetail {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  meta?: PaginationMeta;
  error?: ErrorDetail;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface RequestUser {
  id: string;
  role: 'user' | 'admin' | 'super_admin';
  /**
   * The device row's revocation epoch (`sid` claim). Absent on legacy tokens
   * and on clients that never sent device headers (admin/social/Telegram).
   */
  sessionId?: string | null;
}

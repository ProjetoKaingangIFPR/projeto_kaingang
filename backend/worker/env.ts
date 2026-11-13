export interface Env {
  DB: D1Database;
  FRONTEND_ORIGIN?: string;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  MEDIA: R2Bucket;
}

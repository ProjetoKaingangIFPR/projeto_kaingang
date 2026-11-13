export interface Env {
  DB: D1Database;
  FRONTEND_ORIGIN?: string;
  // Credenciais de criação inicial; ignoradas quando a conta já existe no D1.
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  MEDIA: R2Bucket;
}

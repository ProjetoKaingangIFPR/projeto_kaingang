import { timingSafeEqual } from 'hono/utils/buffer';
import { z } from 'zod';
import { hashPassword, verifyPassword } from './password';
import type { Env } from './env';

export const loginSchema = z.object({ username: z.string().min(1).max(120), password: z.string().min(1).max(1024) });
export const changePasswordSchema = z.object({ currentPassword: z.string().min(1).max(1024), newPassword: z.string().min(1).max(1024) });
export interface AdminUser { id: number; username: string; password_hash: string; session_version: string }

export const hashToken = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('');
export const getAdmin = (db: D1Database) => db.prepare('SELECT id, username, password_hash, session_version FROM admin_users WHERE id = 1').first<AdminUser>();
export const bootstrapConfigured = (env: Env) => Boolean(env.ADMIN_USERNAME && env.ADMIN_USERNAME.length <= 120 && env.ADMIN_PASSWORD && env.ADMIN_PASSWORD.length <= 1024);

// Reserva cada tentativa antes da verificação, em uma única operação atômica.
export async function reserveAttempt(db: D1Database, client: string, now: number): Promise<boolean> {
  const row = await db.prepare(`INSERT INTO login_attempts (client_hash, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(client_hash) DO UPDATE SET
      count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
      expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END
    WHERE expires_at <= ? OR count < 10 RETURNING count`)
    .bind(client, now + 900000, now, now, now).first();
  return Boolean(row);
}

export async function authenticate(env: Env, username: string, password: string): Promise<AdminUser | null> {
  let user = await getAdmin(env.DB);
  if (!user) {
    if (!bootstrapConfigured(env)) return null;
    const usernameOK = await timingSafeEqual(username, env.ADMIN_USERNAME!);
    const passwordOK = await timingSafeEqual(password, env.ADMIN_PASSWORD!);
    if (!usernameOK || !passwordOK) return null;
    const encoded = await hashPassword(password);
    await env.DB.prepare('INSERT OR IGNORE INTO admin_users (id, username, password_hash, session_version, updated_at) VALUES (1, ?, ?, ?, ?)')
      .bind(username, encoded, crypto.randomUUID(), Date.now()).run();
    // Outra requisição pode ter criado a conta ou alterado a senha nesse intervalo.
    user = await getAdmin(env.DB);
  }
  if (!user) return null;
  // Verifica a senha mesmo quando o nome não coincide, sem revelar qual campo falhou.
  const passwordOK = await verifyPassword(user.password_hash, password);
  const usernameOK = await timingSafeEqual(username, user.username);
  return usernameOK && passwordOK ? user : null;
}

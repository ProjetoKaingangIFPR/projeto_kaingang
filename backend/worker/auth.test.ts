import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import app from './index';
import { reserveAttempt } from './auth';
import { hashPassword, verifyPassword } from './password';
import type { Env } from './env';

function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  for (const file of ['0001_virtual_tour.sql', '0002_admin_accounts.sql']) {
    sqlite.exec(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  }
  function prepare(sql: string) {
    let values: (string | number | null)[] = [];
    return {
      bind(...args: (string | number | null)[]) { values = args; return this; },
      async first() { return sqlite.prepare(sql).get(...values) ?? null; },
      async run() {
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, results: [], meta: { changes: Number(result.changes) } };
      },
    };
  }
  const db = { prepare, async batch(statements: ReturnType<typeof prepare>[]) {
    sqlite.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec('COMMIT');
      return results;
    } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } } as unknown as D1Database;
  return { db, sqlite };
}

test('migração remove sessões legadas e preserva tour e mídia existentes', () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(readFileSync(new URL('../migrations/0001_virtual_tour.sql', import.meta.url), 'utf8'));
    sqlite.exec(`INSERT INTO tours VALUES ('published', '{}', 1);
      INSERT INTO media VALUES ('image', 'tours/image', 'image/jpeg', 4, 1);
      INSERT INTO admin_sessions VALUES ('old-token-hash', 'old-password-fingerprint', 9999999999999);`);
    sqlite.exec(readFileSync(new URL('../migrations/0002_admin_accounts.sql', import.meta.url), 'utf8'));
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM tours').get()!.count, 1);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM media').get()!.count, 1);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM admin_sessions').get()!.count, 0);
    assert.equal(sqlite.prepare('PRAGMA table_info(admin_sessions)').all().some(row => row.name === 'credential_version'), false);
  } finally { sqlite.close(); }
});

test('Argon2id usa salt único, formato PHC e rejeita senha incorreta', async () => {
  const password = 'uma-senha-forte-de-teste';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.match(first, /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(first, password), true);
  assert.equal(await verifyPassword(first, 'senha-incorreta'), false);
  assert.equal(await verifyPassword(first, 'x'), false);
  assert.equal(await verifyPassword('formato-invalido', password), false);
  // Vetor gerado pela implementação de referência libargon2, salt 00..0f.
  const reference = '$argon2id$v=19$m=19456,t=2,p=1$AAECAwQFBgcICQoLDA0ODw$2BBcBwk3z8tyNVu7Rt3K/kTR7Sf9czN2wz/77vvWwYY';
  assert.equal(await verifyPassword(reference, 'senha-vetor-de-teste'), true);
});

test('reserva atômica aceita somente dez tentativas simultâneas e libera após expirar', async () => {
  const { db, sqlite } = database();
  try {
    const results = await Promise.all(Array.from({ length: 30 }, () => reserveAttempt(db, 'client', 1000)));
    assert.equal(results.filter(Boolean).length, 10);
    assert.equal(await reserveAttempt(db, 'client', 901001), true);
  } finally { sqlite.close(); }
});

test('login em andamento não cria sessão se a senha mudar após a verificação', async () => {
  const { db, sqlite } = database();
  try {
    const password = 'senha-antes-da-troca';
    sqlite.prepare('INSERT INTO admin_users VALUES (1, ?, ?, ?, ?)').run('admin', await hashPassword(password), 'version-before', Date.now());
    const racingDb = {
      prepare: db.prepare.bind(db),
      async batch(statements: D1PreparedStatement[]) {
        sqlite.prepare('UPDATE admin_users SET session_version = ? WHERE id = 1').run('version-after');
        return db.batch(statements);
      },
    } as unknown as D1Database;
    const response = await app.fetch(new Request('https://example.com/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password }),
    }), { DB: racingDb } as Env);
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('Set-Cookie'), null);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM admin_sessions').get()!.count, 0);
  } finally { sqlite.close(); }
});

test('conta, login, sessões, troca de senha, revogação e logout com SQL real', async () => {
  const { db, sqlite } = database();
  const initialPassword = 'senha-inicial-segura';
  const newPassword = 'nova-senha-bem-segura';
  const env = { DB: db, ADMIN_USERNAME: 'admin', ADMIN_PASSWORD: initialPassword } as Env;
  let client = 0;
  const request = (path: string, body?: unknown, cookie?: string, customEnv = env) => app.fetch(new Request(`https://example.com/api/admin/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': `192.0.2.${++client}`, ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }), customEnv);
  const login = (password: string, customEnv = env) => request('login', { username: 'admin', password }, undefined, customEnv);
  const cookieOf = (response: Response) => response.headers.get('Set-Cookie')!.split(';')[0];
  try {
    assert.equal((await request('password', { currentPassword: initialPassword, newPassword })).status, 401);
    assert.equal((await login('errada')).status, 401);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM admin_users').get()!.count, 0);
    const first = await login(initialPassword);
    assert.equal(first.status, 200);
    assert.match(first.headers.get('Set-Cookie')!, /HttpOnly/);
    assert.match(first.headers.get('Set-Cookie')!, /Secure/);
    assert.match(first.headers.get('Set-Cookie')!, /SameSite=Strict/);
    const firstCookie = cookieOf(first);
    const secondCookie = cookieOf(await login(initialPassword));
    const user = sqlite.prepare('SELECT * FROM admin_users').get()!;
    assert.match(String(user.password_hash), /^\$argon2id\$/);
    assert.equal(JSON.stringify(user).includes(initialPassword), false);
    const session = sqlite.prepare('SELECT * FROM admin_sessions LIMIT 1').get()!;
    assert.equal(firstCookie.includes(String(session.token_hash)), false);
    assert.equal('credential_version' in session, false);
    assert.equal((await (await request('session', undefined, firstCookie)).json() as {authenticated:boolean}).authenticated, true);
    const noSecrets = { DB: db } as Env;
    assert.equal((await login(initialPassword, noSecrets)).status, 200);
    assert.equal((await request('login', { username: 'outro', password: initialPassword })).status, 401);
    assert.equal((await request('password', { currentPassword: 'errada', newPassword }, firstCookie)).status, 401);
    assert.equal((await request('password', { currentPassword: initialPassword, newPassword: 'curta' }, firstCookie)).status, 400);
    assert.equal((await request('password', { currentPassword: initialPassword, newPassword: initialPassword }, firstCookie)).status, 400);
    const changed = await request('password', { currentPassword: initialPassword, newPassword }, firstCookie);
    assert.equal(changed.status, 200);
    assert.match(changed.headers.get('Set-Cookie')!, /Max-Age=0/);
    assert.equal(sqlite.prepare('SELECT count(*) AS count FROM admin_sessions').get()!.count, 0);
    for (const cookie of [firstCookie, secondCookie]) {
      assert.equal((await (await request('session', undefined, cookie)).json() as {authenticated:boolean}).authenticated, false);
      assert.equal((await request('password', { currentPassword: newPassword, newPassword: initialPassword }, cookie)).status, 401);
    }
    // O segredo inicial não recupera acesso depois que a senha foi trocada.
    assert.equal((await login(initialPassword)).status, 401);
    const current = await login(newPassword, noSecrets);
    assert.equal(current.status, 200);
    const currentCookie = cookieOf(current);
    await request('logout', {}, currentCookie, noSecrets);
    assert.equal((await (await request('session', undefined, currentCookie, noSecrets)).json() as {authenticated:boolean}).authenticated, false);
    const expiredCookie = cookieOf(await login(newPassword));
    sqlite.prepare('UPDATE admin_sessions SET expires_at = 0').run();
    assert.equal((await (await request('session', undefined, expiredCookie)).json() as {authenticated:boolean}).authenticated, false);
    assert.equal((await request('login', null)).status, 400);
  } finally { sqlite.close(); }
});

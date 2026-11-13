import setupWasm from 'argon2id/lib/setup.js';
import argonModule from 'argon2id/dist/no-simd.wasm';
import { timingSafeEqual } from 'hono/utils/buffer';

// OWASP: Argon2id, 19 MiB, duas passagens, paralelismo 1.
// Import estático: Workers não permite compilar WASM durante a requisição.
const memorySize = 19456;
const passes = 2;
const encoder = new TextEncoder();
const instantiate = async (imports: WebAssembly.Imports) => ({ instance: await WebAssembly.instantiate(argonModule, imports), module: argonModule });
const getArgon = () => setupWasm(instantiate, instantiate);
let argon: ReturnType<typeof getArgon> | undefined;
const encode = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=+$/, '');
const decode = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array): Promise<Uint8Array> {
  const compute = await (argon ??= getArgon());
  const bytes = encoder.encode(password);
  try { return compute({ password: bytes, salt, parallelism: 1, passes, memorySize, tagLength: 32 }); }
  finally { bytes.fill(0); }
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const digest = await derive(password, salt);
  return `$argon2id$v=19$m=${memorySize},t=${passes},p=1$${encode(salt)}$${encode(digest)}`;
}

export async function verifyPassword(encoded: string, password: string): Promise<boolean> {
  // Só aceitamos o formato emitido aqui, impedindo parâmetros de custo arbitrário.
  const match = /^\$argon2id\$v=19\$m=19456,t=2,p=1\$([A-Za-z0-9+/]{22})\$([A-Za-z0-9+/]{43})$/.exec(encoded);
  if (!match) return false;
  if (encoder.encode(password).length < 8) return false;
  const digest = await derive(password, decode(match[1]));
  return timingSafeEqual(encode(digest), match[2]);
}

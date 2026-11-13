import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { bodyLimit } from 'hono/body-limit';
import type { Env } from './env';
import { tourSchema } from './tour-schema';
import { loadTour, saveTour } from './tour-store';
import { authenticate, bootstrapConfigured, changePasswordSchema, getAdmin, hashToken, loginSchema, reserveAttempt } from './auth';
import { hashPassword, verifyPassword } from './password';
const app = new Hono<{Bindings: Env; Variables: {authenticated: boolean; userId: number | undefined}}>();
const cookie = 'kaingang_admin';
app.use('/api/*', async (c,next) => {
 c.header('Cache-Control','no-store');
 c.header('X-Content-Type-Options','nosniff');
 if (!['GET','HEAD'].includes(c.req.method) && (c.req.header('Origin') && ![new URL(c.req.url).origin,c.env.FRONTEND_ORIGIN].includes(c.req.header('Origin')))) return c.json({error:'Origem não permitida.'},403);
 const token = getCookie(c,cookie);
 const session = token ? await c.env.DB.prepare(`SELECT s.user_id FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
   WHERE s.token_hash = ? AND s.session_version = u.session_version AND s.expires_at > ?`).bind(await hashToken(token),Date.now()).first<{user_id: number}>() : null;
 c.set('authenticated',Boolean(session));
 c.set('userId',session?.user_id);
 await next();
});
app.get('/api/admin/session', async c => c.json({authenticated:c.get('authenticated'),configured:Boolean(await getAdmin(c.env.DB)) || bootstrapConfigured(c.env)}));
app.post('/api/admin/login',bodyLimit({maxSize:4096}),async c => {
 if (!await getAdmin(c.env.DB) && !bootstrapConfigured(c.env)) return c.json({error:'Configure as credenciais iniciais com uma senha de pelo menos 12 caracteres.'},503);
 const now=Date.now(); const client=await hashToken(c.req.header('CF-Connecting-IP') || 'local');
 if (!await reserveAttempt(c.env.DB,client,now)) return c.json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 const parsed=loginSchema.safeParse(await c.req.json().catch(()=>null));
 if (!parsed.success) return c.json({error:'Informe usuário e senha válidos.'},400);
 const user=await authenticate(c.env,parsed.data.username,parsed.data.password);
 if (!user) return c.json({error:'Usuário ou senha inválidos.'},401);
 const token=crypto.randomUUID()+crypto.randomUUID();
 const results=await c.env.DB.batch([c.env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),
   c.env.DB.prepare('DELETE FROM login_attempts WHERE expires_at <= ?').bind(now),
   c.env.DB.prepare(`INSERT INTO admin_sessions (token_hash, user_id, session_version, expires_at)
     SELECT ?, id, session_version, ? FROM admin_users WHERE id = ? AND session_version = ?`)
     .bind(await hashToken(token),now+28800000,user.id,user.session_version)]);
 if (!results[2].meta.changes) return c.json({error:'A senha foi alterada. Entre novamente.'},401);
 setCookie(c,cookie,token,{httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:',path:'/',maxAge:28800});
 return c.json({authenticated:true});
});
app.post('/api/admin/logout',async c=>{const token=getCookie(c,cookie);if(token)await c.env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await hashToken(token)).run();setCookie(c,cookie,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:'});return c.json({authenticated:false});});
app.get('/api/tour',async c=>c.json({tour:await loadTour(c.env.DB)}));
app.use('/api/admin/*',async(c,next)=>{if(!c.get('authenticated'))return c.json({error:'Entre novamente para continuar.'},401);await next();});
app.post('/api/admin/password',bodyLimit({maxSize:8192}),async c=>{
 const now=Date.now();
 const client=await hashToken(`password:${c.req.header('CF-Connecting-IP') || 'local'}`);
 if (!await reserveAttempt(c.env.DB,client,now)) return c.json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 const parsed=changePasswordSchema.safeParse(await c.req.json().catch(()=>null));
 if (!parsed.success) return c.json({error:'Informe a senha atual e uma nova senha de 12 a 1024 caracteres.'},400);
 const user=await getAdmin(c.env.DB);
 if (!user || user.id!==c.get('userId') || !await verifyPassword(user.password_hash,parsed.data.currentPassword)) return c.json({error:'Senha atual inválida.'},401);
 if (parsed.data.currentPassword===parsed.data.newPassword) return c.json({error:'Escolha uma senha diferente da atual.'},400);
 const passwordHash=await hashPassword(parsed.data.newPassword);
 const results=await c.env.DB.batch([
   c.env.DB.prepare('UPDATE admin_users SET password_hash = ?, session_version = ?, updated_at = ? WHERE id = ? AND session_version = ?')
     .bind(passwordHash,crypto.randomUUID(),now,user.id,user.session_version),
   // Remove somente sessões desatualizadas, sem apagar um login com a nova senha.
   c.env.DB.prepare('DELETE FROM admin_sessions WHERE user_id = ? AND session_version != (SELECT session_version FROM admin_users WHERE id = ?)').bind(user.id,user.id),
 ]);
 if (!results[0].meta.changes) return c.json({error:'A senha já foi alterada. Entre novamente.'},409);
 setCookie(c,cookie,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:'});
 return c.json({changed:true,authenticated:false});
});
app.put('/api/admin/tour',bodyLimit({maxSize:1000000}),async c=>{const parsed=tourSchema.safeParse(await c.req.json());if(!parsed.success)return c.json({error:parsed.error.issues[0]?.message || 'Planta inválida.'},400);await saveTour(c.env.DB,parsed.data);return c.json({saved:true});});
app.post('/api/admin/media',bodyLimit({maxSize:20*1024*1024}),async c=>{
 const type=c.req.header('Content-Type')?.split(';')[0];
 if(!['image/jpeg','image/png','image/webp'].includes(type || ''))return c.json({error:'Envie uma imagem JPEG, PNG ou WebP.'},415);
 const bytes=await c.req.arrayBuffer();const b=new Uint8Array(bytes);
 const valid=type==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:type==='image/png'?b[0]===137&&b[1]===80&&b[2]===78&&b[3]===71:new TextDecoder().decode(b.slice(0,4))==='RIFF'&&new TextDecoder().decode(b.slice(8,12))==='WEBP';
 if(!valid)return c.json({error:'Arquivo de imagem inválido.'},400);
 if(!c.env.MEDIA)return c.json({error:'Configure o bucket R2 para enviar imagens.'},503);
 const id=crypto.randomUUID(),key=`tours/${id}`;
 await c.env.MEDIA.put(key,bytes,{httpMetadata:{contentType:type!}});
 await c.env.DB.prepare('INSERT INTO media VALUES (?,?,?,?,?)').bind(id,key,type,bytes.byteLength,Date.now()).run();
 return c.json({url:`/api/media/${id}`},201);
});
app.get('/api/media/:id',async c=>{
 const media=await c.env.DB.prepare('SELECT object_key, content_type FROM media WHERE id = ?').bind(c.req.param('id')).first<{object_key:string;content_type:string}>();if(!media)return c.json({error:'Imagem não encontrada.'},404);
 if(!c.env.MEDIA)return c.json({error:'Configure o bucket R2 para acessar imagens.'},503);
 const object=await c.env.MEDIA.get(media.object_key);if(!object)return c.json({error:'Imagem não encontrada.'},404);
 return new Response(object.body,{headers:{'Content-Type':media.content_type,'Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff'}});
});
app.all('/api/*',c=>c.json({error:'Recurso não encontrado.'},404));
app.all('*',c=>c.json({error:'Recurso não encontrado.'},404));
app.onError((error,c)=>{console.error(error.message);return c.json({error:'Não foi possível concluir a operação.'},500);});
export default app;

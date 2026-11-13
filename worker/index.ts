import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { timingSafeEqual } from 'hono/utils/buffer';
import { bodyLimit } from 'hono/body-limit';
import type { Env } from './env';
import { tourSchema } from './tour-schema';
import { loadTour, saveTour } from './tour-store';
const app = new Hono<{Bindings: Env; Variables: {authenticated: boolean}}>();
const hash = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))), b => b.toString(16).padStart(2,'0')).join('');
const cookie = 'kaingang_admin';
app.use('/api/*', async (c,next) => {
 c.header('Cache-Control','no-store');
 c.header('X-Content-Type-Options','nosniff');
 if (!['GET','HEAD'].includes(c.req.method) && ((c.req.header('Origin') && c.req.header('Origin') !== new URL(c.req.url).origin) || c.req.header('Sec-Fetch-Site') === 'cross-site')) return c.json({error:'Origem não permitida.'},403);
 const token = getCookie(c,cookie);
 const version = await hash(`${c.env.ADMIN_USERNAME}\0${c.env.ADMIN_PASSWORD}`);
 const session = token && c.env.ADMIN_PASSWORD && await c.env.DB.prepare('SELECT token_hash FROM admin_sessions WHERE token_hash = ? AND credential_version = ? AND expires_at > ?').bind(await hash(token),version,Date.now()).first();
 c.set('authenticated',Boolean(session));
 await next();
});
app.get('/api/admin/session', c => c.json({authenticated:c.get('authenticated'),configured:Boolean(c.env.ADMIN_USERNAME && c.env.ADMIN_PASSWORD)}));
app.post('/api/admin/login',bodyLimit({maxSize:4096}),async c => {
 if (!c.env.ADMIN_USERNAME || !c.env.ADMIN_PASSWORD) return c.json({error:'Configure as credenciais administrativas.'},503);
 const now=Date.now(); const client=await hash(c.req.header('CF-Connecting-IP') || 'local');
 const attempt=await c.env.DB.prepare('SELECT count FROM login_attempts WHERE client_hash = ? AND expires_at > ?').bind(client,now).first<{count:number}>();
 if (attempt && attempt.count>=10) return c.json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 const body=await c.req.json();
 const userOK=await timingSafeEqual(String(body.username || ''),c.env.ADMIN_USERNAME);
 const passOK=await timingSafeEqual(String(body.password || ''),c.env.ADMIN_PASSWORD);
 if (!userOK || !passOK) {
 await c.env.DB.prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(client_hash) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END').bind(client,now+900000,now,now).run();
 return c.json({error:'Usuário ou senha inválidos.'},401);
 }
 const token=crypto.randomUUID()+crypto.randomUUID();
 await c.env.DB.batch([c.env.DB.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').bind(now),c.env.DB.prepare('DELETE FROM login_attempts WHERE client_hash = ? OR expires_at <= ?').bind(client,now),c.env.DB.prepare('INSERT INTO admin_sessions VALUES (?,?,?)').bind(await hash(token),await hash(`${c.env.ADMIN_USERNAME}\0${c.env.ADMIN_PASSWORD}`),now+28800000)]);
 setCookie(c,cookie,token,{httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:',path:'/',maxAge:28800});
 return c.json({authenticated:true});
});
app.post('/api/admin/logout',async c=>{const token=getCookie(c,cookie);if(token)await c.env.DB.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').bind(await hash(token)).run();setCookie(c,cookie,'',{path:'/',maxAge:0,httpOnly:true,sameSite:'Strict',secure:new URL(c.req.url).protocol==='https:'});return c.json({authenticated:false});});
app.get('/api/tour',async c=>c.json({tour:await loadTour(c.env.DB)}));
app.use('/api/admin/*',async(c,next)=>{if(!c.get('authenticated'))return c.json({error:'Entre novamente para continuar.'},401);await next();});
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
app.all('*',c=>c.env.ASSETS.fetch(c.req.raw));
app.onError((error,c)=>{console.error(error.message);return c.json({error:'Não foi possível concluir a operação.'},500);});
export default app;

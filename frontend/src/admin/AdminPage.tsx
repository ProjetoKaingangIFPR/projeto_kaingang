import React, { useEffect, useState } from 'react';
import { ArrowLeft, LockKeyhole, MapPinned } from 'lucide-react';
import VirtualVisitsPage from '../VirtualVisitsPage';
import { api } from './api';

export default function AdminPage() {
  const [session, setSession] = useState<{ authenticated: boolean; configured: boolean } | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const checkSession = () => {
    setError('');
    api<{ authenticated: boolean; configured: boolean }>('/api/admin/session')
      .then(setSession).catch(() => setError('Não foi possível conectar ao servidor. Tente novamente.'));
  };
  useEffect(checkSession, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
      setPassword('');
      setSession({ authenticated: true, configured: true });
    } catch (error) { setError(error instanceof Error ? error.message : 'Falha ao entrar.'); }
    finally { setBusy(false); }
  };

  if (session?.authenticated) return <VirtualVisitsPage administrative onSessionEnd={() => setSession({ authenticated: false, configured: true })} />;

  return (
    <main className="min-h-screen bg-[#101812] text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <a href="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white mb-8"><ArrowLeft size={16} /> Voltar ao site</a>
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-9 shadow-2xl">
          <div className="inline-flex rounded-xl bg-[#8B0000] p-3 mb-6"><LockKeyhole size={24} /></div>
          <p className="text-xs tracking-widest uppercase text-white/50 mb-2">Memórias da Escola Indígena</p>
          <h1 className="text-2xl font-bold">Painel administrativo</h1>
          <p className="text-sm text-white/65 mt-3 mb-6">Entre para gerenciar a planta e os pontos da visita virtual.</p>
          {!session ? (
            <div role="status" className="text-sm text-white/70">{error || 'Verificando acesso…'}{error && <button onClick={checkSession} className="block underline mt-3">Tentar novamente</button>}</div>
          ) : (
            <form onSubmit={login} className="space-y-5">
              {!session.configured && <p role="alert" className="text-sm text-amber-200">O acesso administrativo ainda não foi configurado. Defina ADMIN_USERNAME e ADMIN_PASSWORD no .env e reinicie o servidor.</p>}
              <div><label htmlFor="admin-username" className="block text-sm mb-2">Usuário</label><input id="admin-username" autoComplete="username" required value={username} onChange={e => setUsername(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-3 outline-none focus:ring-2 focus:ring-white/50" /></div>
              <div><label htmlFor="admin-password" className="block text-sm mb-2">Senha</label><input id="admin-password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-lg border border-white/20 bg-black/25 px-3 py-3 outline-none focus:ring-2 focus:ring-white/50" /></div>
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <button type="submit" disabled={busy || !session.configured} className="w-full flex justify-center items-center gap-2 rounded-lg bg-[#8B0000] hover:bg-[#a30000] px-4 py-3 font-semibold disabled:opacity-50"><MapPinned size={18} />{busy ? 'Entrando…' : 'Entrar no painel'}</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}

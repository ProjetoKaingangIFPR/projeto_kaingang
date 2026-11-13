import { useState, type FormEvent } from 'react';
import { api } from './api';

export default function ChangePasswordModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmation) { setError('As novas senhas não coincidem.'); return; }
    setBusy(true);
    try {
      await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
      onChanged();
    } catch (error) { setError(error instanceof Error ? error.message : 'Não foi possível alterar a senha.'); }
    finally { setBusy(false); }
  };
  const inputClass = 'w-full rounded-lg border border-white/20 bg-black/25 px-3 py-3 outline-none focus:ring-2 focus:ring-white/50';
  return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
    <section role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="w-full max-w-md rounded-2xl bg-[#1c2720] p-6 text-white shadow-2xl">
      <h2 id="change-password-title" className="text-xl font-bold">Alterar senha</h2>
      <p className="my-3 text-sm text-white/70">Use pelo menos 12 caracteres. Todos os acessos serão encerrados e você precisará entrar com a nova senha.</p>
      <form onSubmit={submit} className="space-y-4">
        <div><label htmlFor="current-password" className="mb-2 block text-sm">Senha atual</label><input autoFocus id="current-password" type="password" autoComplete="current-password" required maxLength={1024} disabled={busy} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className={inputClass} /></div>
        <div><label htmlFor="new-password" className="mb-2 block text-sm">Nova senha</label><input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} disabled={busy} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputClass} /></div>
        <div><label htmlFor="confirm-password" className="mb-2 block text-sm">Confirmar nova senha</label><input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={1024} disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputClass} /></div>
        {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onClose} disabled={busy} className="rounded-lg px-4 py-2 disabled:opacity-50">Cancelar</button><button type="submit" disabled={busy} className="rounded-lg bg-[#8B0000] px-4 py-2 disabled:opacity-50">{busy ? 'Alterando…' : 'Alterar senha'}</button></div>
      </form>
    </section>
  </div>;
}

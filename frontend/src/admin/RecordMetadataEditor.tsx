import { useState } from 'react';

export type RecordMetadata = { author: string | null; recorded_on: string | null };
export default function RecordMetadataEditor({ value, onChange, onSave, disabled }: {
  value: RecordMetadata; onChange?: (value: RecordMetadata) => void;
  onSave?: (value: RecordMetadata) => Promise<void>; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  function change(next: RecordMetadata) { setDraft(next); setFeedback(''); onChange?.(next); }
  return <details className="mt-3 border-t border-white/15 pt-3 text-sm">
    <summary className="cursor-pointer break-words text-white/75 hover:text-white">{[value.author, value.recorded_on?.split('-').reverse().join('/')].filter(Boolean).join(' · ') || 'Adicionar autor e data'}</summary>
    <fieldset disabled={disabled || busy} className="mt-3 min-w-0 space-y-2">
    <label className="block">Autor (opcional)
      <input maxLength={180} value={draft.author ?? ''} onChange={e => change({ ...draft, author: e.target.value || null })}
        className="mt-1 block w-full min-w-0 rounded border border-white/20 bg-neutral-950 p-2"/>
    </label>
    <label className="block">Data do registro (opcional)
      <input type="date" value={draft.recorded_on ?? ''} onChange={e => change({ ...draft, recorded_on: e.target.value || null })}
        className="mt-1 block w-full min-w-0 rounded border border-white/20 bg-neutral-950 p-2 [color-scheme:dark]"/>
    </label>
    {onSave && <button type="button" disabled={busy || disabled} className="rounded border border-white/25 px-3 py-2 hover:bg-white/10 disabled:opacity-40" onClick={async () => {
      setBusy(true); setFeedback('');
      try { await onSave(draft); setFeedback('Dados salvos.'); }
      catch (err) { setFeedback(err instanceof Error ? err.message : 'Falha ao salvar.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Salvando…' : 'Salvar dados'}</button>}
    {feedback && <p role="status" className="break-words text-amber-100">{feedback}</p>}
    </fieldset>
  </details>;
}

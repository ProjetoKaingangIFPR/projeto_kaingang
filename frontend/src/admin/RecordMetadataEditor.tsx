import { useRef, useState } from 'react';

export type RecordMetadata = { author: string | null; recorded_on: string | null };
export default function RecordMetadataEditor({ value, onChange, onSave, disabled }: {
  value: RecordMetadata; onChange?: (value: RecordMetadata) => void;
  onSave?: (value: RecordMetadata) => Promise<void>; disabled?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [dateText, setDateText] = useState(value.recorded_on?.split('-').reverse().join('/') ?? '');
  const dateInput = useRef<HTMLInputElement>(null);
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
      <input ref={dateInput} type="text" inputMode="numeric" placeholder="DD/MM/AAAA" maxLength={10}
        value={dateText} onChange={e => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 8);
          const text = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
          setDateText(text);
          const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
          const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : '';
          const parsed = new Date(iso + 'T00:00:00Z');
          const valid = Boolean(iso && match?.[3] !== '0000' && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso);
          e.target.setCustomValidity(!text || valid ? '' : 'Informe uma data válida no formato DD/MM/AAAA.');
          change({ ...draft, recorded_on: !text ? null : valid ? iso : text });
        }}
        onInvalid={e => { e.currentTarget.closest('details')?.setAttribute('open', ''); }}
        className="mt-1 block w-full min-w-0 rounded border border-white/20 bg-neutral-950 p-2"/>
      <span className="mt-1 block text-xs text-white/50">Dia/mês/ano, por exemplo 25/11/2026.</span>
    </label>
    {onSave && <button type="button" disabled={busy || disabled} className="rounded border border-white/25 px-3 py-2 hover:bg-white/10 disabled:opacity-40" onClick={async () => {
      if (!dateInput.current?.reportValidity()) return;
      setBusy(true); setFeedback('');
      try { await onSave(draft); setFeedback('Dados salvos.'); }
      catch (err) { setFeedback(err instanceof Error ? err.message : 'Falha ao salvar.'); }
      finally { setBusy(false); }
    }}>{busy ? 'Salvando…' : 'Salvar dados'}</button>}
    {feedback && <p role="status" className="break-words text-amber-100">{feedback}</p>}
    </fieldset>
  </details>;
}

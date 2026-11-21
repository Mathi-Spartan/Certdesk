'use client';

import { useEffect, useRef, useState } from 'react';
import { replyChat } from '@/app/actions/assist';
import { Md } from '@/components/assist/AssistWidget';

const WHO = { user: 'Customer', bot: 'Assistant', agent: 'You (support)', system: '' };

export default function Thread({ id, initial, status: st0 }) {
  const [msgs, setMsgs] = useState(initial);
  const [status, setStatus] = useState(st0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const listRef = useRef(null);
  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;

  async function pull() {
    try {
      const r = await fetch(`/api/assist/admin?c=${id}&after=${lastIdRef.current}`, { cache: 'no-store' });
      const d = await r.json();
      if (d.conversation) setStatus(d.conversation.status);
      if (d.messages?.length) setMsgs((prev) => { const seen = new Set(prev.map((m) => m.id)); return [...prev, ...d.messages.filter((m) => !seen.has(m.id))]; });
    } catch { /* next tick */ }
  }
  const lastIdRef = useRef(lastId);
  lastIdRef.current = lastId;

  useEffect(() => {
    if (status === 'resolved') return;
    const t = setInterval(() => { if (!document.hidden) pull(); }, 5000);
    return () => clearInterval(t);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    setErr(null);
    const r = await replyChat(id, text);
    if (r?.error) setErr(r.error);
    else { setText(''); setStatus('human'); await pull(); }
    setBusy(false);
  }

  return (
    <section className="cx3-card sp-thread">
      <div className="sp-msgs" ref={listRef}>
        {msgs.map((m) => (
          <div key={m.id} className={`sp-m ${m.role}`}>
            {WHO[m.role] ? <span className="sp-m-who">{WHO[m.role]}{m.role === 'bot' && m.intent ? ` · ${m.intent}` : ''}{m.matched === false ? ' · not understood' : ''}{m.helpful === true ? ' · 👍' : m.helpful === false ? ' · 👎' : ''}</span> : null}
            <div className="as-bubble"><Md text={m.body} /></div>
            {m.role === 'bot' && m.data?.buttons?.length ? <div className="sp-m-btns">{m.data.buttons.map((b, i) => <span key={i}>{b.label}</span>)}</div> : null}
          </div>
        ))}
      </div>
      {status === 'resolved' ? <p className="cx3-muted" style={{ padding: '12px 16px', margin: 0 }}>This conversation is resolved.</p> : (
        <form className="as-input sp-reply" onSubmit={send}>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} maxLength={4000} placeholder={status === 'human' ? 'Reply to the customer…' : 'Reply to take over this chat…'} aria-label="Reply"
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e); }} />
          <button type="submit" disabled={busy || !text.trim()} aria-label="Send reply">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </form>
      )}
      {err ? <div className="as-err">{err}</div> : null}
    </section>
  );
}

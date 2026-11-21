'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const QUICK = [
  ['Why isn’t my certificate issued?', 'Why is my certificate not issued?'],
  ['What needs my attention?', 'What needs my attention?'],
  ['When does it expire?', 'When does my certificate expire?'],
  ['Reissue or renew?', 'Do I need to reissue or renew?'],
  ['Download my files', 'Download my certificate files'],
  ['How do I install it?', 'How do I install my certificate?']
];

// ── tiny, safe markdown: **bold**, `code`, "- " lists, "1. " lists, --- rules, paragraphs
function inline(text, key) {
  const parts = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    parts.push(tok.startsWith('**') ? <strong key={`${key}-${i++}`}>{tok.slice(2, -2)}</strong> : <code key={`${key}-${i++}`}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
export function Md({ text }) {
  const blocks = String(text || '').split(/\n{2,}/);
  return blocks.map((b, bi) => {
    const lines = b.split('\n');
    if (b.trim() === '---') return <hr key={bi} />;
    if (lines.every((l) => /^- /.test(l))) return <ul key={bi}>{lines.map((l, i) => <li key={i}>{inline(l.slice(2), `${bi}-${i}`)}</li>)}</ul>;
    if (lines.every((l) => /^\d+\. /.test(l) || /^`/.test(l) || /^\(/.test(l))) {
      const items = [];
      for (const l of lines) {
        if (/^\d+\. /.test(l) || !items.length) items.push([l.replace(/^\d+\. /, '')]);
        else items[items.length - 1].push(l);
      }
      return <ol key={bi}>{items.map((it, i) => <li key={i}>{it.map((l, j) => <span key={j} className="as-line">{inline(l, `${bi}-${i}-${j}`)}</span>)}</li>)}</ol>;
    }
    return <p key={bi}>{lines.map((l, i) => <span key={i} className="as-line">{inline(l, `${bi}-${i}`)}</span>)}</p>;
  });
}

function Copy({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="as-copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }); }}>
      {done ? 'Copied' : label}
    </button>
  );
}

function Blocks({ blocks }) {
  if (!blocks?.length) return null;
  return blocks.map((b, i) => {
    if (b.t === 'record') {
      const st = { ok: ['ok', 'Live in DNS ✓'], malformed: ['bad', 'Has extra spaces or quotes'], missing: ['bad', 'Not found in DNS yet'] }[b.state] || ['', ''];
      return (
        <div key={i} className="as-rec">
          <div className="as-rec-top"><b>{b.domain}</b>{st[1] ? <span className={`as-chip ${st[0]}`}>{st[1]}</span> : null}</div>
          <div className="as-rec-row"><span>Type</span><code>{b.type}</code></div>
          <div className="as-rec-row"><span>Name</span><code>{b.name}</code><Copy text={b.name} /></div>
          <div className="as-rec-row"><span>Value</span><code>{b.value}</code><Copy text={b.value} /></div>
        </div>
      );
    }
    if (b.t === 'file') {
      return (
        <div key={i} className="as-rec">
          <div className="as-rec-top"><b>{b.domain}</b></div>
          <div className="as-rec-row"><span>URL</span><code>{b.url}</code><Copy text={b.url} /></div>
          {b.content ? <div className="as-rec-row"><span>Content</span><code>{b.content}</code><Copy text={b.content} /></div> : null}
        </div>
      );
    }
    return null;
  });
}

export default function AssistWidget({ firstName }) {
  const [open, setOpen] = useState(false);
  const [conv, setConv] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [voted, setVoted] = useState({});
  const listRef = useRef(null);
  const lastId = msgs.length ? msgs[msgs.length - 1].id : 0;

  const merge = useCallback((incoming) => {
    if (!incoming?.length) return;
    setMsgs((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      return [...prev, ...incoming.filter((m) => !seen.has(m.id))];
    });
  }, []);

  // first load: any open conversation and unread replies
  useEffect(() => {
    let live = true;
    fetch('/api/assist', { cache: 'no-store' }).then((r) => r.json()).then((d) => {
      if (!live || d.error) return;
      if (d.conversation) { setConv(d.conversation); setMsgs(d.messages || []); }
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  // live replies: only while the panel is open and a person has the chat
  useEffect(() => {
    if (!open || !conv || !['waiting', 'human'].includes(conv.status)) return;
    const t = setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/assist?c=${conv.id}&after=${lastId}&seen=1`, { cache: 'no-store' }).then((r) => r.json()).then((d) => {
        if (d.conversation) setConv(d.conversation);
        merge(d.messages);
      }).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [open, conv, lastId, merge]);

  useEffect(() => {
    if (open && conv?.unread) fetch(`/api/assist?c=${conv.id}&after=${lastId}&seen=1`, { cache: 'no-store' }).then((r) => r.json()).then((d) => { if (d.conversation) setConv(d.conversation); merge(d.messages); }).catch(() => {});
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, open, busy]);

  async function post(body) {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ c: conv?.id, after: lastId, ...body }) });
      const d = await r.json();
      if (d.error) setErr(d.error);
      if (d.conversation) {
        if (conv && d.conversation.id !== conv.id) setMsgs([]);
        setConv(d.conversation);
      }
      merge(d.messages);
    } catch {
      setErr('Could not reach the server. Check your connection.');
    }
    setBusy(false);
  }

  const send = (t) => { const v = String(t ?? text).trim(); if (!v || busy) return; setText(''); post({ op: 'send', text: v }); };
  const press = (b) => {
    if (busy) return;
    if (b.kind === 'reply') return send(b.text);
    if (b.kind === 'pick') return post({ op: 'pick', orderId: b.orderId, intent: b.intent, label: b.label });
    if (b.kind === 'article') return post({ op: 'article', slug: b.slug, label: b.label });
    if (b.kind === 'action') return post({ op: 'action', action: b.action, orderId: b.orderId, label: b.label });
    if (b.kind === 'handoff') { const note = text.trim(); setText(''); return post({ op: 'handoff', note }); }
  };
  const vote = (id, helpful) => {
    setVoted((v) => ({ ...v, [id]: helpful }));
    fetch('/api/assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'feedback', messageId: id, helpful }) }).catch(() => {});
  };

  const status = conv?.status === 'waiting' ? ['wait', 'Waiting for support'] : conv?.status === 'human' ? ['human', 'Support is here'] : ['bot', 'Instant answers'];
  const last = msgs[msgs.length - 1];

  return (
    <>
      <button type="button" className={`as-fab ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="as-panel" aria-label={open ? 'Close support chat' : 'Open support chat'}>
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" /></svg>
        )}
        {!open && conv?.unread ? <span className="as-badge">{conv.unread}</span> : null}
      </button>

      {open ? (
        <section id="as-panel" className="as-panel" role="dialog" aria-label="Support chat">
          <header className="as-head">
            <span className="as-avatar" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></svg>
            </span>
            <div className="as-title"><strong>CertDesk Assist</strong><small className={`as-st ${status[0]}`}><i />{status[1]}</small></div>
            <button type="button" className="as-hbtn" onClick={() => { setMsgs([]); setConv(null); setErr(null); }} title="New conversation" aria-label="Start a new conversation">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            </button>
            <button type="button" className="as-hbtn" onClick={() => setOpen(false)} aria-label="Close">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </header>

          <div className="as-list" ref={listRef} aria-live="polite">
            {!msgs.length ? (
              <div className="as-msg bot">
                <div className="as-bubble">
                  <Md text={`Hi${firstName ? ` ${firstName}` : ''}! I check your certificates live, explain validation and get you the right files. Ask anything, type a domain name, or tap a question:`} />
                </div>
                <div className="as-btns">{QUICK.map(([l, t]) => <button key={l} type="button" className="as-btn" onClick={() => send(t)}>{l}</button>)}</div>
              </div>
            ) : null}
            {msgs.map((m) => (
              <div key={m.id} className={`as-msg ${m.role}`}>
                {m.role === 'agent' ? <span className="as-who">Support team</span> : null}
                <div className="as-bubble"><Md text={m.body} /><Blocks blocks={m.data?.blocks} /></div>
                {m.data?.buttons?.length && m.id === last?.id ? (
                  <div className="as-btns">
                    {m.data.buttons.map((b, i) => b.kind === 'link'
                      ? <a key={i} className={`as-btn ${b.primary ? 'primary' : ''}`} href={b.href}>{b.label}</a>
                      : <button key={i} type="button" className={`as-btn ${b.primary ? 'primary' : ''} ${b.kind === 'handoff' ? 'handoff' : ''}`} onClick={() => press(b)} disabled={busy}>{b.label}{b.note ? <small>{b.note}</small> : null}</button>)}
                  </div>
                ) : null}
                {m.role === 'bot' && m.intent && !['greet', 'helpme', 'thanks', 'clarify'].includes(m.intent) ? (
                  <div className="as-vote">
                    {voted[m.id] === undefined && m.helpful === null ? (
                      <>Helpful?
                        <button type="button" onClick={() => vote(m.id, true)} aria-label="Yes, helpful">👍</button>
                        <button type="button" onClick={() => vote(m.id, false)} aria-label="Not helpful">👎</button>
                      </>
                    ) : (voted[m.id] ?? m.helpful) ? 'Thanks for the feedback' : (
                      <>Sorry about that. <button type="button" className="as-link" onClick={() => press({ kind: 'handoff' })}>Ask the support team</button></>
                    )}
                  </div>
                ) : null}
              </div>
            ))}
            {busy ? <div className="as-msg bot"><div className="as-bubble as-typing"><i /><i /><i /></div></div> : null}
          </div>

          {err ? <div className="as-err" role="alert">{err}</div> : null}
          <form className="as-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={1}
              maxLength={1000}
              placeholder={conv?.status === 'waiting' || conv?.status === 'human' ? 'Message the support team…' : 'Ask about an order, or type a domain…'}
              aria-label="Your message"
            />
            <button type="submit" disabled={busy || !text.trim()} aria-label="Send">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
        </section>
      ) : null}
    </>
  );
}

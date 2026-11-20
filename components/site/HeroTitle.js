'use client';

import { useEffect, useRef, useState } from 'react';

const WORDS = ['issued', 'validated', 'reissued', 'renewed', 'automated'];

/** Hero headline with a rotating verb and a soft spotlight that follows the cursor. */
export default function HeroTitle() {
  const [i, setI] = useState(0);
  const [prev, setPrev] = useState(-1);
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((x) => { setPrev(x); return (x + 1) % WORDS.length; }), 2600);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const hero = ref.current?.closest('.hx');
    if (!hero) return;
    const move = (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
      hero.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    hero.addEventListener('pointermove', move);
    return () => hero.removeEventListener('pointermove', move);
  }, []);

  return (
    <h1 className="hx-title" ref={ref}>
      SSL certificates,{' '}
      <span className="hx-rot" aria-hidden="true">
        {WORDS.map((w, n) => <span key={w} className={n === i ? 'on' : n === prev ? 'out' : ''}>{w}</span>)}
      </span>
      <span className="sr">issued, validated, renewed and automated</span>{' '}
      and managed <span className="hx-grad">from one clean console.</span>
    </h1>
  );
}

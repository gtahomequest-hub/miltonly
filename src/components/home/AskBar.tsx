// src/components/home/AskBar.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSpark } from './icons';

interface Props {
  examples: string[];
}

export function AskBar({ examples }: Props) {
  const router = useRouter();
  // 2026-07-20: the retired hero subline's intent ("Ask anything about the
  // Milton market") now lives here as the resting placeholder.
  const [placeholder, setPlaceholder] = useState('Ask anything about the Milton market…');
  const [value, setValue] = useState('');
  const stopped = useRef(false);

  // Route the question by intent to the page that answers it:
  // valuation -> /sell, lease -> /rentals, everything else -> listings search.
  const ask = () => {
    const q = value.trim();
    if (!q) return;
    const s = q.toLowerCase();
    if (/\b(worth|value|valuation|sell|selling|apprais)/.test(s)) router.push('/sell');
    else if (/\b(rent|rental|lease|leasing|tenant)/.test(s)) router.push('/rentals');
    else router.push(`/listings?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    if (!examples || examples.length === 0) return;

    // reset cleanly on every mount (dev double-invoke safe)
    let idx = 0;
    let char = 0;
    let deleting = false;
    stopped.current = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (stopped.current) return;
      const full = examples[idx % examples.length];
      if (!deleting) {
        char += 1;
        setPlaceholder(full.slice(0, char));
        if (char >= full.length) {
          deleting = true;
          timer = setTimeout(tick, 1700);
          return;
        }
        timer = setTimeout(tick, 52);
      } else {
        char -= 1;
        setPlaceholder(full.slice(0, char));
        if (char <= 0) {
          deleting = false;
          idx += 1;
          timer = setTimeout(tick, 350);
          return;
        }
        timer = setTimeout(tick, 26);
      }
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, [examples]);

  const stop = () => {
    stopped.current = true;
    setPlaceholder('Ask anything about the Milton market…');
  };

  return (
    <form
      className="m-askbar"
      id="m-hero-askbar"
      onSubmit={(e) => {
        e.preventDefault();
        ask();
      }}
    >
      <span className="m-lead">
        <IconSpark />
      </span>
      <input
        value={value}
        placeholder={placeholder}
        onFocus={stop}
        onChange={(e) => {
          stopped.current = true;
          setValue(e.target.value);
        }}
        aria-label="Ask anything about Milton"
      />
      <button type="submit" className="m-go" aria-label="Ask">
        →
      </button>
    </form>
  );
}

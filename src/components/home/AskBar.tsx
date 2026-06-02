// src/components/home/AskBar.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { IconSpark } from './icons';

interface Props {
  examples: string[];
}

export function AskBar({ examples }: Props) {
  // animated placeholder text (shown as placeholder, not value, so it never blocks typing)
  const [placeholder, setPlaceholder] = useState('');
  // once the user interacts, stop the animation for good
  const [value, setValue] = useState('');
  const stopped = useRef(false);

  const idx = useRef(0);
  const char = useRef(0);
  const deleting = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (examples.length === 0) return;

    const tick = () => {
      if (stopped.current) return;
      const full = examples[idx.current % examples.length];
      if (!deleting.current) {
        char.current += 1;
        setPlaceholder(full.slice(0, char.current));
        if (char.current >= full.length) {
          deleting.current = true;
          timer.current = setTimeout(tick, 1700);
          return;
        }
        timer.current = setTimeout(tick, 52);
      } else {
        char.current -= 1;
        setPlaceholder(full.slice(0, char.current));
        if (char.current <= 0) {
          deleting.current = false;
          idx.current += 1;
          timer.current = setTimeout(tick, 350);
          return;
        }
        timer.current = setTimeout(tick, 26);
      }
    };

    timer.current = setTimeout(tick, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [examples]);

  const stop = () => {
    stopped.current = true;
    if (timer.current) clearTimeout(timer.current);
    setPlaceholder('Ask anything about Milton…');
  };

  return (
    <div className="m-askbar" id="m-hero-askbar">
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
      <button className="m-go" aria-label="Ask">
        →
      </button>
    </div>
  );
}

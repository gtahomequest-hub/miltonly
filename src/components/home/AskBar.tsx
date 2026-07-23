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
  // V1 street-first: the resting placeholder invites a street/condo/neighbourhood.
  // (Search routing itself is unchanged — free text still resolves via /listings?q=;
  // true street-first routing is out of V1 scope.)
  const RESTING_PLACEHOLDER = 'Type any Milton street, condo, or neighbourhood';
  const [placeholder, setPlaceholder] = useState(RESTING_PLACEHOLDER);
  const [value, setValue] = useState('');
  const stopped = useRef(false);
  const submitting = useRef(false);

  // Resolve typed text to a real destination, entity-FIRST (street -> condo ->
  // neighbourhood), then intent (worth/value -> /sell, rent -> /rentals), then
  // /listings?q=. The match runs server-side via /api/hero-search so it can hit
  // the entity tables; on any failure we fall back to listings search.
  const ask = async () => {
    const q = value.trim();
    if (!q) {
      router.push('/listings');
      return;
    }
    if (submitting.current) return;
    submitting.current = true;
    try {
      const res = await fetch(`/api/hero-search?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { href?: string };
      router.push(data.href || `/listings?q=${encodeURIComponent(q)}`);
    } catch {
      router.push(`/listings?q=${encodeURIComponent(q)}`);
    } finally {
      submitting.current = false;
    }
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
    setPlaceholder(RESTING_PLACEHOLDER);
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
        aria-label="Search a Milton street, condo, or neighbourhood"
      />
      <button type="submit" className="m-go" aria-label="Ask">
        →
      </button>
    </form>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, WifiOff } from 'lucide-react';
import { api } from '../services/api';

/*
 * The waiting room screen.
 *
 * A television on the wall, read from the far bench by somebody holding a
 * paper ticket. It answers one question: has my number moved? So it shows
 * numbers, large, under the three places a number can be, and nothing that
 * would let a stranger learn who is in the building. No sign-in, no names,
 * no reasons for the visit.
 *
 * The Tok Pisin under each heading is the same wording the queue screen
 * already uses, so a patient hears the nurse say the word they can read here.
 */

const PLACES = [
  { key: 'nurse', label: 'With the nurse', sub: null },
  { key: 'doctor', label: 'With the doctor', sub: 'Wantaim dokta' },
  { key: 'pharmacy', label: 'At the pharmacy', sub: 'Kisim marasin' }
];

const POLL_MS = 8000;
const STALE_MS = 45000;

function clock(d) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function Ticket({ entry, size = 'lg' }) {
  const emergency = entry.priority === 'Emergency';
  const number = entry.number == null ? '—' : entry.number;
  return (
    <li
      key={`${entry.number}-${entry.priority}`}
      className={`tick-in flex flex-col items-center justify-center rounded-2xl border tabular-nums ${
        emergency ? 'border-critical bg-critical-wash text-critical' : 'border-line-strong bg-surface text-ink'
      } ${size === 'lg' ? 'min-h-[9rem] min-w-[9rem] px-7 py-4' : 'min-h-[5rem] min-w-[5rem] px-5 py-2'}`}
      aria-label={emergency ? `Number ${number}, emergency` : `Number ${number}`}
    >
      <span className={`font-bold leading-none tracking-tight ${size === 'lg' ? 'text-[clamp(5rem,7.5vw,8rem)]' : 'text-[clamp(2.75rem,3.5vw,4rem)]'}`}>{number}</span>
      {emergency ? <span className="mt-1 text-sm font-semibold uppercase tracking-wide">Emergency</span> : null}
    </li>
  );
}

export default function WaitingRoom() {
  const [board, setBoard] = useState(null);
  const [lastGood, setLastGood] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const [fullscreen, setFullscreen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    document.title = 'Waiting room';
    const load = async () => {
      try {
        const res = await api.getWaitingRoomBoard();
        if (res && res.success) { setBoard(res); setLastGood(Date.now()); }
      } catch (err) {
        // Shown as a lost connection below once it has lasted a while.
      }
    };
    load();
    timer.current = setInterval(load, POLL_MS);
    const tick = setInterval(() => setNow(new Date()), 15000);
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      clearInterval(timer.current);
      clearInterval(tick);
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, []);

  const disconnected = lastGood > 0 ? now.getTime() - lastGood > STALE_MS : false;
  const waiting = board?.waiting || [];
  const busy = useMemo(() => PLACES.some((p) => (board?.[p.key] || []).length > 0), [board]);

  const goFullscreen = () => {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  };

  return (
    <div className="light-theme flex min-h-screen flex-col bg-canvas text-ink">
      <header className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 md:px-10">
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold md:text-2xl">{board?.facility || 'Lloyds Medical OS'}</p>
          <p className="text-sm text-ink-3 md:text-base">Waiting room · your number is on your ticket</p>
        </div>
        <div className="flex items-center gap-4">
          <p className="text-3xl font-semibold tabular-nums md:text-4xl" aria-label="The time now">{clock(now)}</p>
          {!fullscreen ? (
            <button type="button" className="btn btn-sm" onClick={goFullscreen}>
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              Full screen
            </button>
          ) : null}
        </div>
      </header>

      {disconnected ? (
        <p role="status" className="flex items-center justify-center gap-2 bg-warn-wash px-6 py-2 text-base font-medium text-warn">
          <WifiOff className="h-5 w-5" aria-hidden="true" />
          This screen has lost the clinic server. The numbers shown may be old.
        </p>
      ) : null}

      <main className="flex flex-1 flex-col gap-6 px-6 py-6 md:px-10 md:py-8">
        {!board ? (
          <p className="text-lg text-ink-3">Connecting to the clinic.</p>
        ) : (
          <>
            <section className="grid flex-1 gap-6 md:grid-cols-3" aria-label="Where each number is now">
              {PLACES.map((place) => {
                const entries = board[place.key] || [];
                return (
                  <div key={place.key} className="flex flex-col rounded-2xl border border-line bg-surface/60 p-5 md:p-6">
                    <h2 className="text-2xl font-semibold md:text-3xl">{place.label}</h2>
                    {place.sub ? <p className="mt-0.5 text-lg text-ink-3 md:text-xl">{place.sub}</p> : null}
                    {entries.length === 0 ? (
                      <p className="mt-8 text-xl text-ink-3">Nobody here right now</p>
                    ) : (
                      <ul className="mt-5 flex flex-wrap gap-4">
                        {entries.map((entry) => <Ticket key={`${entry.number}-${entry.priority}`} entry={entry} />)}
                      </ul>
                    )}
                  </div>
                );
              })}
            </section>

            <section className="rounded-2xl border border-line bg-surface/60 p-5 md:p-6" aria-label="Waiting">
              <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h2 className="text-2xl font-semibold md:text-3xl">
                  Waiting <span className="font-normal text-ink-3">· Wetim</span>
                </h2>
                <p className="text-xl text-ink-2 md:text-2xl">
                  {waiting.length === 0
                    ? (busy ? 'Nobody else is waiting' : 'Nobody is waiting. Come to the desk.')
                    : `${waiting.length} ${waiting.length === 1 ? 'person' : 'people'} waiting, in this order`}
                </p>
              </div>
              {waiting.length > 0 ? (
                <ul className="mt-4 flex flex-wrap gap-3">
                  {waiting.slice(0, 24).map((entry) => <Ticket key={`${entry.number}-${entry.priority}`} entry={entry} size="sm" />)}
                  {waiting.length > 24 ? (
                    <li className="flex items-center px-3 text-xl text-ink-3">and {waiting.length - 24} more</li>
                  ) : null}
                </ul>
              ) : null}
            </section>
          </>
        )}
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-6 py-3 text-sm text-ink-3 md:px-10">
        <p>
          A red number is an emergency and goes first. Please wait for your number; the nurse will call it.
        </p>
        <p className="tabular-nums">
          {board ? `${board.completed_today} seen today` : ''}
        </p>
      </footer>
    </div>
  );
}

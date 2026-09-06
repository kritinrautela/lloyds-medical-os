import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/*
 * Automatic sign-out.
 *
 * A clinic computer is left mid-task all day: the nurse is called to a bed,
 * the clerk goes to find a file. A screen that stays open in their name is a
 * screen anyone can record under their name. After a quarter of an hour with
 * no keyboard, mouse or touch, the session ends here and on the server, and
 * the next person signs in as themselves.
 *
 * A minute before that a countdown appears, so somebody halfway through a
 * long registration can touch the screen and carry on.
 */
const IDLE_MINUTES = 15;
const WARN_SECONDS = 60;

export default function IdleGuard() {
  const { isSignedIn, signOutIdle } = useAuth();
  const [remaining, setRemaining] = useState(null);
  const lastActivity = useRef(Date.now());
  const warned = useRef(false);

  const touch = useCallback(() => {
    lastActivity.current = Date.now();
    if (warned.current) {
      warned.current = false;
      setRemaining(null);
    }
  }, []);

  useEffect(() => {
    if (!isSignedIn) return undefined;
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    lastActivity.current = Date.now();

    const tick = window.setInterval(() => {
      const idleMs = Date.now() - lastActivity.current;
      const leftMs = IDLE_MINUTES * 60000 - idleMs;
      if (leftMs <= 0) {
        warned.current = false;
        setRemaining(null);
        signOutIdle(`Signed out after ${IDLE_MINUTES} minutes without activity, so nothing could be recorded in your name while you were away.`);
        return;
      }
      if (leftMs <= WARN_SECONDS * 1000) {
        warned.current = true;
        setRemaining(Math.ceil(leftMs / 1000));
      }
    }, 1000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(tick);
    };
  }, [isSignedIn, touch, signOutIdle]);

  if (!isSignedIn || remaining === null) return null;

  return (
    <div className="scrim" role="alertdialog" aria-modal="true" aria-label="Still there?">
      <div className="panel w-full max-w-sm p-5 text-center shadow-overlay">
        <Clock3 className="mx-auto h-6 w-6 text-warn" aria-hidden="true" />
        <h2 className="mt-3 text-sm font-semibold text-ink">Still there?</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-2">
          Nothing has been touched for a while. You will be signed out in
          <span className="font-mono font-semibold text-ink"> {remaining}s </span>
          so nobody can record under your name while you are away.
        </p>
        <button type="button" className="btn btn-primary mt-4 w-full justify-center" onClick={touch} autoFocus>
          I am still here
        </button>
      </div>
    </div>
  );
}

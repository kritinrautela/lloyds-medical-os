import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setToken, getToken, setSessionLostHandler } from '../services/api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'lloyds_staff_user';

/*
 * Who is signed in, and what they are allowed to do.
 *
 * Everything this system records — a diagnosis, a medicine handed over, a price
 * reduced, a stock write-off — is recorded against the name held here. That
 * makes this the foundation the whole audit trail rests on, so it holds to
 * four rules:
 *
 *  - Nobody is signed in until they sign in. There is no default user.
 *  - A password is checked by the server, every time. There is no local
 *    shortcut, no built-in password and no way to become another member of
 *    staff without their password.
 *  - The session is a token the server issued and stores. What is kept in this
 *    browser is a copy for convenience; the server decides whether it is still
 *    a session, and says so on every single request.
 *  - The list of permissions below comes from the server and is used only to
 *    decide what to draw. It is not the enforcement. Hiding a button prevents
 *    an honest mistake; the server refusing the request is what stops the rest.
 *
 * An earlier version of this file kept a list of staff members in the browser,
 * signed everyone in as a doctor automatically, allowed switching to any
 * account including an administrator with one click, and accepted a password
 * written into the source when the server said no. Any one of those makes the
 * audit trail meaningless, because an entry recorded against a name would no
 * longer be evidence that that person did it.
 */

function readStored() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function writeStored(payload) {
  try {
    if (payload) localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* A browser with storage blocked still works; the session just ends on reload. */
  }
}

export function AuthProvider({ children }) {
  const stored = readStored();
  const [currentUser, setCurrentUser] = useState(stored?.user || null);
  const [capabilities, setCapabilities] = useState(stored?.capabilities || []);
  const [sections, setSections] = useState(stored?.sections || []);
  const [landing, setLanding] = useState(stored?.landing || null);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [notice, setNotice] = useState(null);

  const applySession = useCallback((res) => {
    setCurrentUser(res.user);
    setCapabilities(res.capabilities || []);
    setSections(res.sections || []);
    setLanding(res.landing || null);
    setMustChangePassword(!!res.must_change_password);
    writeStored({
      user: res.user,
      capabilities: res.capabilities || [],
      sections: res.sections || [],
      landing: res.landing || null
    });
  }, []);

  const clearSession = useCallback(() => {
    setCurrentUser(null);
    setCapabilities([]);
    setSections([]);
    setLanding(null);
    setMustChangePassword(false);
    setToken(null);
    writeStored(null);
  }, []);

  // Any request that comes back unauthorised ends the session everywhere at
  // once, rather than leaving half the screen showing data nobody may see.
  useEffect(() => {
    setSessionLostHandler((message) => {
      clearSession();
      setNotice(message || 'Your session has ended. Sign in again to carry on.');
    });
    return () => setSessionLostHandler(null);
  }, [clearSession]);

  /*
   * On startup the token in this browser is offered to the server, which
   * answers with the person it belongs to or with nothing. A session that has
   * expired, or an account an administrator has since disabled, does not
   * survive a page reload.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.getBootstrapStatus().catch(() => null);
        if (!cancelled && status?.needs_setup) {
          setNeedsSetup(true);
          clearSession();
          return;
        }

        if (!getToken()) { clearSession(); return; }

        const res = await api.getSession();
        if (!cancelled && res?.user) applySession(res);
      } catch (err) {
        // A 401 has already cleared the session through the handler above.
        // Any other failure means the server is unreachable, and a clinic
        // should not be locked out of its own records by a network fault:
        // the stored copy stands until the next successful request.
        if (err?.status === 401 && !cancelled) clearSession();
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => { cancelled = true; };
  }, [applySession, clearSession]);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setNotice(null);
    try {
      const res = await api.login({ username, password });
      if (!res?.user || !res?.token) throw new Error(res?.message || 'Sign-in failed.');
      setToken(res.token);
      applySession(res);
      setIsAuthModalOpen(false);
      return { success: true, user: res.user };
    } catch (err) {
      // A failed sign-in fails. There is deliberately no fallback path here.
      return { success: false, message: err.message || 'Sign-in failed.' };
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const register = useCallback(async (userData) => {
    setLoading(true);
    try {
      const res = await api.register(userData);
      if (!res?.user) throw new Error(res?.message || 'The account could not be created.');
      return { success: true, user: res.user };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * Creating the very first account on a new installation. There is no
   * administrator yet to authorise it, which is precisely why the server only
   * allows it while the staff list is empty.
   */
  const completeSetup = useCallback(async (userData) => {
    setLoading(true);
    try {
      const res = await api.register(userData);
      if (!res?.user) throw new Error(res?.message || 'The account could not be created.');
      const signIn = await api.login({ username: userData.username, password: userData.password });
      if (signIn?.token) {
        setToken(signIn.token);
        applySession(signIn);
      }
      setNeedsSetup(false);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  const changeOwnPassword = useCallback(async (currentPassword, newPassword) => {
    setLoading(true);
    try {
      await api.changeOwnPassword(currentPassword, newPassword);
      setMustChangePassword(false);
      return { success: true };
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    // Tell the server first so the session is destroyed rather than merely
    // forgotten by this browser, then clear locally whatever the answer.
    await api.logout().catch(() => {});
    clearSession();
  }, [clearSession]);

  // The idle guard's sign-out: the same as a sign-out, with a note on the
  // sign-in screen saying why it happened.
  const signOutIdle = useCallback(async (message) => {
    await api.logout().catch(() => {});
    clearSession();
    setNotice(message);
  }, [clearSession]);

  // What the interface is allowed to draw. Never what the server is allowed to do.
  const can = useCallback(
    (capability) => capabilities.includes(capability),
    [capabilities]
  );

  const value = useMemo(() => ({
    currentUser,
    isSignedIn: !!currentUser,
    capabilities,
    sections,
    landing,
    can,
    mustChangePassword,
    needsSetup,
    notice,
    dismissNotice: () => setNotice(null),
    checking,
    isAuthModalOpen,
    setIsAuthModalOpen,
    loading,
    login,
    register,
    completeSetup,
    changeOwnPassword,
    logout,
    signOutIdle
  }), [
    currentUser, capabilities, sections, landing, can, mustChangePassword, needsSetup,
    notice, checking, isAuthModalOpen, loading, login, register, completeSetup,
    changeOwnPassword, logout, signOutIdle
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

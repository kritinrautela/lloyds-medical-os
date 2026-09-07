const BASE_URL = '/api';
const TOKEN_KEY = 'lloyds_session_token';

/*
 * The session token.
 *
 * Every request carries it, and the server reads the signed-in person's role
 * from the session rather than from anything this file sends. That is what
 * makes the role checks real: a member of staff editing what the browser sends
 * cannot give themselves a permission they were not granted.
 */
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // A browser with storage blocked still works for the length of one visit.
  }
}

// Something has to happen when the server says the session is over, and it has
// to happen everywhere at once rather than in each page. AuthContext registers
// a handler here and is told the moment any request comes back unauthorised.
let onSessionLost = null;
export function setSessionLostHandler(fn) {
  onSessionLost = fn;
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401) {
      setToken(null);
      if (onSessionLost) onSessionLost(data.message || 'Your session has ended.');
    }
    const err = new Error(data.message || data.error || 'Server request failed');
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

export const api = {
  // Authentication & Staff Accounts
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  getSession: () => request('/auth/session'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  getBootstrapStatus: () => request('/auth/bootstrap-status'),
  changeOwnPassword: (current_password, new_password) =>
    request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password })
    }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getStaffUsers: () => request('/auth/users'),
  updateStaffUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Account management is administrator work, and the server checks that for
  // itself. The acting administrator's id travels with each of these calls so
  // it can, and so the audit trail carries a name.
  deleteStaffUser: (id, actor_user_id) =>
    request(`/auth/users/${id}`, { method: 'DELETE', body: JSON.stringify({ actor_user_id }) }),
  resetStaffPassword: (id, password, actor_user_id) =>
    request(`/auth/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password, actor_user_id }) }),
  toggleStaffStatus: (id, actor_user_id) =>
    request(`/auth/users/${id}/toggle-status`, { method: 'POST', body: JSON.stringify({ actor_user_id }) }),

  // Dashboard & Bed Management
  getDashboardStats: () => request('/dashboard/stats'),
  updateBedStatus: (id, data) => request(`/dashboard/beds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addShiftNote: (data) => request('/dashboard/shift-notes', { method: 'POST', body: JSON.stringify(data) }),
  addActivity: (data) => request('/dashboard/activities', { method: 'POST', body: JSON.stringify(data) }),
  sendHeartbeat: (data) => request('/dashboard/heartbeat', { method: 'POST', body: JSON.stringify(data) }),

  // Patients
  getPatients: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/patients${query ? `?${query}` : ''}`);
  },
  searchPatients: (searchTerm) => {
    return request(`/patients?q=${encodeURIComponent(searchTerm)}`);
  },
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePatient: (id) => request(`/patients/${id}`, { method: 'DELETE' }),

  // The photograph is sent as a data URL. The camera panel shrinks and
  // compresses it in the browser first, so a clinic laptop is not pushing a
  // multi-megabyte frame across the Wi-Fi for every registration.
  savePatientPhoto: (id, image, taken_by) =>
    request(`/patients/${id}/photo`, { method: 'POST', body: JSON.stringify({ image, taken_by }) }),
  getPatientPhotoUrl: (id, cacheKey = '') =>
    `${BASE_URL}/patients/${id}/photo${cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : ''}`,
  lookupHospitalNumber: (number) => request(`/patients/lookup/${encodeURIComponent(number)}`),

  // Visits & OPD Queue
  getTodayVisits: () => request('/visits/today'),
  getVisits: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/visits${query ? `?${query}` : ''}`);
  },
  checkInPatient: (data) => request('/visits', { method: 'POST', body: JSON.stringify(data) }),
  updateVisitStatus: (id, status, moved_by = '') =>
    request(`/visits/${id}/status`, { method: 'PUT', body: JSON.stringify({ status, moved_by }) }),
  updateVisitVitals: (id, data) => request(`/visits/${id}/vitals`, { method: 'PUT', body: JSON.stringify(data) }),
  getFollowUps: (days = 7) => request(`/visits/follow-ups?days=${days}`),

  // Registers: referrals, reportable diseases, the monthly return
  findSimilarPatients: (params) => request(`/patients/similar?${new URLSearchParams(params).toString()}`),
  getReferrals: (params = {}) => request(`/referrals?${new URLSearchParams(params).toString()}`),
  getReferral: (id) => request(`/referrals/${id}`),
  createReferral: (data) => request('/referrals', { method: 'POST', body: JSON.stringify(data) }),
  updateReferralOutcome: (id, outcome, outcome_note = '') =>
    request(`/referrals/${id}/outcome`, { method: 'PUT', body: JSON.stringify({ outcome, outcome_note }) }),
  getMonthlyReport: (month) => request(`/reports/monthly?month=${encodeURIComponent(month)}`),
  getNotifiableCases: (from, to) => request(`/reports/notifiable?from=${from || ''}&to=${to || ''}`),

  // Drugs & Pharmacy Inventory
  getDrugs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/drugs${query ? `?${query}` : ''}`);
  },
  getDrugCategories: () => request('/drugs/categories'),
  createDrug: (data) => request('/drugs', { method: 'POST', body: JSON.stringify(data) }),
  updateDrug: (id, data) => request(`/drugs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adjustDrugStock: (id, data) => request(`/drugs/${id}/stock`, { method: 'POST', body: JSON.stringify(data) }),
  deleteDrug: (id, removed_by = '') =>
    request(`/drugs/${id}`, { method: 'DELETE', body: JSON.stringify({ removed_by }) }),

  // Dispensing POS
  getDispensations: () => request('/dispense'),
  getDispensation: (id) => request(`/dispense/${id}`),
  dispenseMedications: (data) => request('/dispense', { method: 'POST', body: JSON.stringify(data) }),

  // End of Day Shift Closing
  getEndOfDayToday: () => request('/end-of-day/today'),
  closeEndOfDay: (data) => request('/end-of-day/close', { method: 'POST', body: JSON.stringify(data) }),
  getEndOfDayHistory: () => request('/end-of-day/history'),

  // Cloud & Google Sheets Sync
  getCloudSyncStatus: () => request('/cloud-sync/status'),
  updateCloudSyncConfig: (data) => request('/cloud-sync/config', { method: 'PUT', body: JSON.stringify(data) }),
  googleAuthSignIn: (data) => request('/cloud-sync/google-auth', { method: 'POST', body: JSON.stringify(data) }),
  generateSyncKey: () => request('/cloud-sync/sync-key', { method: 'POST' }),
  saveGoogleCredentials: (client_id, client_secret) =>
    request('/google/credentials', { method: 'PUT', body: JSON.stringify({ client_id, client_secret }) }),
  startGoogleConnect: () => request('/google/start'),
  disconnectGoogle: () => request('/google/disconnect', { method: 'POST' }),
  triggerCloudSync: (isManual = true) => request('/cloud-sync/sync-now', { method: 'POST', body: JSON.stringify({ is_manual: isManual }) }),
  testCloudSync: (webhook_url) => request('/cloud-sync/test', { method: 'POST', body: JSON.stringify({ webhook_url }) }),
  getAppsScript: () => request('/cloud-sync/apps-script'),

  // Settings
  getSettings: () => request('/settings'),
  getSystemInfo: () => request('/settings/system'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  resetRecords: (password, performed_by) =>
    request('/settings/reset-records', {
      method: 'POST',
      body: JSON.stringify({ password, performed_by })
    }),

  // Export URLs
  // The export password is never stored in the client; the operator types it
  // at download time and the server checks it against the facility setting.
  getExcelExportUrl: (password = '', by = '') =>
    `${BASE_URL}/export/excel?password=${encodeURIComponent(password)}&by=${encodeURIComponent(by)}` +
    `&token=${encodeURIComponent(getToken() || '')}`,
  // The backup is encrypted with the facility export password; the server
  // refuses without it, and records the refusal.
  getDbBackupUrl: (password = '') =>
    `${BASE_URL}/export/backup-db?password=${encodeURIComponent(password)}&token=${encodeURIComponent(getToken() || '')}`,
  getGoogleDriveBundleUrl: () => `${BASE_URL}/cloud-sync/export-drive-bundle`,
  
  // Restore DB File
  restoreDb: async (file, password = '') => {
    const formData = new FormData();
    formData.append('db_file', file);
    formData.append('password', password);
    const res = await fetch(`${BASE_URL}/export/restore-db`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken() || ''}` },
      body: formData
    });
    return res.json();
  }
};

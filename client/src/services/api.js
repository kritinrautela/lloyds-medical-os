const BASE_URL = '/api';

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || data.error || 'Server request failed');
    }
    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  // Authentication & Staff Accounts
  login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
  register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
  getStaffUsers: () => request('/auth/users'),
  updateStaffUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaffUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),
  resetStaffPassword: (id, password) => request(`/auth/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
  toggleStaffStatus: (id) => request(`/auth/users/${id}/toggle-status`, { method: 'POST' }),

  // Dashboard & Bed Management
  getDashboardStats: () => request('/dashboard/stats'),
  updateBedStatus: (id, data) => request(`/dashboard/beds/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  addShiftNote: (data) => request('/dashboard/shift-notes', { method: 'POST', body: JSON.stringify(data) }),
  addActivity: (data) => request('/dashboard/activities', { method: 'POST', body: JSON.stringify(data) }),

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

  // Visits & OPD Queue
  getTodayVisits: () => request('/visits/today'),
  getVisits: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/visits${query ? `?${query}` : ''}`);
  },
  checkInPatient: (data) => request('/visits', { method: 'POST', body: JSON.stringify(data) }),
  updateVisitStatus: (id, status) => request(`/visits/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  updateVisitVitals: (id, data) => request(`/visits/${id}/vitals`, { method: 'PUT', body: JSON.stringify(data) }),

  // Drugs & Pharmacy Inventory
  getDrugs: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/drugs${query ? `?${query}` : ''}`);
  },
  getDrugCategories: () => request('/drugs/categories'),
  createDrug: (data) => request('/drugs', { method: 'POST', body: JSON.stringify(data) }),
  updateDrug: (id, data) => request(`/drugs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  adjustDrugStock: (id, data) => request(`/drugs/${id}/stock`, { method: 'POST', body: JSON.stringify(data) }),
  deleteDrug: (id) => request(`/drugs/${id}`, { method: 'DELETE' }),

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
  triggerCloudSync: (isManual = true) => request('/cloud-sync/sync-now', { method: 'POST', body: JSON.stringify({ is_manual: isManual }) }),

  // Settings
  getSettings: () => request('/settings'),
  updateSettings: (data) => request('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  resetRecords: () => request('/settings/reset-records', { method: 'POST' }),

  // Export URLs
  getExcelExportUrl: (password = '') => `${BASE_URL}/export/excel?password=${encodeURIComponent(password)}`,
  getDbBackupUrl: () => `${BASE_URL}/export/backup-db`,
  getGoogleDriveBundleUrl: () => `${BASE_URL}/cloud-sync/export-drive-bundle`,
  
  // Restore DB File
  restoreDb: async (file) => {
    const formData = new FormData();
    formData.append('db_file', file);
    const res = await fetch(`${BASE_URL}/export/restore-db`, {
      method: 'POST',
      body: formData
    });
    return res.json();
  }
};

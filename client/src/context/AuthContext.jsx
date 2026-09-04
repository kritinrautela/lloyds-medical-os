import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const defaultDemoStaff = [
  {
    id: 2,
    username: 'doctor',
    full_name: 'Chief Medical Officer',
    role: 'Chief Medical Officer',
    staff_id: 'LMEL-DOC-002',
    department: 'Emergency & Tropical Medicine',
    avatar: '👨‍⚕️',
    color: 'emerald'
  },
  {
    id: 3,
    username: 'nurse',
    full_name: 'Senior Triage Nurse',
    role: 'Senior Triage Nurse',
    staff_id: 'LMEL-NUR-003',
    department: 'Outpatient & Acute Triage',
    avatar: '👩‍⚕️',
    color: 'amber'
  },
  {
    id: 4,
    username: 'pharmacist',
    full_name: 'Registered Chief Pharmacist',
    role: 'Registered Pharmacist',
    staff_id: 'LMEL-PHM-004',
    department: 'Pharmacy & Medical Depot',
    avatar: '💊',
    color: 'cyan'
  },
  {
    id: 5,
    username: 'labtech',
    full_name: 'Pathology & RDT Specialist',
    role: 'Pathology Technician',
    staff_id: 'LMEL-LAB-005',
    department: 'Diagnostic Laboratory',
    avatar: '🧪',
    color: 'purple'
  },
  {
    id: 6,
    username: 'safety',
    full_name: 'HSE Mine Health Officer',
    role: 'HSE Safety Officer',
    staff_id: 'LMEL-HSE-006',
    department: 'Mine Occupational Safety',
    avatar: '⛑️',
    color: 'rose'
  },
  {
    id: 1,
    username: 'admin',
    full_name: 'Hospital Operations Director',
    role: 'Administrator',
    staff_id: 'LMEL-ADM-001',
    department: 'Clinical Governance & Administration',
    avatar: '🛡️',
    color: 'blue'
  }
];

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('lloyds_staff_user');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not parse saved user:', e);
    }
    // Default fallback to Chief Medical Officer so offline clinic starts smoothly
    return defaultDemoStaff[0];
  });

  const [staffUsers, setStaffUsers] = useState(defaultDemoStaff);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load all registered staff accounts from server on startup
  const refreshStaffList = async () => {
    try {
      const res = await api.getStaffUsers();
      if (res?.users && res.users.length > 0) {
        setStaffUsers(res.users);
      }
    } catch (e) {
      // Offline fallback: keep default demo staff
    }
  };

  useEffect(() => {
    refreshStaffList();
  }, []);

  const login = async (username, password) => {
    setLoading(true);
    try {
      const res = await api.login({ username, password });
      if (res?.user) {
        setCurrentUser(res.user);
        localStorage.setItem('lloyds_staff_user', JSON.stringify(res.user));
        setIsAuthModalOpen(false);
        return { success: true, user: res.user };
      }
      throw new Error(res?.message || 'Login failed');
    } catch (err) {
      // Offline instant demo bypass if password is lloyds2026
      if (password === 'lloyds2026') {
        const found = staffUsers.find(u => u.username.toLowerCase() === username.toLowerCase());
        if (found) {
          setCurrentUser(found);
          localStorage.setItem('lloyds_staff_user', JSON.stringify(found));
          setIsAuthModalOpen(false);
          return { success: true, user: found };
        }
      }
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  const switchAccount = (user) => {
    setCurrentUser(user);
    localStorage.setItem('lloyds_staff_user', JSON.stringify(user));
    setIsAuthModalOpen(false);
  };

  const register = async (userData) => {
    setLoading(true);
    try {
      const res = await api.register(userData);
      if (res?.user) {
        await refreshStaffList();
        setCurrentUser(res.user);
        localStorage.setItem('lloyds_staff_user', JSON.stringify(res.user));
        setIsAuthModalOpen(false);
        return { success: true, user: res.user };
      }
      throw new Error(res?.message || 'Registration failed');
    } catch (err) {
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    // Open auth modal to choose next shift worker or log in
    setIsAuthModalOpen(true);
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      staffUsers,
      isAuthModalOpen,
      setIsAuthModalOpen,
      loading,
      login,
      register,
      switchAccount,
      logout,
      refreshStaffList
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

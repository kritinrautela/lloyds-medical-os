import React, { useState } from 'react';
import { useAuth, defaultDemoStaff } from '../context/AuthContext';
import LloydsLogo from './LloydsLogo';
import { 
  UserCheck, 
  KeyRound, 
  UserPlus, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Sparkles,
  Stethoscope,
  HeartPulse,
  Pill,
  FlaskConical,
  HardHat,
  Lock
} from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { currentUser, staffUsers, login, register, switchAccount, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('quick'); // 'quick', 'login', 'register'

  // Form states for login
  const [loginUsername, setLoginUsername] = useState('doctor');
  const [loginPassword, setLoginPassword] = useState('lloyds2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Form states for register
  const [regFullName, setRegFullName] = useState('');
  const [regRole, setRegRole] = useState('Senior Triage Nurse');
  const [regDepartment, setRegDepartment] = useState('Outpatient & Acute Triage');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('lloyds2026');
  const [regConfirmPassword, setRegConfirmPassword] = useState('lloyds2026');
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  if (!isOpen) return null;

  const roleIcons = {
    'Chief Medical Officer': <Stethoscope className="w-5 h-5 text-emerald-600" />,
    'Senior Triage Nurse': <HeartPulse className="w-5 h-5 text-amber-600" />,
    'Registered Pharmacist': <Pill className="w-5 h-5 text-cyan-600" />,
    'Pathology Technician': <FlaskConical className="w-5 h-5 text-purple-600" />,
    'HSE Safety Officer': <HardHat className="w-5 h-5 text-rose-600" />,
    'Administrator': <ShieldCheck className="w-5 h-5 text-blue-600" />
  };

  const roleColors = {
    'Chief Medical Officer': 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50 hover:border-emerald-300',
    'Senior Triage Nurse': 'border-amber-200 bg-amber-50/40 hover:bg-amber-50 hover:border-amber-300',
    'Registered Pharmacist': 'border-cyan-200 bg-cyan-50/40 hover:bg-cyan-50 hover:border-cyan-300',
    'Pathology Technician': 'border-purple-200 bg-purple-50/40 hover:bg-purple-50 hover:border-purple-300',
    'HSE Safety Officer': 'border-rose-200 bg-rose-50/40 hover:bg-rose-50 hover:border-rose-300',
    'Administrator': 'border-blue-200 bg-blue-50/40 hover:bg-blue-50 hover:border-blue-300'
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    const res = await login(loginUsername, loginPassword);
    if (!res.success) {
      setLoginError(res.message || 'Invalid credentials. Please verify username and password.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    setRegSuccess('');

    if (!regFullName.trim() || !regUsername.trim()) {
      setRegError('Please provide your full name and a username.');
      return;
    }

    if (regPassword !== regConfirmPassword) {
      setRegError('Passwords do not match. Please re-enter.');
      return;
    }

    const res = await register({
      full_name: regFullName.trim(),
      role: regRole,
      department: regDepartment,
      username: regUsername.trim().toLowerCase(),
      password: regPassword
    });

    if (res.success) {
      setRegSuccess(`Account successfully created for ${res.user.full_name}! Switching to your shift now.`);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setRegError(res.message || 'Failed to create account.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LloydsLogo size="md" showSubtitle={true} subtitle="Papua New Guinea Healthcare" />
            <div className="hidden sm:block border-l border-slate-200 pl-4">
              <h2 className="text-base font-black text-slate-900 tracking-wide">Staff Access & Shift Portal</h2>
              <p className="text-xs text-slate-500 font-medium">100% Offline Clinical Authentication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'quick'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-rose-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>1-Click Shift Handover</span>
          </button>

          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'login'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-rose-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Staff Password Login</span>
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm shadow-rose-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/80'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>➕ New Staff Account</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: 1-Click Shift Handover */}
          {activeTab === 'quick' && (
            <div className="space-y-4">
              <div className="bg-gradient-to-r from-rose-50 via-white to-orange-50 border border-rose-200/80 p-4 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-rose-100 rounded-xl text-rose-600 mt-0.5 shrink-0">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Select Your Clinical Shift / Duty Role</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Designed for swift offline triage in Papua New Guinea. Tap your clinical role below to immediately unlock that role's interface, digital signatures, and permissions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(staffUsers && staffUsers.length > 0 ? staffUsers : defaultDemoStaff).map((staff) => {
                  const isCurrent = currentUser?.id === staff.id || currentUser?.username === staff.username;
                  const borderClass = roleColors[staff.role] || 'border-slate-200 bg-slate-50/50 hover:bg-slate-50';
                  const icon = roleIcons[staff.role] || <UserCheck className="w-5 h-5 text-slate-500" />;

                  return (
                    <button
                      key={staff.id || staff.username}
                      onClick={() => switchAccount(staff)}
                      className={`relative p-4 rounded-2xl border text-left flex items-start gap-3.5 transition-all group hover:shadow-md cursor-pointer ${borderClass} ${
                        isCurrent ? 'ring-2 ring-rose-500 shadow-sm shadow-rose-500/10' : ''
                      }`}
                    >
                      <div className="p-2.5 rounded-xl bg-white border border-slate-200 group-hover:border-slate-300 shadow-xs transition-colors">
                        {icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-mono font-bold text-slate-500">
                            {staff.staff_id || 'LMEL-MED'}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-xs">
                              Active Shift
                            </span>
                          )}
                        </div>

                        <h5 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                          {staff.full_name}
                        </h5>
                        <p className="text-xs font-semibold text-slate-600">
                          {staff.role}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {staff.department}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-500 px-1">
                <span>🔐 Offline Local Security • SHA-256 Verified</span>
                <span className="text-emerald-600 font-bold">Ready for USB Flash Drive</span>
              </div>
            </div>
          )}

          {/* TAB 2: Standard Staff Password Login */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Enter your unique staff username and personal password to sign in.
                  Default system accounts have password <code className="text-rose-700 font-bold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">lloyds2026</code>.
                </p>
              </div>

              {loginError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Staff Username
                  </label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. doctor, nurse, pharmacist, admin"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password / Access PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 pr-16 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-800 px-2 py-1 rounded cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-md shadow-rose-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <Lock className="w-4 h-4" />
                  <span>{loading ? 'Authenticating...' : 'Sign In to Clinical System'}</span>
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Register New Staff Account */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                <p className="text-xs text-slate-600 leading-relaxed">
                  Register a new medical officer, nurse, pharmacist, or lab assistant into the hospital database. The new account will be permanently saved to your pen-drive database.
                </p>
              </div>

              {regError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Sister Betty Kurum"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Hospital Role *
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  >
                    <option value="Chief Medical Officer">Chief Medical Officer</option>
                    <option value="Duty Medical Officer">Duty Medical Officer</option>
                    <option value="Senior Triage Nurse">Senior Triage Nurse</option>
                    <option value="Registered Pharmacist">Registered Pharmacist</option>
                    <option value="Pathology Technician">Pathology Technician</option>
                    <option value="HSE Safety Officer">HSE Safety Officer</option>
                    <option value="Administrator">Administrator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="e.g. Emergency & Triage"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Login Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. betty.nurse"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm shadow-md shadow-rose-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Creating Account...' : 'Register Hospital Staff Account'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

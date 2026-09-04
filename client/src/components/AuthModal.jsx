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
    'Chief Medical Officer': <Stethoscope className="w-6 h-6 text-emerald-400" />,
    'Senior Triage Nurse': <HeartPulse className="w-6 h-6 text-amber-400" />,
    'Registered Pharmacist': <Pill className="w-6 h-6 text-cyan-400" />,
    'Pathology Technician': <FlaskConical className="w-6 h-6 text-purple-400" />,
    'HSE Safety Officer': <HardHat className="w-6 h-6 text-rose-400" />,
    'Administrator': <ShieldCheck className="w-6 h-6 text-blue-400" />
  };

  const roleColors = {
    'Chief Medical Officer': 'border-emerald-500/40 bg-emerald-950/20 hover:border-emerald-400',
    'Senior Triage Nurse': 'border-amber-500/40 bg-amber-950/20 hover:border-amber-400',
    'Registered Pharmacist': 'border-cyan-500/40 bg-cyan-950/20 hover:border-cyan-400',
    'Pathology Technician': 'border-purple-500/40 bg-purple-950/20 hover:border-purple-400',
    'HSE Safety Officer': 'border-rose-500/40 bg-rose-950/20 hover:border-rose-400',
    'Administrator': 'border-blue-500/40 bg-blue-950/20 hover:border-blue-400'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-[#0B1528] border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#070D18] via-[#0F1E36] to-[#070D18] border-b border-slate-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LloydsLogo size="md" showSubtitle={true} subtitle="Papua New Guinea Healthcare" />
            <div className="hidden sm:block border-l border-slate-700/70 pl-4">
              <h2 className="text-base font-bold text-white tracking-wide">Staff Access & Shift Portal</h2>
              <p className="text-xs text-slate-400">100% Offline Clinical Authentication</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Psychological Friendly Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-[#070D18]/90 p-1.5 gap-1.5">
          <button
            onClick={() => setActiveTab('quick')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'quick'
                ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md shadow-red-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>1-Click Shift Handover</span>
          </button>

          <button
            onClick={() => setActiveTab('login')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'login'
                ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md shadow-red-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Staff Password Login</span>
          </button>

          <button
            onClick={() => setActiveTab('register')}
            className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'register'
                ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white shadow-md shadow-red-950/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>➕ New Staff Account</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* TAB 1: 1-Click Shift Handover (Designed for village health workers & high stress emergency triage) */}
          {activeTab === 'quick' && (
            <div className="space-y-4">
              <div className="bg-slate-900/60 border border-slate-800 p-4 rounded-xl flex items-start gap-3">
                <div className="p-2 bg-red-950/50 rounded-lg text-red-400 mt-0.5">
                  <HeartPulse className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Select Your Clinical Shift / Duty Role</h4>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Designed for swift offline triage in Papua New Guinea. Tap your clinical role below to immediately unlock that role's interface, digital signatures, and permissions.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(staffUsers && staffUsers.length > 0 ? staffUsers : defaultDemoStaff).map((staff) => {
                  const isCurrent = currentUser?.id === staff.id || currentUser?.username === staff.username;
                  const borderClass = roleColors[staff.role] || 'border-slate-700 bg-slate-900/40';
                  const icon = roleIcons[staff.role] || <UserCheck className="w-6 h-6 text-slate-400" />;

                  return (
                    <button
                      key={staff.id || staff.username}
                      onClick={() => switchAccount(staff)}
                      className={`relative p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all group hover:scale-[1.01] hover:shadow-lg ${borderClass} ${
                        isCurrent ? 'ring-2 ring-red-500 shadow-md shadow-red-900/30' : ''
                      }`}
                    >
                      <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 group-hover:bg-slate-800 transition-colors">
                        {icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            {staff.staff_id || 'LMEL-MED'}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
                              Active Shift
                            </span>
                          )}
                        </div>

                        <h5 className="text-sm font-bold text-white truncate mt-0.5">
                          {staff.full_name}
                        </h5>
                        <p className="text-xs font-semibold text-slate-300">
                          {staff.role}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {staff.department}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 flex items-center justify-between text-xs text-slate-400 px-1">
                <span>🔐 Offline Local Security • SHA-256 Verified</span>
                <span className="text-emerald-400 font-semibold">Ready for USB Flash Drive</span>
              </div>
            </div>
          )}

          {/* TAB 2: Standard Staff Password Login */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                <p className="text-xs text-slate-300">
                  Enter your unique staff username and personal password to sign in.
                  Default system accounts have password <code className="text-red-400 font-bold bg-slate-950 px-1.5 py-0.5 rounded">lloyds2026</code>.
                </p>
              </div>

              {loginError && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Staff Username
                  </label>
                  <input
                    type="text"
                    required
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="e.g. doctor, nurse, pharmacist, admin"
                    className="w-full bg-[#081120] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password / Access PIN
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#081120] border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white px-2 py-1 rounded"
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
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
              <div className="bg-slate-900/40 border border-slate-800 p-4 rounded-xl">
                <p className="text-xs text-slate-300">
                  Register a new medical officer, nurse, pharmacist, or lab assistant into the hospital database. The new account will be permanently saved to your pen-drive database.
                </p>
              </div>

              {regError && (
                <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {regSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{regSuccess}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Staff Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="e.g. Sister Betty Kurum"
                    className="w-full bg-[#081120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Hospital Role *
                  </label>
                  <select
                    value={regRole}
                    onChange={(e) => setRegRole(e.target.value)}
                    className="w-full bg-[#081120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Department
                  </label>
                  <input
                    type="text"
                    value={regDepartment}
                    onChange={(e) => setRegDepartment(e.target.value)}
                    placeholder="e.g. Emergency & Triage"
                    className="w-full bg-[#081120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Login Username *
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. betty.nurse"
                    className="w-full bg-[#081120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#081120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Confirm Password *
                  </label>
                  <input
                    type="password"
                    required
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#081120] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-sm shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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

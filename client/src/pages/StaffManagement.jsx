import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import LloydsLogo from '../components/LloydsLogo';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Stethoscope, 
  HeartPulse, 
  Pill, 
  FlaskConical, 
  HardHat, 
  ShieldCheck, 
  CheckCircle2, 
  Key, 
  Search, 
  Sparkles,
  Lock,
  Building2,
  Calendar,
  AlertTriangle
} from 'lucide-react';

export default function StaffManagement({ settings }) {
  const { currentUser, staffUsers, refreshStaffList, switchAccount, register } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState('All');

  // Form states for new staff
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('Senior Triage Nurse');
  const [newDepartment, setNewDepartment] = useState('Outpatient & Acute Triage');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('lloyds2026');
  const [newEmail, setNewEmail] = useState('');
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshStaffList();
  }, []);

  const roleIcons = {
    'Chief Medical Officer': <Stethoscope className="w-5 h-5 text-emerald-400" />,
    'Duty Medical Officer': <Stethoscope className="w-5 h-5 text-emerald-400" />,
    'Senior Triage Nurse': <HeartPulse className="w-5 h-5 text-amber-400" />,
    'Registered Pharmacist': <Pill className="w-5 h-5 text-cyan-400" />,
    'Pathology Technician': <FlaskConical className="w-5 h-5 text-purple-400" />,
    'HSE Safety Officer': <HardHat className="w-5 h-5 text-rose-400" />,
    'Administrator': <ShieldCheck className="w-5 h-5 text-blue-400" />
  };

  const roleColors = {
    'Chief Medical Officer': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Duty Medical Officer': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    'Senior Triage Nurse': 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    'Registered Pharmacist': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
    'Pathology Technician': 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    'HSE Safety Officer': 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    'Administrator': 'bg-blue-500/10 text-blue-400 border-blue-500/30'
  };

  const filteredStaff = (staffUsers || []).filter(u => {
    const matchesSearch = 
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.staff_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDept = selectedDepartment === 'All' || u.department?.toLowerCase().includes(selectedDepartment.toLowerCase());
    return matchesSearch && matchesDept;
  });

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setFormMsg({ type: '', text: '' });
    setSubmitting(true);

    try {
      const res = await register({
        full_name: newFullName.trim(),
        role: newRole,
        department: newDepartment.trim(),
        username: newUsername.trim().toLowerCase(),
        password: newPassword,
        email: newEmail.trim()
      });

      if (res.success) {
        setFormMsg({ type: 'success', text: `Staff account successfully registered for ${res.user.full_name} (${res.user.staff_id})` });
        setNewFullName('');
        setNewUsername('');
        setNewEmail('');
        setTimeout(() => {
          setIsAddModalOpen(false);
          setFormMsg({ type: '', text: '' });
        }, 1500);
      } else {
        setFormMsg({ type: 'error', text: res.message || 'Failed to create account.' });
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="bg-gradient-to-r from-[#070D18] via-[#0D1A30] to-[#070D18] border border-slate-800 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30">
              <Users className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                Staff Accounts & Role-Based Access Control
              </h1>
              <p className="text-xs sm:text-sm text-slate-300">
                Lloyds Metals & Energy Ltd — Clinical Personnel Directory & Shift Authority
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10 w-full md:w-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-sm shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 transition-all"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Hospital Staff</span>
          </button>
        </div>
      </div>

      {/* Roster & Search Filters */}
      <div className="bg-[#0B1528] border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff name, ID, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#070D18] border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
            {['All', 'Emergency', 'Outpatient', 'Pharmacy', 'Laboratory', 'Safety'].map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedDepartment === dept
                    ? 'bg-red-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {/* Staff Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
          {filteredStaff.map((staff) => {
            const isCurrent = currentUser?.id === staff.id || currentUser?.username === staff.username;
            const badgeColor = roleColors[staff.role] || 'bg-slate-800 text-slate-300 border-slate-700';
            const icon = roleIcons[staff.role] || <Users className="w-5 h-5 text-slate-400" />;

            return (
              <div
                key={staff.id || staff.username}
                className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-red-500/80 bg-gradient-to-b from-[#0F1E36] to-[#0B1528] shadow-lg shadow-red-950/20'
                    : 'border-slate-800 bg-[#070D18]/80 hover:border-slate-700'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                      {icon}
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-400 block">
                        {staff.staff_id || 'LMEL-MED'}
                      </span>
                      {isCurrent ? (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-600 text-white">
                          Active Duty
                        </span>
                      ) : (
                        <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                          Offline / Standby
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white truncate">
                      {staff.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${badgeColor}`}>
                        {staff.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{staff.department}</span>
                    </p>
                    {staff.email && (
                      <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
                        {staff.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800/80 mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    User: @{staff.username}
                  </span>
                  <button
                    onClick={() => switchAccount(staff)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-slate-800 text-slate-400 cursor-default'
                        : 'bg-red-950/60 hover:bg-red-600 text-red-300 hover:text-white border border-red-800/60 hover:border-red-500'
                    }`}
                  >
                    {isCurrent ? 'Current Shift' : 'Switch to Shift'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Role Permissions Matrix Explanation (Psychologically Clear for Village Staff) */}
      <div className="bg-[#0B1528] border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-red-400" />
          <h2 className="text-base font-bold text-white">Clinical Role Permissions Matrix</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-[#070D18] text-slate-300 uppercase tracking-wider font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Hospital Role</th>
                <th className="py-3 px-4">Primary Station</th>
                <th className="py-3 px-4">Triage & OPD</th>
                <th className="py-3 px-4">Prescribe & Diagnose</th>
                <th className="py-3 px-4">Pharmacy POS</th>
                <th className="py-3 px-4">Excel & Shift Close</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300 font-medium">
              <tr>
                <td className="py-3 px-4 font-bold text-emerald-400 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4" />
                  <span>Chief Medical Officer</span>
                </td>
                <td className="py-3 px-4">Consultation Room 1</td>
                <td className="py-3 px-4 text-emerald-400">✓ Full</td>
                <td className="py-3 px-4 text-emerald-400">✓ Full Authority</td>
                <td className="py-3 px-4 text-emerald-400">✓ View & Order</td>
                <td className="py-3 px-4 text-emerald-400">✓ Authorize</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-amber-400 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4" />
                  <span>Senior Triage Nurse</span>
                </td>
                <td className="py-3 px-4">Triage Desk & Vitals</td>
                <td className="py-3 px-4 text-emerald-400">✓ Full Vitals & RDT</td>
                <td className="py-3 px-4 text-slate-500">First Aid Only</td>
                <td className="py-3 px-4 text-slate-500">View Only</td>
                <td className="py-3 px-4 text-slate-500">Shift Handover</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-cyan-400 flex items-center gap-1.5">
                  <Pill className="w-4 h-4" />
                  <span>Registered Pharmacist</span>
                </td>
                <td className="py-3 px-4">Pharmacy & Medical Depot</td>
                <td className="py-3 px-4 text-slate-500">View Queue</td>
                <td className="py-3 px-4 text-slate-500">Verify Prescriptions</td>
                <td className="py-3 px-4 text-emerald-400">✓ Full POS & Restock</td>
                <td className="py-3 px-4 text-emerald-400">✓ Cash Balance</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-purple-400 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4" />
                  <span>Pathology Technician</span>
                </td>
                <td className="py-3 px-4">Diagnostic Lab</td>
                <td className="py-3 px-4 text-emerald-400">✓ Enter RDT Results</td>
                <td className="py-3 px-4 text-slate-500">-</td>
                <td className="py-3 px-4 text-slate-500">-</td>
                <td className="py-3 px-4 text-slate-500">-</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-blue-400 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Administrator</span>
                </td>
                <td className="py-3 px-4">Admin Office</td>
                <td className="py-3 px-4 text-emerald-400">✓ All Records</td>
                <td className="py-3 px-4 text-slate-500">-</td>
                <td className="py-3 px-4 text-emerald-400">✓ Audits</td>
                <td className="py-3 px-4 text-emerald-400">✓ Encrypted Excel</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Staff Member */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-[#0B1528] border border-slate-700/80 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-[#070D18] border-b border-slate-800 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-600/20 text-red-400 rounded-lg">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Create Hospital Staff Account</h3>
                  <p className="text-xs text-slate-400">Saved to offline SQLite database</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              {formMsg.text && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  formMsg.type === 'success' 
                    ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-200' 
                    : 'bg-red-950/60 border border-red-800 text-red-200'
                }`}>
                  {formMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sister Maria Kila"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Role *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
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
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. maria.kila"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                  Official Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="name.png@lloyds.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#070D18] border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white text-sm font-bold shadow-md shadow-red-950/50 disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Register Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

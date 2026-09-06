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
    'Chief Medical Officer': <Stethoscope className="w-5 h-5 text-emerald-600" />,
    'Duty Medical Officer': <Stethoscope className="w-5 h-5 text-emerald-600" />,
    'Senior Triage Nurse': <HeartPulse className="w-5 h-5 text-amber-600" />,
    'Registered Pharmacist': <Pill className="w-5 h-5 text-cyan-600" />,
    'Pathology Technician': <FlaskConical className="w-5 h-5 text-purple-600" />,
    'HSE Safety Officer': <HardHat className="w-5 h-5 text-rose-600" />,
    'Administrator': <ShieldCheck className="w-5 h-5 text-blue-600" />
  };

  const roleColors = {
    'Chief Medical Officer': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Duty Medical Officer': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Senior Triage Nurse': 'bg-amber-50 text-amber-800 border-amber-200',
    'Registered Pharmacist': 'bg-cyan-50 text-cyan-800 border-cyan-200',
    'Pathology Technician': 'bg-purple-50 text-purple-800 border-purple-200',
    'HSE Safety Officer': 'bg-rose-50 text-rose-800 border-rose-200',
    'Administrator': 'bg-blue-50 text-blue-800 border-blue-200'
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
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm relative overflow-hidden">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <Users className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Staff Accounts & Role-Based Access Control
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Lloyds Metals & Energy Ltd — Clinical Personnel Directory & Shift Authority
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 z-10 w-full md:w-auto">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="w-full md:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register New Hospital Staff</span>
          </button>
        </div>
      </div>

      {/* Roster & Search Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff name, ID, role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1">
            {['All', 'Emergency', 'Outpatient', 'Pharmacy', 'Laboratory', 'Safety'].map((dept) => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  selectedDepartment === dept
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
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
            const badgeColor = roleColors[staff.role] || 'bg-slate-100 text-slate-700 border-slate-200';
            const icon = roleIcons[staff.role] || <Users className="w-5 h-5 text-slate-500" />;

            return (
              <div
                key={staff.id || staff.username}
                className={`p-5 rounded-xl border transition-all flex flex-col justify-between ${
                  isCurrent
                    ? 'border-rose-300 bg-rose-50/50 shadow-sm'
                    : 'border-slate-200 bg-slate-50/40 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs">
                      {icon}
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-slate-500 block">
                        {staff.staff_id || 'LMEL-MED'}
                      </span>
                      {isCurrent ? (
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-600 text-white shadow-2xs">
                          Active Duty
                        </span>
                      ) : (
                        <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                          Offline / Standby
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {staff.full_name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${badgeColor}`}>
                        {staff.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>{staff.department}</span>
                    </p>
                    {staff.email && (
                      <p className="text-xs text-slate-500 truncate mt-0.5 font-mono">
                        {staff.email}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-200 mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500 font-mono">
                    User: @{staff.username}
                  </span>
                  <button
                    onClick={() => switchAccount(staff)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-slate-100 text-slate-400 cursor-default border border-slate-200'
                        : 'bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 hover:border-rose-600'
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
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-rose-600" />
          <h2 className="text-base font-bold text-slate-900">Clinical Role Permissions Matrix</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Hospital Role</th>
                <th className="py-3 px-4">Primary Station</th>
                <th className="py-3 px-4">Triage & OPD</th>
                <th className="py-3 px-4">Prescribe & Diagnose</th>
                <th className="py-3 px-4">Pharmacy POS</th>
                <th className="py-3 px-4">Excel & Shift Close</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 font-medium">
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-bold text-emerald-700 flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4" />
                  <span>Chief Medical Officer</span>
                </td>
                <td className="py-3 px-4">Consultation Room 1</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Full</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Full Authority</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ View & Order</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Authorize</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-bold text-amber-700 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4" />
                  <span>Senior Triage Nurse</span>
                </td>
                <td className="py-3 px-4">Triage Desk & Vitals</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Full Vitals & RDT</td>
                <td className="py-3 px-4 text-slate-400">First Aid Only</td>
                <td className="py-3 px-4 text-slate-400">View Only</td>
                <td className="py-3 px-4 text-slate-400">Shift Handover</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-bold text-cyan-700 flex items-center gap-1.5">
                  <Pill className="w-4 h-4" />
                  <span>Registered Pharmacist</span>
                </td>
                <td className="py-3 px-4">Pharmacy & Medical Depot</td>
                <td className="py-3 px-4 text-slate-400">View Queue</td>
                <td className="py-3 px-4 text-slate-400">Verify Prescriptions</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Full POS & Restock</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Cash Balance</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-bold text-purple-700 flex items-center gap-1.5">
                  <FlaskConical className="w-4 h-4" />
                  <span>Pathology Technician</span>
                </td>
                <td className="py-3 px-4">Diagnostic Lab</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Enter RDT Results</td>
                <td className="py-3 px-4 text-slate-400">-</td>
                <td className="py-3 px-4 text-slate-400">-</td>
                <td className="py-3 px-4 text-slate-400">-</td>
              </tr>
              <tr className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-bold text-blue-700 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Administrator</span>
                </td>
                <td className="py-3 px-4">Admin Office</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ All Records</td>
                <td className="py-3 px-4 text-slate-400">-</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Audits</td>
                <td className="py-3 px-4 text-emerald-700 font-bold">✓ Encrypted Excel</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add New Staff Member */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="bg-slate-50 border-b border-slate-200 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Create Hospital Staff Account</h3>
                  <p className="text-xs text-slate-500">Saved to offline SQLite database</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="p-6 space-y-4">
              {formMsg.text && (
                <div className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  formMsg.type === 'success' 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {formMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sister Maria Kila"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Role *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
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
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. maria.kila"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Official Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="name.png@lloyds.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-sm font-bold shadow-md shadow-rose-500/20 disabled:opacity-50 cursor-pointer"
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

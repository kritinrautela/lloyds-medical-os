import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  QrCode, 
  Calendar, 
  Phone, 
  MapPin, 
  AlertCircle, 
  FileText, 
  CheckCircle2, 
  Clock, 
  X,
  ChevronRight,
  Eye,
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import PatientCardModal from '../components/PatientCardModal';

export default function Patients({ settings, onCheckInPatient, refreshStats }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [provinceFilter, setProvinceFilter] = useState('');
  
  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedPatientForCard, setSelectedPatientForCard] = useState(null);
  const [selectedPatientHistory, setSelectedPatientHistory] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // New Patient Form State
  const [formData, setFormData] = useState({
    full_name: '',
    age: '',
    gender: 'Male',
    phone: '',
    province: 'Morobe Province',
    district: 'Lae Urban',
    address_or_village: '',
    blood_group: 'O+',
    allergies: '',
    emergency_contact: '',
    medical_history: ''
  });

  const pngProvinces = [
    'Morobe Province',
    'National Capital District (Port Moresby)',
    'Western Highlands Province',
    'Eastern Highlands Province',
    'Madang Province',
    'Central Province',
    'East New Britain',
    'West New Britain',
    'Enga Province',
    'Southern Highlands',
    'Sepik (East & West)',
    'Milne Bay',
    'Manus / New Ireland',
    'Bougainville'
  ];

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await api.getPatients({ q: searchQuery, province: provinceFilter });
      setPatients(res.patients || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [searchQuery, provinceFilter]);

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.age) {
      alert('Please fill in patient name and age');
      return;
    }
    try {
      const res = await api.createPatient(formData);
      setIsRegisterOpen(false);
      setFormData({
        full_name: '',
        age: '',
        gender: 'Male',
        phone: '',
        province: 'Morobe Province',
        district: 'Lae Urban',
        address_or_village: '',
        blood_group: 'O+',
        allergies: '',
        emergency_contact: '',
        medical_history: ''
      });
      fetchPatients();
      if (refreshStats) refreshStats();
      // Offer to check in immediately
      if (confirm(`Patient ${res.patient.full_name} (${res.patient.patient_code}) registered! Would you like to check them into today's OPD queue now?`)) {
        onCheckInPatient(res.patient);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const viewHistory = async (patientId) => {
    try {
      setHistoryLoading(true);
      const data = await api.getPatient(patientId);
      setSelectedPatientHistory(data);
    } catch (err) {
      alert('Failed to load history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Are you sure you want to delete patient record for ${name}?`)) {
      try {
        await api.deletePatient(id);
        fetchPatients();
        if (refreshStats) refreshStats();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>Patient Registry & Health Records</span>
          </h2>
          <p className="text-xs text-slate-400">
            Search patient records, check-in to OPD queue, and generate printable digital health QR cards.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/15 hover:scale-[1.02] active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Name, Patient ID (PAT-PNG-...), Village, or Phone..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500 transition-all"
          />
        </div>

        <div>
          <select
            value={provinceFilter}
            onChange={(e) => setProvinceFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">All PNG Provinces</option>
            {pngProvinces.map((p, i) => (
              <option key={i} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Patients Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Patient Name</th>
                <th className="py-3 px-4">Demographics</th>
                <th className="py-3 px-4">Location / Village</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Allergies</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">Loading patients from local SQLite database...</td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-center text-slate-400">
                    No patients found matching your search.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                      {p.patient_code}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{p.full_name}</div>
                      <div className="text-[10px] text-slate-400">{p.medical_history ? p.medical_history.slice(0, 35) + '...' : 'No prior history'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-200">{p.age} Yrs • {p.gender}</div>
                      <div className="text-[10px] font-semibold text-emerald-400">Blood: {p.blood_group || 'N/A'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-300 font-medium">{p.address_or_village || '-'}</div>
                      <div className="text-[10px] text-slate-400">{p.district ? `${p.district}, ` : ''}{p.province}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-mono">
                      {p.phone || '-'}
                    </td>
                    <td className="py-3 px-4">
                      {p.allergies && p.allergies !== 'None' ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-red-500/20 text-red-300 border border-red-500/30">
                          {p.allergies}
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Check-in to today */}
                        <button
                          onClick={() => onCheckInPatient(p)}
                          title="Check into today's OPD Queue"
                          className="px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 text-[11px] font-semibold transition-all"
                        >
                          Check-in
                        </button>
                        {/* QR Card */}
                        <button
                          onClick={() => setSelectedPatientForCard(p)}
                          title="View Digital Health Card"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          <QrCode className="w-3.5 h-3.5 text-cyan-400" />
                        </button>
                        {/* View History */}
                        <button
                          onClick={() => viewHistory(p.id)}
                          title="View Medical Timeline"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDelete(p.id, p.full_name)}
                          title="Delete Record"
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register New Patient Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-[#0F2744] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-8 animate-scaleIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/80 bg-slate-900/70">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>New Patient Registration (Papua New Guinea)</span>
              </h3>
              <button onClick={() => setIsRegisterOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRegisterSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="e.g. Paulus Kurum"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Age (Years) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="125"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    placeholder="e.g. 34"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +675 7123 4567"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Blood Group</label>
                  <select
                    value={formData.blood_group}
                    onChange={(e) => setFormData({ ...formData, blood_group: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="Unknown">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">PNG Province</label>
                  <select
                    value={formData.province}
                    onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    {pngProvinces.map((p, i) => (
                      <option key={i} value={p}>{p}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">District / Sub-district</label>
                  <input
                    type="text"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                    placeholder="e.g. Lae Urban / Hagen Central"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Village / Settlement Address</label>
                  <input
                    type="text"
                    value={formData.address_or_village}
                    onChange={(e) => setFormData({ ...formData, address_or_village: e.target.value })}
                    placeholder="e.g. Boundary Road Compound 4 / Kwikila Bush Camp"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Known Drug Allergies</label>
                  <input
                    type="text"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    placeholder="e.g. Penicillin, Sulphonamides (Bactrim), Aspirin, or None"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Emergency Contact</label>
                  <input
                    type="text"
                    value={formData.emergency_contact}
                    onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    placeholder="e.g. Brother: John (+675 7123 9999)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Medical Background / History</label>
                  <textarea
                    rows="2"
                    value={formData.medical_history}
                    onChange={(e) => setFormData({ ...formData, medical_history: e.target.value })}
                    placeholder="e.g. Past malaria in 2024, hypertension, asthma, diabetes..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20"
                >
                  Save Patient
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient History Drawer */}
      {selectedPatientHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/70 backdrop-blur-sm">
          <div className="w-full max-w-lg h-full bg-[#0A1B35] border-l border-slate-700 p-6 flex flex-col justify-between overflow-y-auto animate-slideLeft">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider">Patient Medical Record</span>
                  <h3 className="text-lg font-bold text-white">{selectedPatientHistory.patient.full_name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{selectedPatientHistory.patient.patient_code}</p>
                </div>
                <button
                  onClick={() => setSelectedPatientHistory(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Patient Basic Details */}
              <div className="grid grid-cols-2 gap-3 my-4 p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800 text-xs">
                <div><span className="text-slate-400">Age / Gender:</span> <strong className="text-white">{selectedPatientHistory.patient.age} Yrs / {selectedPatientHistory.patient.gender}</strong></div>
                <div><span className="text-slate-400">Blood:</span> <strong className="text-emerald-400">{selectedPatientHistory.patient.blood_group}</strong></div>
                <div><span className="text-slate-400">Phone:</span> <span className="text-slate-200">{selectedPatientHistory.patient.phone || '-'}</span></div>
                <div><span className="text-slate-400">Village:</span> <span className="text-slate-200">{selectedPatientHistory.patient.address_or_village || '-'}</span></div>
                <div className="col-span-2 text-red-400 font-medium">Allergies: {selectedPatientHistory.patient.allergies || 'None'}</div>
              </div>

              {/* Past Visits Timeline */}
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>Visit & Triage History ({selectedPatientHistory.visits?.length || 0})</span>
              </h4>

              <div className="space-y-3 mb-6">
                {selectedPatientHistory.visits?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No past visits recorded.</p>
                ) : (
                  selectedPatientHistory.visits.map((v) => (
                    <div key={v.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span className="text-cyan-300">{v.visit_date} • {v.visit_code}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300">{v.status}</span>
                      </div>
                      <p className="text-slate-200 font-medium">Reason: {v.reason}</p>
                      {v.diagnosis && <p className="text-emerald-300 text-[11px]">Diagnosis: {v.diagnosis}</p>}
                      <div className="text-[10px] text-slate-400 flex flex-wrap gap-2 pt-1 font-mono">
                        {v.bp && <span>BP: {v.bp}</span>}
                        {v.temp && <span>Temp: {v.temp}</span>}
                        {v.pulse && <span>Pulse: {v.pulse}</span>}
                        {v.spo2 && <span>SpO2: {v.spo2}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Past Prescriptions */}
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                <span>Pharmacy Dispensing History ({selectedPatientHistory.dispensations?.length || 0})</span>
              </h4>

              <div className="space-y-2">
                {selectedPatientHistory.dispensations?.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No past pharmacy records.</p>
                ) : (
                  selectedPatientHistory.dispensations.map((d) => (
                    <div key={d.id} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-cyan-400 font-bold">{d.invoice_number}</span>
                        <span className="font-bold text-white">{settings?.currency_symbol || 'K'} {d.paid_amount.toFixed(2)}</span>
                      </div>
                      <p className="text-slate-300 text-[11px]">{d.drugs_summary}</p>
                      <span className="text-[10px] text-slate-500">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-between">
              <button
                onClick={() => setSelectedPatientForCard(selectedPatientHistory.patient)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Print QR Card</span>
              </button>
              <button
                onClick={() => {
                  onCheckInPatient(selectedPatientHistory.patient);
                  setSelectedPatientHistory(null);
                }}
                className="px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs"
              >
                Check-in Today
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Health ID Card Modal */}
      <PatientCardModal
        isOpen={!!selectedPatientForCard}
        onClose={() => setSelectedPatientForCard(null)}
        patient={selectedPatientForCard}
        hospital={settings}
      />
    </div>
  );
}

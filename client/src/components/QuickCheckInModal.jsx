import React, { useState, useEffect } from 'react';
import { Plus, X, UserCheck, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function QuickCheckInModal({ isOpen, onClose, defaultPatient, onSuccess, settings }) {
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [reason, setReason] = useState('General medical checkup');
  const [priority, setPriority] = useState('Standard');
  const [doctorName, setDoctorName] = useState(settings?.doctor_in_charge || 'Chief Medical Officer');
  const [consultationFee, setConsultationFee] = useState(15.0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      api.getPatients().then(res => setPatients(res.patients || []));
      if (defaultPatient) {
        setSelectedPatientId(defaultPatient.id);
      }
      if (settings?.doctor_in_charge) {
        setDoctorName(settings.doctor_in_charge);
      }
    }
  }, [isOpen, defaultPatient, settings]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      alert('Please select a patient to check-in.');
      return;
    }

    try {
      setSubmitting(true);
      await api.checkInPatient({
        patient_id: parseInt(selectedPatientId, 10),
        reason,
        triage_priority: priority,
        doctor_name: doctorName,
        consultation_fee: parseFloat(consultationFee) || 0
      });
      onSuccess();
      onClose();
    } catch (err) {
      alert('Check-in failed: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const currency = settings?.currency_symbol || 'K';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md bg-[#0F2744] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden p-6 animate-scaleIn">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-white">OPD Patient Check-In</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Select Patient *</label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="">-- Choose Patient --</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patient_code} - {p.full_name} ({p.age}y, {p.province})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Chief Complaint / Reason for Visit *</label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. High fever & chills / Cough / Medication refill"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Triage Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Standard">Standard</option>
                <option value="Urgent">Urgent</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Consultation Fee ({currency})</label>
              <input
                type="number"
                step="0.5"
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Attending Medical Officer</label>
            <input
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20"
            >
              {submitting ? 'Checking in...' : 'Add to OPD Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

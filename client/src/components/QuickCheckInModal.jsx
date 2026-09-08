import React, { useEffect, useRef, useState } from 'react';
import { useFocusTrap, Value } from './ui';
import { PatientAvatar } from './PatientPhoto';
import { AlertTriangle, Loader2, Search, UserCheck, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

/*
 * Check-in is the busiest screen in the clinic: every patient passes through
 * it. Two rules shape it.
 *
 * Nothing clinical is filled in for the person using it. The reason for the
 * visit starts empty and the attending clinician starts empty, because a
 * pre-filled "General medical checkup" attributed to the doctor in charge
 * becomes a permanent record of a consultation that may never have happened
 * the way it reads. An empty field asks a question; a wrong default answers it
 * for you.
 *
 * The number shown is the one printed on the patient's card. The register
 * tells the patient their hospital number is theirs for life, so that is the
 * number that has to appear here too, not an internal code.
 */
export default function QuickCheckInModal({ isOpen, onClose, defaultPatient, onSuccess, settings }) {
  const scrimRef = useRef(null);
  useFocusTrap(scrimRef, isOpen);
  const { currentUser } = useAuth();
  // The chosen patient, and the search that finds one. The register is asked
  // by the server, which knows the check digit on the hospital number, rather
  // than by scrolling a list of every name the clinic has ever seen.
  const [selected, setSelected] = useState(null);
  const [patientQuery, setPatientQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [searching, setSearching] = useState(false);
  const selectedPatientId = selected ? String(selected.id) : '';
  const [reason, setReason] = useState('');
  const [priority, setPriority] = useState('Standard');
  const [doctorName, setDoctorName] = useState('');
  const [consultationFee, setConsultationFee] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const reasonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    setError('');
    setReason('');
    setPriority('Standard');
    setSelected(defaultPatient || null);
    setPatientQuery('');
    setMatches([]);

    // The fee is what this clinic has decided to charge, not a number invented
    // here. If no fee has been set in Facility settings the field stays empty
    // and whoever checks the patient in has to enter what was charged.
    const fee = settings?.default_consultation_fee;
    setConsultationFee(fee === null || fee === undefined || fee === '' ? '' : String(fee));

    // The person signing in is the one standing at the desk, so their name is
    // a fact rather than a guess. It can still be changed if somebody else
    // will be seeing the patient.
    setDoctorName(currentUser?.full_name || '');

  }, [isOpen, defaultPatient, settings, currentUser]);

  useEffect(() => {
    const q = patientQuery.trim();
    if (!isOpen || q.length < 2) { setMatches([]); return undefined; }
    let live = true;
    setSearching(true);
    const id = setTimeout(() => {
      api.getPatients({ q, limit: 8 })
        .then((res) => { if (live) setMatches(res.patients || []); })
        .catch(() => { if (live) setError('The patient register could not be read. Check that the clinic server is running.'); })
        .finally(() => { if (live) setSearching(false); });
    }, 180);
    return () => { live = false; clearTimeout(id); };
  }, [patientQuery, isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && defaultPatient) reasonRef.current?.focus();
  }, [isOpen, defaultPatient]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!selectedPatientId) return setError('Choose which patient is being seen.');
    if (!reason.trim()) return setError('Write why the patient has come. This is what the clinician reads first.');

    try {
      setSubmitting(true);
      const res = await api.checkInPatient({
        patient_id: parseInt(selectedPatientId, 10),
        reason: reason.trim(),
        triage_priority: priority,
        doctor_name: doctorName.trim(),
        consultation_fee: consultationFee === '' ? 0 : parseFloat(consultationFee) || 0
      });
      onSuccess(res?.visit || null);
      onClose();
    } catch (err) {
      setError(err.message || 'The patient could not be added to the queue.');
    } finally {
      setSubmitting(false);
    }
  };

  const currency = settings?.currency_symbol || 'K';

  return (
    <div ref={scrimRef} tabIndex={-1} className="scrim outline-none" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <div className="panel w-full max-w-lg shadow-overlay">
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-3">
          <div className="flex items-start gap-2">
            <UserCheck className="mt-0.5 h-4 w-4 text-brand" aria-hidden="true" />
            <div>
              <h2 id="checkin-title" className="text-sm font-semibold text-ink">Check a patient in</h2>
              <p className="mt-0.5 text-xs text-ink-3">They join the outpatient queue in the order they arrive.</p>
            </div>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-4 py-4">
          <div>
            <label className="label" htmlFor="ci-patient">Which patient</label>
            {selected ? (
              <div className="flex items-center gap-2.5 rounded-md border border-line bg-subtle px-3 py-2">
                <PatientAvatar patient={selected} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{selected.full_name}</p>
                  <p className="truncate text-2xs text-ink-3">
                    <span className="font-mono"><Value>{selected.hospital_number || selected.patient_code}</Value></span>
                    {selected.age ? ` · ${selected.age}y` : ''}{selected.province ? ` · ${selected.province}` : ''}
                  </p>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => { setSelected(null); setPatientQuery(''); }}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
                  <input
                    id="ci-patient"
                    className="field pl-8"
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Name, hospital number from the card, or phone"
                    autoComplete="off"
                    autoFocus
                  />
                </div>
                {matches.length > 0 ? (
                  <ul className="mt-1.5 max-h-56 divide-y divide-line-soft overflow-y-auto rounded-md border border-line" aria-label="Matching patients">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-subtle"
                          onClick={() => { setSelected(p); setMatches([]); setPatientQuery(''); window.requestAnimationFrame(() => reasonRef.current?.focus()); }}
                        >
                          <PatientAvatar patient={p} size={28} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-ink">{p.full_name}</span>
                            <span className="block truncate text-2xs text-ink-3">
                              <span className="font-mono"><Value>{p.hospital_number || p.patient_code}</Value></span>
                              {p.age ? ` · ${p.age}y` : ''}{p.province ? ` · ${p.province}` : ''}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : patientQuery.trim().length >= 2 && !searching ? (
                  <p className="mt-1.5 text-2xs text-ink-3">Nobody on the register matches that. Check the spelling, or register the patient first.</p>
                ) : (
                  <p className="mt-1 text-2xs text-ink-3">Type at least two letters of the name, or the number printed on the card.</p>
                )}
              </>
            )}
          </div>

          <div>
            <label className="label" htmlFor="ci-reason">Why they have come</label>
            <input
              id="ci-reason"
              ref={reasonRef}
              className="field"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="In the patient's own words, for example: fever and chills for three days"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="ci-priority">How urgent</label>
              <select
                id="ci-priority"
                className="field"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="Standard">Standard — wait in turn</option>
                <option value="Urgent">Urgent — seen before the queue</option>
                <option value="Emergency">Emergency — seen now</option>
              </select>
            </div>

            <div>
              <label className="label" htmlFor="ci-fee">Consultation fee ({currency})</label>
              <input
                id="ci-fee"
                className="field font-mono"
                type="number"
                min="0"
                step="0.5"
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="ci-doctor">Who is seeing them</label>
            <input
              id="ci-doctor"
              className="field"
              type="text"
              value={doctorName}
              onChange={(e) => setDoctorName(e.target.value)}
              placeholder="Leave empty if it is not yet decided"
            />
          </div>

          {error ? (
            <p className="flex items-start gap-1.5 rounded-md border border-critical-line bg-critical-wash px-3 py-2 text-2xs leading-relaxed text-critical">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Adding</>
              ) : (
                <><UserCheck className="h-3.5 w-3.5" aria-hidden="true" /> Add to the queue</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

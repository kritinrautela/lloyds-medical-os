import React, { useEffect, useState } from 'react';
import { AlertTriangle, BadgeCheck, Loader2, Printer, Send, X } from 'lucide-react';
import { api } from '../services/api';
import {
  REFERRAL_DESTINATIONS, REFERRAL_TRANSPORT, REFERRAL_URGENCY
} from '../lib/publicHealth';

/*
 * Sending a patient to another facility.
 *
 * The form is short on purpose. A referral is often written with an ambulance
 * waiting outside, so only the destination and the reason are required. The
 * clinical summary is pre-filled from what was already recorded at the visit;
 * nothing else is filled in for the clinician.
 */
export default function ReferralModal({ patient, visit, onClose, onSaved, onPrint }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    if (!patient) { setForm(null); return; }
    const obs = visit ? [
      visit.bp ? `BP ${visit.bp}` : null,
      visit.pulse ? `pulse ${visit.pulse}` : null,
      visit.temp ? `temp ${visit.temp}` : null,
      visit.spo2 ? `SpO2 ${visit.spo2}%` : null,
      visit.resp_rate ? `resp ${visit.resp_rate}` : null
    ].filter(Boolean).join(', ') : '';
    setSaved(null);
    setError('');
    setForm({
      referred_to: REFERRAL_DESTINATIONS[0],
      other_destination: '',
      department: '',
      urgency: visit?.triage_priority === 'Emergency' ? 'Emergency' : visit?.triage_priority === 'Urgent' ? 'Urgent' : 'Routine',
      transport: 'Company vehicle',
      reason: '',
      clinical_summary: [
        visit?.diagnosis ? `Diagnosis: ${visit.diagnosis}.` : null,
        obs ? `Observations: ${obs}.` : null,
        visit?.rdt_result && visit.rdt_result !== 'Not done' ? `Malaria RDT: ${visit.rdt_result}.` : null,
        visit?.doctor_notes ? `Notes: ${visit.doctor_notes}` : null
      ].filter(Boolean).join('\n')
    });
  // Keyed on the ids, not the objects: the parent rebuilds these objects on
  // every render, and a referral that has just been recorded must not be
  // replaced by a blank form because the parent re-rendered to say so.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.id, visit?.id]);

  if (!patient || !form) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const destination = form.referred_to === 'Other facility' ? form.other_destination.trim() : form.referred_to;

  const submit = async (e) => {
    e.preventDefault();
    if (!destination) return setError('Name the facility the patient is being sent to.');
    if (!form.reason.trim()) return setError('Write the reason for the referral. It is the first thing the receiving doctor reads.');
    setSaving(true);
    setError('');
    try {
      const res = await api.createReferral({
        patient_id: patient.id,
        visit_id: visit?.id || null,
        referred_to: destination,
        department: form.department.trim(),
        urgency: form.urgency,
        transport: form.transport,
        reason: form.reason.trim(),
        clinical_summary: form.clinical_summary.trim()
      });
      setSaved(res.referral);
      onSaved?.(res.referral);
    } catch (err) {
      setError(err.message || 'The referral could not be recorded.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Refer to another facility">
      <div className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto shadow-overlay">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line-soft bg-surface px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-ink">{saved ? 'Referral recorded' : 'Refer to another facility'}</h2>
            <p className="mt-0.5 truncate text-xs text-ink-3">
              {patient.full_name} · <span className="font-mono">{patient.hospital_number || patient.patient_code}</span>
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {saved ? (
          <div className="space-y-4 px-4 py-4">
            <div className="rounded-md border border-ok-line bg-ok-wash px-4 py-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-ok">
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
                Referred to {saved.referred_to}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold text-ink">{saved.referral_code}</p>
              <p className="mt-1.5 text-2xs leading-relaxed text-ink-3">
                The referral stays on the clinical board until an outcome is recorded against it. Print
                the letter to go with the patient; the slip at the bottom comes back with the outcome.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
              <button type="button" className="btn" onClick={onClose}>Close</button>
              <button type="button" className="btn btn-primary" onClick={() => onPrint(saved)}>
                <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                Print the referral letter
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 px-4 py-4">
            {patient.allergies && patient.allergies !== 'None' ? (
              <p className="rounded-md border border-critical-line bg-critical-wash px-3 py-2 text-xs font-semibold text-critical">
                Allergies on record: {patient.allergies}. They print on the letter.
              </p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className={form.referred_to === 'Other facility' ? '' : 'sm:col-span-2'}>
                <label className="label" htmlFor="ref-to">Send to</label>
                <select id="ref-to" className="field" value={form.referred_to} onChange={set('referred_to')}>
                  {REFERRAL_DESTINATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {form.referred_to === 'Other facility' ? (
                <div>
                  <label className="label" htmlFor="ref-other">Name of the facility</label>
                  <input id="ref-other" className="field" value={form.other_destination} onChange={set('other_destination')} maxLength={120} />
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="ref-dept">Department or clinic</label>
                <input id="ref-dept" className="field" value={form.department} onChange={set('department')} placeholder="Surgical, medical, antenatal" maxLength={80} />
              </div>
              <div>
                <label className="label" htmlFor="ref-urgency">Urgency</label>
                <select id="ref-urgency" className="field" value={form.urgency} onChange={set('urgency')}>
                  {REFERRAL_URGENCY.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ref-transport">Transport</label>
                <select id="ref-transport" className="field" value={form.transport} onChange={set('transport')}>
                  {REFERRAL_TRANSPORT.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label" htmlFor="ref-reason">Reason for referral</label>
              <textarea id="ref-reason" className="field" rows={2} value={form.reason} onChange={set('reason')}
                placeholder="What the patient needs that this clinic cannot provide" maxLength={500} />
            </div>

            <div>
              <label className="label" htmlFor="ref-summary">Clinical summary for the receiving doctor</label>
              <textarea id="ref-summary" className="field" rows={5} value={form.clinical_summary} onChange={set('clinical_summary')} maxLength={2000} />
              <p className="mt-1 text-2xs text-ink-3">
                Pre-filled from this visit. Add treatment already given, with doses and times.
              </p>
            </div>

            {error ? (
              <p className="flex items-start gap-1.5 rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3 border-t border-line-soft pt-3">
              <p className="text-2xs text-ink-3">The letter is signed by whoever is signed in.</p>
              <div className="flex gap-2">
                <button type="button" className="btn" onClick={onClose}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                  Record the referral
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

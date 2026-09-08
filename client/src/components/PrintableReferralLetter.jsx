import React from 'react';
import { PrintFrame, FacilityHeader, Row, SignatureLine, longDate } from './PrintFrame';

/*
 * The letter that travels with the patient. It carries what the receiving
 * doctor needs before the patient can speak for themselves: why they were
 * sent, what was found, what was given, and what they are allergic to.
 */
export default function PrintableReferralLetter({ referral, settings, onClose }) {
  if (!referral) return null;
  const obs = [
    referral.bp ? `BP ${referral.bp}` : null,
    referral.pulse ? `Pulse ${referral.pulse}` : null,
    referral.temp ? `Temp ${referral.temp} °C` : null,
    referral.spo2 ? `SpO₂ ${referral.spo2}%` : null,
    referral.resp_rate ? `Resp ${referral.resp_rate}/min` : null,
    referral.weight ? `Weight ${referral.weight} kg` : null
  ].filter(Boolean).join(' · ');

  return (
    <PrintFrame title="Referral letter" subtitle={referral.referral_code} onClose={onClose} printLabel="Print the letter">
      <FacilityHeader settings={settings} documentTitle="Referral letter" reference={referral.referral_code} />

      <div className="mt-5 flex items-start justify-between gap-6 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">To</p>
          <p className="font-semibold text-ink">{referral.referred_to}</p>
          {referral.department ? <p className="text-ink-2">{referral.department}</p> : null}
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">Date</p>
          <p className="font-semibold text-ink">{longDate(referral.created_at)}</p>
          <p className={`mt-1 inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${
            referral.urgency === 'Emergency' ? 'border-critical text-critical'
              : referral.urgency === 'Urgent' ? 'border-warn text-warn' : 'border-line-strong text-ink-2'
          }`}>{referral.urgency}</p>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink">Patient</h2>
      <dl className="mt-1">
        <Row label="Name">{referral.patient_name}</Row>
        <Row label="Hospital number"><span className="font-mono">{referral.hospital_number || referral.patient_code}</span></Row>
        <Row label="Age and sex">{[referral.age ? `${referral.age} years` : null, referral.gender].filter(Boolean).join(', ')}</Row>
        <Row label="Village">{referral.address_or_village}</Row>
        <Row label="Phone">{referral.phone}</Row>
        <Row label="Blood group">{referral.blood_group}</Row>
        <Row label="Allergies">
          {referral.allergies && referral.allergies !== 'None'
            ? <span className="font-bold text-critical">{referral.allergies}</span>
            : 'None recorded'}
        </Row>
      </dl>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-ink">Reason for referral</h2>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{referral.reason}</p>

      <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-ink">Clinical summary</h2>
      <dl className="mt-1">
        <Row label="Diagnosis">{referral.diagnosis}</Row>
        <Row label="Observations">{obs}</Row>
        <Row label="Summary"><span className="whitespace-pre-wrap">{referral.clinical_summary}</span></Row>
        <Row label="Transport">{referral.transport}</Row>
      </dl>

      <div className="mt-8 grid grid-cols-2 gap-10">
        <SignatureLine label="Referring clinician" name={referral.referred_by} />
        <SignatureLine label="Received at the facility by (name, date, time)" />
      </div>

      <p className="mt-6 text-[10px] leading-relaxed text-ink-3">
        Please return the tear-off below, or telephone the clinic, so the outcome can be recorded
        against this referral. Referral {referral.referral_code}, issued by {settings?.name || 'the clinic'}.
      </p>

      <div className="mt-4 border-t-2 border-dashed border-line-strong pt-3">
        <p className="text-xs font-bold uppercase tracking-wide text-ink">Outcome slip, to be returned to {settings?.name || 'the clinic'}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-8 text-xs text-ink-2">
          <p>Referral: <span className="font-mono font-semibold">{referral.referral_code}</span></p>
          <p>Patient: <span className="font-semibold">{referral.patient_name}</span></p>
          <p className="mt-2">Seen on: ________________</p>
          <p className="mt-2">Outcome: ☐ Seen and returned ☐ Admitted ☐ Transferred ☐ Other</p>
          <p className="col-span-2 mt-2">Notes: ____________________________________________________________</p>
        </div>
      </div>
    </PrintFrame>
  );
}

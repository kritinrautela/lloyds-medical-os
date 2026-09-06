import React from 'react';
import { PrintFrame, FacilityHeader, Row, SignatureLine, longDate } from './PrintFrame';

/*
 * The certificate a worker hands to their supervisor. It says only what the
 * clinician recorded at the visit: the fitness decision, any restriction, and
 * the date it runs to. It carries no diagnosis, because the supervisor does not
 * need one and the worker's condition is theirs to share.
 */
export default function PrintableFitnessCertificate({ visit, patient, settings, onClose }) {
  if (!visit || !patient) return null;
  const status = visit.fitness_status || 'Not assessed';
  const tone = status === 'Fit for full duty' ? 'border-[#059669] text-[#047857]'
    : status === 'Fit with restrictions' ? 'border-[#d97706] text-[#b45309]'
      : status === 'Unfit for work' ? 'border-[#dc2626] text-[#b91c1c]' : 'border-[#94a3b8] text-[#475569]';

  return (
    <PrintFrame title="Fitness for work certificate" subtitle={visit.visit_code} onClose={onClose} printLabel="Print the certificate">
      <FacilityHeader settings={settings} documentTitle="Fitness for work" reference={visit.visit_code} />

      <div className="mt-6 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Certificate of fitness for work</p>
          <p className="mt-1 text-sm text-[#334155]">Issued after a consultation on {longDate(visit.visit_date)}.</p>
        </div>
        <p className={`shrink-0 rounded border-2 px-3 py-1.5 text-sm font-bold uppercase tracking-wide ${tone}`}>{status}</p>
      </div>

      <dl className="mt-5">
        <Row label="Name">{patient.full_name}</Row>
        <Row label="Hospital number"><span className="font-mono">{patient.hospital_number || patient.patient_code}</span></Row>
        <Row label="Age and sex">{[patient.age ? `${patient.age} years` : null, patient.gender].filter(Boolean).join(', ')}</Row>
        <Row label="Seen on">{longDate(visit.visit_date)}</Row>
        <Row label="Seen by">{visit.doctor_name}</Row>
        <Row label="Decision"><span className="font-semibold">{status}</span></Row>
        <Row label="Restrictions"><span className="whitespace-pre-wrap">{visit.fitness_restrictions}</span></Row>
        <Row label="Applies until">{visit.fitness_until ? longDate(visit.fitness_until) : 'Not set'}</Row>
        <Row label="Return to clinic">{visit.follow_up_date ? longDate(visit.follow_up_date) : 'Not set'}</Row>
      </dl>

      <p className="mt-5 text-xs leading-relaxed text-[#475569]">
        This certificate states the clinician's assessment of the worker's fitness for their duties on the
        date shown. It does not describe the medical condition. The worker should be reviewed before the
        end date if their condition changes, and on the end date if a restriction is to continue.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-10">
        <SignatureLine label="Clinician" name={visit.doctor_name} />
        <SignatureLine label="Worker's signature" name={patient.full_name} />
      </div>
      <p className="mt-6 text-[10px] text-[#64748b]">
        Printed {new Date().toLocaleString('en-GB')} from {settings?.name || 'the clinic'} records.
      </p>
    </PrintFrame>
  );
}

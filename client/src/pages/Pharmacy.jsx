import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Package, Plus, Search, Trash2, X } from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  EmptyState, Metric, MetricStrip, Panel, PanelHead, Pill, SectionTitle, Value
} from '../components/ui';

/*
 * The medicine store.
 *
 * Expiry is treated as a first-class clinical fact rather than a column: an
 * expired medicine is shown as unusable, and stock that will expire before it
 * can plausibly be used is flagged early enough to do something about it, which
 * in a remote clinic means months, not days.
 *
 * Every change to stock is attributed and requires a reason. That applies to
 * everyone, including administrators.
 */

const EXPIRY_WARN_DAYS = 90;

const DOSAGE_FORMS = [
  'Tablet', 'Capsule', 'Syrup', 'Injection', 'Inhaler', 'IV Fluid', 'Sachet', 'Ointment', 'Drops'
];

const RECEIVE_REASONS = [
  'Delivery received',
  'Returned unused to store',
  'Stock count correction (found)'
];

const REMOVE_REASONS = [
  'Damaged',
  'Expired and destroyed',
  'Lost or missing',
  'Transferred to another facility',
  'Stock count correction (short)'
];

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const exp = new Date(dateStr);
  if (Number.isNaN(exp.getTime())) return null;
  return Math.round((exp - new Date()) / 86400000);
}

function stockState(drug) {
  const days = daysUntil(drug.expiry_date);
  if (days !== null && days < 0) return { tone: 'critical', label: 'Expired' };
  if (drug.stock_quantity <= 0) return { tone: 'critical', label: 'Out of stock' };
  if (days !== null && days <= EXPIRY_WARN_DAYS) return { tone: 'warn', label: `Expires in ${days} days` };
  const floor = drug.min_stock_alert ?? drug.reorder_level;
  if (floor != null && drug.stock_quantity <= floor) return { tone: 'warn', label: 'Low stock' };
  return { tone: 'ok', label: 'In stock' };
}

const EMPTY_DRUG = {
  name: '', generic_name: '', category: '', dosage_form: 'Tablet', strength: '',
  unit_price: '', cost_price: '', stock_quantity: '', min_stock_alert: 25,
  batch_number: '', expiry_date: '', supplier: '', storage_condition: 'Room temperature'
};

export default function Pharmacy({ settings, refreshStats }) {
  const { currentUser } = useAuth();
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [error, setError] = useState('');

  const currency = settings?.currency_symbol || 'K';
  const isAdmin = currentUser?.role === 'Administrator';

  const load = useCallback(async () => {
    try {
      const res = await api.getDrugs();
      setDrugs(res.drugs || []);
    } catch (err) {
      setError(err.message || 'The formulary could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = useMemo(() => {
    let out = 0, low = 0, expiring = 0, expired = 0, value = 0;
    drugs.forEach((d) => {
      const s = stockState(d);
      if (s.label === 'Expired') expired += 1;
      else if (d.stock_quantity <= 0) out += 1;
      else if (s.tone === 'warn' && s.label === 'Low stock') low += 1;
      else if (s.tone === 'warn') expiring += 1;
      value += (d.stock_quantity || 0) * (d.cost_price || d.unit_price || 0);
    });
    return { out, low, expiring, expired, value };
  }, [drugs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drugs.filter((d) => {
      if (q && !`${d.name} ${d.generic_name || ''} ${d.batch_number || ''} ${d.category || ''}`.toLowerCase().includes(q)) {
        return false;
      }
      const s = stockState(d);
      if (filter === 'low') return s.tone === 'warn' && s.label === 'Low stock';
      if (filter === 'expiring') return s.tone === 'warn' && s.label !== 'Low stock';
      if (filter === 'out') return s.label === 'Out of stock' || s.label === 'Expired';
      return true;
    });
  }, [drugs, query, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle note={`${drugs.length} medicines in the formulary`}>Medicine store</SectionTitle>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          Add a medicine
        </button>
      </div>

      <MetricStrip columns={5}>
        <Metric label="Out of stock" value={summary.out} context="Cannot be dispensed"
          tone={summary.out > 0 ? 'critical' : 'neutral'} tint="1" icon={Package}
          onClick={() => setFilter('out')} />
        <Metric label="Expired" value={summary.expired} context="Remove from the shelf"
          tone={summary.expired > 0 ? 'critical' : 'neutral'} tint="2" icon={AlertTriangle}
          onClick={() => setFilter('out')} />
        <Metric label="Low stock" value={summary.low} context="At or below the reorder level"
          tone={summary.low > 0 ? 'warn' : 'neutral'} tint="3" onClick={() => setFilter('low')} />
        <Metric label="Expiring soon" value={summary.expiring} context={`Within ${EXPIRY_WARN_DAYS} days`}
          tone={summary.expiring > 0 ? 'warn' : 'neutral'} tint="4" onClick={() => setFilter('expiring')} />
        <Metric label="Stock value" value={`${currency} ${summary.value.toFixed(0)}`}
          context="At recorded cost price" tint="5" />
      </MetricStrip>

      <Panel>
        <PanelHead title="Formulary" note={`${shown.length} shown`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" aria-hidden="true" />
              <input
                className="field h-7 w-52 pl-8 text-xs"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, generic or batch"
                aria-label="Search the formulary"
              />
            </div>
            <select className="field h-7 w-auto text-xs" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter">
              <option value="all">Everything</option>
              <option value="low">Low stock</option>
              <option value="expiring">Expiring soon</option>
              <option value="out">Out of stock or expired</option>
            </select>
          </div>
        </PanelHead>

        {error ? (
          <p className="border-b border-critical-line bg-critical-wash px-4 py-2 text-xs text-critical">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-12 text-sm text-ink-3">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Reading the store
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            title={query || filter !== 'all' ? 'Nothing matches' : 'The formulary is empty'}
            detail={query || filter !== 'all'
              ? 'Clear the search or filter to see everything in the store.'
              : 'Add the medicines this clinic keeps so stock can be tracked as they are dispensed.'}
            action={<button type="button" className="btn btn-sm btn-primary" onClick={() => setAddOpen(true)}>Add a medicine</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Batch</th>
                  <th>Expires</th>
                  <th className="num">In stock</th>
                  <th className="num">Price</th>
                  <th>State</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => {
                  const s = stockState(d);
                  const days = daysUntil(d.expiry_date);
                  return (
                    <tr key={d.id}>
                      <td>
                        <span className="block font-medium text-ink">
                          {d.name} {d.strength ? <span className="font-normal text-ink-3">{d.strength}</span> : null}
                        </span>
                        <span className="block text-2xs text-ink-3">
                          <Value>{d.generic_name}</Value>
                          {d.dosage_form ? ` · ${d.dosage_form}` : ''}
                          {d.category ? ` · ${d.category}` : ''}
                        </span>
                      </td>
                      <td className="font-mono text-2xs"><Value>{d.batch_number}</Value></td>
                      <td>
                        <span className={days !== null && days < 0 ? 'text-critical' : days !== null && days <= EXPIRY_WARN_DAYS ? 'text-warn' : ''}>
                          <Value>{d.expiry_date}</Value>
                        </span>
                      </td>
                      <td className="num font-semibold">{d.stock_quantity}</td>
                      <td className="num">{currency} {(d.unit_price ?? 0).toFixed(2)}</td>
                      <td><Pill tone={s.tone}>{s.label}</Pill></td>
                      <td className="num">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" className="btn btn-sm" onClick={() => setAdjusting(d)}>
                            Change stock
                          </button>
                          {isAdmin ? (
                            <button
                              type="button"
                              aria-label={`Remove ${d.name} from the formulary`}
                              className="rounded p-1.5 text-ink-3 transition-colors hover:bg-critical-wash hover:text-critical"
                              onClick={() => setAdjusting({ ...d, removing: true })}
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {addOpen ? (
        <AddDrugModal
          currency={currency}
          onClose={() => setAddOpen(false)}
          onSaved={async () => { setAddOpen(false); await load(); refreshStats?.(); }}
        />
      ) : null}

      {adjusting ? (
        <StockModal
          drug={adjusting}
          currentUser={currentUser}
          onClose={() => setAdjusting(null)}
          onSaved={async () => { setAdjusting(null); await load(); refreshStats?.(); }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StockModal({ drug, currentUser, onClose, onSaved }) {
  const removing = !!drug.removing;
  const [direction, setDirection] = useState('in');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reasons = direction === 'in' ? RECEIVE_REASONS : REMOVE_REASONS;
  const units = parseInt(amount, 10) || 0;
  const after = removing ? 0 : Math.max(0, drug.stock_quantity + (direction === 'in' ? units : -units));

  const submit = async () => {
    setError('');
    if (removing) {
      setBusy(true);
      try {
        await api.deleteDrug(drug.id, currentUser?.full_name || '');
        onSaved();
      } catch (err) {
        setError(err.message || 'The medicine could not be removed.');
        setBusy(false);
      }
      return;
    }

    if (units < 1) { setError('Enter how many units are moving.'); return; }
    if (!reason) { setError('Choose a reason. Every stock change is recorded with one.'); return; }

    setBusy(true);
    try {
      await api.adjustDrugStock(drug.id, {
        change_amount: direction === 'in' ? units : -units,
        reason,
        adjusted_by: currentUser?.full_name || ''
      });
      onSaved();
    } catch (err) {
      setError(err.message || 'The stock change could not be recorded.');
      setBusy(false);
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label={removing ? 'Remove medicine' : 'Change stock'}>
      <div className="panel w-full max-w-md shadow-overlay">
        <div className="flex items-start justify-between gap-4 border-b border-line-soft px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {removing ? 'Remove from the formulary' : 'Change stock'}
            </h2>
            <p className="mt-0.5 text-2xs text-ink-3">
              {drug.name} · {drug.stock_quantity} units on the shelf
            </p>
          </div>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          {removing ? (
            <p className="rounded-md border border-critical-line bg-critical-wash px-3 py-2.5 text-xs text-critical">
              This takes {drug.name} out of the formulary entirely. Past dispensing records keep their
              own copy of the name and price, so history is not lost. If the medicine is simply
              finished, change the stock to zero instead.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'in', label: 'Coming in' },
                  { key: 'out', label: 'Going out' }
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    aria-pressed={direction === opt.key}
                    onClick={() => { setDirection(opt.key); setReason(''); }}
                    className={`rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
                      direction === opt.key
                        ? 'border-brand bg-brand-wash text-brand'
                        : 'border-line bg-surface text-ink-2 hover:border-line-strong'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="label" htmlFor="units">How many units</label>
                <input
                  id="units"
                  className="field font-mono"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                {units > 0 ? (
                  <p className="mt-1 text-2xs text-ink-3">
                    {drug.stock_quantity} becomes <span className="font-semibold text-ink">{after}</span>.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="label" htmlFor="reason">Reason</label>
                <select id="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">Choose a reason</option>
                  {reasons.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </>
          )}

          {error ? (
            <p className="rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">{error}</p>
          ) : null}

          <p className="text-2xs text-ink-3">
            Recorded against {currentUser?.full_name || 'the signed-in user'} and shown on the shift
            report.
          </p>

          <div className="flex justify-end gap-2 border-t border-line-soft pt-3">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? 'Recording' : removing ? 'Remove it' : 'Record the change'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function AddDrugModal({ currency, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_DRUG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('The medicine needs a name.'); return; }
    setBusy(true);
    try {
      await api.createDrug(form);
      onSaved();
    } catch (err) {
      setError(err.message || 'The medicine could not be added.');
      setBusy(false);
    }
  };

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="Add a medicine">
      <form onSubmit={submit} className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto shadow-overlay">
        <div className="sticky top-0 flex items-center justify-between border-b border-line-soft bg-surface px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">Add a medicine to the formulary</h2>
          <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Close">
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="d-name">Name as it appears on the box *</label>
            <input id="d-name" className="field" value={form.name} onChange={set('name')} required maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="d-generic">Generic name</label>
            <input id="d-generic" className="field" value={form.generic_name} onChange={set('generic_name')} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="d-cat">Category</label>
            <input id="d-cat" className="field" value={form.category} onChange={set('category')}
              placeholder="e.g. Antimalarial, Antibiotic" maxLength={80} />
          </div>
          <div>
            <label className="label" htmlFor="d-form">Form</label>
            <select id="d-form" className="field" value={form.dosage_form} onChange={set('dosage_form')}>
              {DOSAGE_FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="d-strength">Strength</label>
            <input id="d-strength" className="field" value={form.strength} onChange={set('strength')} placeholder="e.g. 500 mg" maxLength={40} />
          </div>
          <div>
            <label className="label" htmlFor="d-price">Price to the patient ({currency})</label>
            <input id="d-price" className="field font-mono" type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} />
          </div>
          <div>
            <label className="label" htmlFor="d-cost">Cost to the clinic ({currency})</label>
            <input id="d-cost" className="field font-mono" type="number" min="0" step="0.01" value={form.cost_price} onChange={set('cost_price')} />
          </div>
          <div>
            <label className="label" htmlFor="d-stock">Units on the shelf now</label>
            <input id="d-stock" className="field font-mono" type="number" min="0" value={form.stock_quantity} onChange={set('stock_quantity')} />
          </div>
          <div>
            <label className="label" htmlFor="d-min">Warn me below</label>
            <input id="d-min" className="field font-mono" type="number" min="0" value={form.min_stock_alert} onChange={set('min_stock_alert')} />
          </div>
          <div>
            <label className="label" htmlFor="d-batch">Batch number</label>
            <input id="d-batch" className="field font-mono" value={form.batch_number} onChange={set('batch_number')} maxLength={60} />
          </div>
          <div>
            <label className="label" htmlFor="d-exp">Expiry date</label>
            <input id="d-exp" className="field" type="date" value={form.expiry_date} onChange={set('expiry_date')} />
          </div>
          <div>
            <label className="label" htmlFor="d-sup">Supplier</label>
            <input id="d-sup" className="field" value={form.supplier} onChange={set('supplier')} maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="d-store">How it is stored</label>
            <input id="d-store" className="field" value={form.storage_condition} onChange={set('storage_condition')} maxLength={80} />
          </div>

          {error ? (
            <p className="sm:col-span-2 rounded border border-critical-line bg-critical-wash px-3 py-2 text-xs text-critical">{error}</p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-line-soft px-4 py-3">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Adding' : 'Add it'}
          </button>
        </div>
      </form>
    </div>
  );
}

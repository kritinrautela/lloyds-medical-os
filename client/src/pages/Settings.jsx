import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, 
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Stethoscope, 
  DollarSign, 
  Lock, 
  CheckCircle2, 
  Save,
  Trash2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';
import { api } from '../services/api';

export default function Settings({ settings, onUpdateSettings }) {
  const [formData, setFormData] = useState({
    name: '',
    tagline: '',
    logo_url: '',
    address: '',
    province: 'Morobe Province',
    district: 'Lae Urban',
    country: 'Papua New Guinea',
    phone: '',
    email: '',
    reg_number: '',
    doctor_in_charge: '',
    currency_symbol: 'K',
    currency_code: 'PGK',
    receipt_footer: '',
    export_password: 'png_health_2026'
  });
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (settings) {
      setFormData({
        name: settings.name || '',
        tagline: settings.tagline || '',
        logo_url: settings.logo_url || '',
        address: settings.address || '',
        province: settings.province || 'Morobe Province',
        district: settings.district || 'Lae Urban',
        country: settings.country || 'Papua New Guinea',
        phone: settings.phone || '',
        email: settings.email || '',
        reg_number: settings.reg_number || '',
        doctor_in_charge: settings.doctor_in_charge || '',
        currency_symbol: settings.currency_symbol || 'K',
        currency_code: settings.currency_code || 'PGK',
        receipt_footer: settings.receipt_footer || '',
        export_password: settings.export_password || 'png_health_2026'
      });
    }
  }, [settings]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await api.updateSettings(formData);
      onUpdateSettings(res.settings);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  const handleResetRecords = async () => {
    if (!window.confirm("Are you sure you want to clear all sample/demo clinical records? This will reset all patient visits, prescriptions, and queue entries to a 100% clean blank state. (Your staff logins and pharmacy medicines will remain safe).")) {
      return;
    }

    try {
      setIsResetting(true);
      const res = await api.resetRecords();
      setResetMessage(res.message || 'Records cleared successfully.');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      alert('Failed to reset records: ' + err.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-cyan-600" />
            <span>Hospital Profile & Clinic Configuration</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Customize clinic identification, official receipt headers, and default export credentials.
          </p>
        </div>

        {isSaved && (
          <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved!</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hospital Branding & Identity */}
        <div className="bg-white p-6 rounded-3xl space-y-4 border border-slate-200/90 shadow-sm">
          <h3 className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-cyan-600" />
            <span>Hospital Identification & Header</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Hospital / Clinic Official Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-semibold text-sm transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Tagline / Mission</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Doctor In Charge</label>
              <input
                type="text"
                value={formData.doctor_in_charge}
                onChange={(e) => setFormData({ ...formData, doctor_in_charge: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">PNG NDOH Registration / License #</label>
              <input
                type="text"
                value={formData.reg_number}
                onChange={(e) => setFormData({ ...formData, reg_number: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono transition-all"
              />
            </div>
          </div>
        </div>

        {/* Geographic Location */}
        <div className="bg-white p-6 rounded-3xl space-y-4 border border-slate-200/90 shadow-sm">
          <h3 className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
            <MapPin className="w-4 h-4 text-cyan-600" />
            <span>Clinic Location & Contacts</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Street Address or Settlement Details</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Province</label>
              <input
                type="text"
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">District</label>
              <input
                type="text"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Numbers</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono transition-all"
              />
            </div>
          </div>
        </div>

        {/* Currency & Financial Formatting */}
        <div className="bg-white p-6 rounded-3xl space-y-4 border border-slate-200/90 shadow-sm">
          <h3 className="text-xs font-bold text-cyan-800 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-100">
            <DollarSign className="w-4 h-4 text-cyan-600" />
            <span>Currency & Receipt Formatting</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={formData.currency_symbol}
                onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono font-bold transition-all"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Currency Code (ISO)</label>
              <input
                type="text"
                value={formData.currency_code}
                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Receipt Footer Message</label>
              <input
                type="text"
                value={formData.receipt_footer}
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Default Password for Protected Excel Export</label>
              <input
                type="text"
                value={formData.export_password}
                onChange={(e) => setFormData({ ...formData, export_password: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono transition-all"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving Settings...' : 'Save Hospital Configuration'}</span>
          </button>
        </div>
      </form>

      {/* Clean Hospital State / Purge Demo Records Panel */}
      <div className="bg-white p-6 rounded-3xl border border-rose-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Purge Demo Data & Start Clean</h3>
              <p className="text-xs text-slate-500">
                Clear all sample patients, visits, queue records, and test dispensations so new staff logins operate with a 100% clean production hospital state.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleResetRecords}
            disabled={isResetting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer disabled:opacity-50"
          >
            {isResetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            <span>{isResetting ? 'Clearing...' : 'Clear Demo Records'}</span>
          </button>
        </div>
        {resetMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{resetMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

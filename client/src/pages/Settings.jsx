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
  Save
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

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-cyan-400" />
            <span>Hospital Profile & Clinic Configuration</span>
          </h2>
          <p className="text-xs text-slate-400">
            Customize clinic identification, official receipt headers, and default export credentials.
          </p>
        </div>

        {isSaved && (
          <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 className="w-4 h-4" />
            <span>Settings Saved!</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Hospital Branding & Identity */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 border border-slate-800">
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
            <Building2 className="w-4 h-4" />
            <span>Hospital Identification & Header</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Hospital / Clinic Official Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-semibold text-sm"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Tagline / Mission</label>
              <input
                type="text"
                value={formData.tagline}
                onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Doctor in Charge *</label>
              <input
                type="text"
                required
                value={formData.doctor_in_charge}
                onChange={(e) => setFormData({ ...formData, doctor_in_charge: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Health Department Registration / License #</label>
              <input
                type="text"
                value={formData.reg_number}
                onChange={(e) => setFormData({ ...formData, reg_number: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Location & Contact Info */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 border border-slate-800">
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
            <MapPin className="w-4 h-4" />
            <span>Location & Contact Details (Papua New Guinea)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Province</label>
              <input
                type="text"
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">District / Sub-district</label>
              <input
                type="text"
                value={formData.district}
                onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Country</label>
              <input
                type="text"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-300 mb-1">Physical Address / Facility Location</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Phone Contact</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Currency & Financial Formatting */}
        <div className="glass-panel p-6 rounded-3xl space-y-4 border border-slate-800">
          <h3 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-800">
            <DollarSign className="w-4 h-4" />
            <span>Currency & Receipt Formatting</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Currency Symbol</label>
              <input
                type="text"
                value={formData.currency_symbol}
                onChange={(e) => setFormData({ ...formData, currency_symbol: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Currency Code (ISO)</label>
              <input
                type="text"
                value={formData.currency_code}
                onChange={(e) => setFormData({ ...formData, currency_code: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Receipt Footer Message</label>
              <input
                type="text"
                value={formData.receipt_footer}
                onChange={(e) => setFormData({ ...formData, receipt_footer: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-300 mb-1">Default Password for Protected Excel Export</label>
              <input
                type="text"
                value={formData.export_password}
                onChange={(e) => setFormData({ ...formData, export_password: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 hover:scale-[1.02] active:scale-95 transition-all"
          >
            <Save className="w-4 h-4" />
            <span>{loading ? 'Saving Settings...' : 'Save Hospital Configuration'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Pill, 
  Search, 
  Plus, 
  AlertTriangle, 
  Calendar, 
  Package, 
  TrendingDown, 
  RefreshCw, 
  X,
  CheckCircle2,
  Trash2,
  Edit2
} from 'lucide-react';
import { api } from '../services/api';

export default function Pharmacy({ settings, refreshStats }) {
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [expiringOnly, setExpiringOnly] = useState(false);
  
  // Modals
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [stockAdjustDrug, setStockAdjustDrug] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('New Shipment Received');

  // New Drug Form
  const [formData, setFormData] = useState({
    name: '',
    generic_name: '',
    category: 'Antimalarial (1st Line PNG)',
    dosage_form: 'Tablet',
    strength: '',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    min_stock_alert: 25,
    batch_number: '',
    expiry_date: '',
    supplier: 'PNG Central Medical Store',
    storage_condition: 'Room Temperature'
  });

  const currency = settings?.currency_symbol || 'K';

  const fetchDrugs = async () => {
    try {
      setLoading(true);
      const res = await api.getDrugs({
        q: searchQuery,
        category: categoryFilter,
        low_stock: lowStockOnly ? 'true' : undefined,
        expiring_soon: expiringOnly ? 'true' : undefined
      });
      setDrugs(res.drugs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrugs();
  }, [searchQuery, categoryFilter, lowStockOnly, expiringOnly]);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createDrug(formData);
      setIsAddOpen(false);
      setFormData({
        name: '',
        generic_name: '',
        category: 'Antimalarial (1st Line PNG)',
        dosage_form: 'Tablet',
        strength: '',
        unit_price: '',
        cost_price: '',
        stock_quantity: '',
        min_stock_alert: 25,
        batch_number: '',
        expiry_date: '',
        supplier: 'PNG Central Medical Store',
        storage_condition: 'Room Temperature'
      });
      fetchDrugs();
      if (refreshStats) refreshStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAdjustSubmit = async (e) => {
    e.preventDefault();
    const delta = parseInt(adjustAmount, 10);
    if (isNaN(delta) || delta === 0) {
      alert('Please enter a valid non-zero adjustment');
      return;
    }
    try {
      await api.adjustDrugStock(stockAdjustDrug.id, {
        change_amount: delta,
        reason: adjustReason
      });
      setStockAdjustDrug(null);
      setAdjustAmount('');
      fetchDrugs();
      if (refreshStats) refreshStats();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Remove ${name} from pharmacy formulary?`)) {
      try {
        await api.deleteDrug(id);
        fetchDrugs();
        if (refreshStats) refreshStats();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const isNearExpiry = (dateStr) => {
    if (!dateStr) return false;
    const exp = new Date(dateStr);
    const now = new Date();
    const diffDays = (exp - now) / (1000 * 60 * 60 * 24);
    return diffDays <= 90;
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Pill className="w-5 h-5 text-cyan-400" />
            <span>Pharmacy Formulary & Medicine Stock</span>
          </h2>
          <p className="text-xs text-slate-400">
            Monitor real-time inventory, batch expiry countdowns, and restock shipments without internet.
          </p>
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/15 hover:scale-[1.02] active:scale-95 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Add New Medication</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Brand, Generic Name, Batch, or Code..."
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Drug Categories</option>
            <option value="Antimalarial (1st Line PNG)">Antimalarial (1st Line)</option>
            <option value="Antibiotic">Antibiotics</option>
            <option value="Analgesic / Antipyretic">Analgesic / Antipyretic</option>
            <option value="Electrolyte / Diarrhea">Electrolytes / Diarrhea</option>
            <option value="Respiratory / Bronchodilator">Respiratory / Inhaler</option>
            <option value="Antidiabetic">Antidiabetic</option>
            <option value="IV Fluid / Resuscitation">IV Fluids</option>
            <option value="Emergency Antivenom">Antivenom (Snakebite)</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLowStockOnly(!lowStockOnly)}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
              lowStockOnly
                ? 'bg-red-500/20 text-red-300 border-red-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            Low Stock Only
          </button>
          <button
            onClick={() => setExpiringOnly(!expiringOnly)}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-semibold border transition-all ${
              expiringOnly
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-700 hover:bg-slate-800'
            }`}
          >
            Expiring &lt;90d
          </button>
        </div>
      </div>

      {/* Drugs Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Medicine & Generic</th>
                <th className="py-3 px-4">Form / Strength</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Stock Level</th>
                <th className="py-3 px-4">Batch & Expiry</th>
                <th className="py-3 px-4 text-right">Price ({currency})</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">Loading pharmacy catalog...</td>
                </tr>
              ) : drugs.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-8 text-center text-slate-400">No medications found matching your filters.</td>
                </tr>
              ) : (
                drugs.map((d) => {
                  const isLow = d.stock_quantity <= d.min_stock_alert;
                  const isOut = d.stock_quantity === 0;
                  const nearExp = isNearExpiry(d.expiry_date);

                  return (
                    <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-cyan-400">
                        {d.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-sm">{d.name}</div>
                        <div className="text-[10px] text-slate-400 italic">{d.generic_name || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        <div>{d.dosage_form}</div>
                        <div className="text-[10px] text-cyan-400 font-mono">{d.strength || '-'}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                          {d.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-sm font-bold font-mono ${
                            isOut ? 'text-red-500' : isLow ? 'text-amber-400' : 'text-emerald-400'
                          }`}>
                            {d.stock_quantity}
                          </span>
                          <span className="text-[9px] text-slate-500">Min: {d.min_stock_alert}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div className="text-slate-300">{d.batch_number || 'No batch'}</div>
                        <div className={`text-[10px] flex items-center gap-1 ${nearExp ? 'text-amber-400 font-bold' : 'text-slate-400'}`}>
                          {nearExp && <AlertTriangle className="w-2.5 h-2.5" />}
                          <span>Exp: {d.expiry_date || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-white">
                        {currency} {d.unit_price.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setStockAdjustDrug(d)}
                            title="Adjust / Restock Quantity"
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <RefreshCw className="w-3 h-3" />
                            <span>Restock</span>
                          </button>
                          <button
                            onClick={() => handleDelete(d.id, d.name)}
                            title="Remove Drug"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Medication Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-[#0F2744] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden my-8 animate-scaleIn">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/80 bg-slate-900/70">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                <span>Add Medication to PNG Formulary</span>
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Medication Brand / Trade Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Coartem (Artemether + Lumefantrine)"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Generic / Chemical Name</label>
                  <input
                    type="text"
                    value={formData.generic_name}
                    onChange={(e) => setFormData({ ...formData, generic_name: e.target.value })}
                    placeholder="e.g. Artemether 20mg / Lumefantrine 120mg"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Dosage Form *</label>
                  <select
                    value={formData.dosage_form}
                    onChange={(e) => setFormData({ ...formData, dosage_form: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup / Suspension</option>
                    <option value="Injection">Injection / Vial</option>
                    <option value="Inhaler">Inhaler</option>
                    <option value="IV Fluid">IV Fluid (Bottle/Bag)</option>
                    <option value="Sachet">Sachet (Powder/ORS)</option>
                    <option value="Ointment">Topical Ointment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Therapeutic Category *</label>
                  <input
                    type="text"
                    required
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="e.g. Antimalarial / Antibiotic / Analgesic"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Strength / Concentration</label>
                  <input
                    type="text"
                    value={formData.strength}
                    onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
                    placeholder="e.g. 500mg, 100mcg/dose, 20/120mg"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Selling Price ({currency}) *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    placeholder="e.g. 15.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Initial Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                    placeholder="e.g. 200"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Low Stock Alert Threshold</label>
                  <input
                    type="number"
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Batch / Lot Number</label>
                  <input
                    type="text"
                    value={formData.batch_number}
                    onChange={(e) => setFormData({ ...formData, batch_number: e.target.value })}
                    placeholder="e.g. BCH-CRT-992"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formData.expiry_date}
                    onChange={(e) => setFormData({ ...formData, expiry_date: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Supplier / Depot Name</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="e.g. PNG Central Medical Supplies / UNICEF"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-700 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold text-xs"
                >
                  Save to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {stockAdjustDrug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm bg-[#0F2744] border border-slate-700 rounded-3xl shadow-2xl overflow-hidden p-6 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700">
              <div>
                <span className="text-[10px] text-cyan-400 uppercase font-mono tracking-wider">Restock / Adjust</span>
                <h3 className="text-sm font-bold text-white truncate max-w-[220px]">{stockAdjustDrug.name}</h3>
              </div>
              <button onClick={() => setStockAdjustDrug(null)} className="p-1 rounded-lg text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="mt-4 space-y-3">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs flex justify-between">
                <span className="text-slate-400">Current Stock in Hand:</span>
                <strong className="text-cyan-400 font-mono">{stockAdjustDrug.stock_quantity} units</strong>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Change Amount (Positive to add, Negative to write-off)
                </label>
                <input
                  type="number"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. +50 or -5"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Monthly shipment received"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setStockAdjustDrug(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                >
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  ShoppingCart, 
  Search, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  Printer, 
  User, 
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight
} from 'lucide-react';
import { api } from '../services/api';
import ReceiptModal from '../components/ReceiptModal';

export default function DispensePOS({ settings, preSelectedPatient, refreshStats }) {
  const [patients, setPatients] = useState([]);
  const [drugs, setDrugs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Dispensing State
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [manualPatientName, setManualPatientName] = useState('');
  const [visitId, setVisitId] = useState(null);

  // Cart
  const [cart, setCart] = useState([]);
  const [selectedDrugId, setSelectedDrugId] = useState('');
  const [qty, setQty] = useState(1);
  const [instructions, setInstructions] = useState('');

  // Payment
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash (Kina)');
  const [notes, setNotes] = useState('');

  // Receipt Modal State
  const [completedReceiptData, setCompletedReceiptData] = useState(null);

  const currency = settings?.currency_symbol || 'K';

  useEffect(() => {
    const initData = async () => {
      try {
        setLoading(true);
        const [patientsRes, drugsRes] = await Promise.all([
          api.getPatients(),
          api.getDrugs()
        ]);
        setPatients(patientsRes.patients || []);
        setDrugs(drugsRes.drugs || []);

        if (preSelectedPatient) {
          setSelectedPatientId(preSelectedPatient.id);
          setManualPatientName(preSelectedPatient.full_name);
          if (preSelectedPatient.visit_id) {
            setVisitId(preSelectedPatient.visit_id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, [preSelectedPatient]);

  const handlePatientSelect = (p) => {
    setSelectedPatientId(p.id);
    setManualPatientName(p.full_name);
    setPatientSearch('');
  };

  const handleAddToCart = () => {
    if (!selectedDrugId) {
      alert('Please select a medication');
      return;
    }
    const drug = drugs.find(d => d.id === parseInt(selectedDrugId, 10));
    if (!drug) return;

    if (qty <= 0) {
      alert('Quantity must be at least 1');
      return;
    }

    if (drug.stock_quantity < qty) {
      alert(`Only ${drug.stock_quantity} units of ${drug.name} available in inventory!`);
      return;
    }

    // Check if already in cart
    const existingIdx = cart.findIndex(c => c.drug_id === drug.id);
    if (existingIdx >= 0) {
      const updated = [...cart];
      const newQty = updated[existingIdx].quantity + qty;
      if (newQty > drug.stock_quantity) {
        alert(`Cannot add more than ${drug.stock_quantity} available units`);
        return;
      }
      updated[existingIdx].quantity = newQty;
      updated[existingIdx].subtotal = newQty * drug.unit_price;
      if (instructions) updated[existingIdx].instructions = instructions;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          drug_id: drug.id,
          name: drug.name,
          dosage_form: drug.dosage_form,
          strength: drug.strength,
          quantity: qty,
          unit_price: drug.unit_price,
          subtotal: qty * drug.unit_price,
          instructions: instructions || 'Take as advised by medical officer'
        }
      ]);
    }

    // Reset drug input
    setSelectedDrugId('');
    setQty(1);
    setInstructions('');
  };

  const removeFromCart = (index) => {
    setCart(cart.filter((_, idx) => idx !== index));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.subtotal, 0);
  const finalTotal = Math.max(0, subtotal - parseFloat(discount || 0));

  const handleCompleteDispense = async () => {
    const finalPatientName = manualPatientName || (patients.find(p => p.id === parseInt(selectedPatientId, 10))?.full_name);
    if (!finalPatientName) {
      alert('Please select or enter a patient name');
      return;
    }
    if (cart.length === 0) {
      alert('Your dispensing cart is empty. Add at least one medicine.');
      return;
    }

    try {
      const payload = {
        patient_id: selectedPatientId ? parseInt(selectedPatientId, 10) : null,
        patient_name: finalPatientName,
        visit_id: visitId,
        items: cart.map(item => ({
          drug_id: item.drug_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          instructions: item.instructions
        })),
        discount: parseFloat(discount) || 0,
        paid_amount: finalTotal,
        payment_method: paymentMethod,
        pharmacist_notes: notes
      };

      const res = await api.dispenseMedications(payload);

      // Open printable receipt
      setCompletedReceiptData({
        invoice: res.invoice,
        items: res.items,
        hospital: res.hospital,
        patient: patients.find(p => p.id === parseInt(selectedPatientId, 10))
      });

      // Clear cart
      setCart([]);
      setDiscount(0);
      setNotes('');
      setManualPatientName('');
      setSelectedPatientId('');
      setVisitId(null);

      // Refresh stock
      const freshDrugs = await api.getDrugs();
      setDrugs(freshDrugs.drugs || []);
      if (refreshStats) refreshStats();

    } catch (err) {
      alert('Dispense failed: ' + err.message);
    }
  };

  const activeDrug = drugs.find(d => d.id === parseInt(selectedDrugId, 10));

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-cyan-600" />
          <span>Pharmacy Dispensing Counter (POS)</span>
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Select patient, prescribe formulary medications, auto-decrement stock, and produce official printed receipts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Patient & Cart Builder */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Patient Selection Card */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>1. Patient Assignment</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Select Existing Registered Patient</label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedPatientId(id);
                    const match = patients.find(p => p.id === parseInt(id, 10));
                    if (match) setManualPatientName(match.full_name);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="">-- Choose Patient from Database --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} - {p.full_name} ({p.age}y, {p.village_address || p.province})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Or Direct Outpatient Name</label>
                <input
                  type="text"
                  placeholder="Enter patient name if unregistered..."
                  value={manualPatientName}
                  onChange={(e) => setManualPatientName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {selectedPatientId && (
              <div className="p-3 rounded-xl bg-cyan-50/80 border border-cyan-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-cyan-900 font-bold">{manualPatientName}</span>
                  <span className="text-slate-600 ml-2">
                    {patients.find(p => p.id === parseInt(selectedPatientId, 10))?.allergies ? 
                      `Allergies: ${patients.find(p => p.id === parseInt(selectedPatientId, 10)).allergies}` : 'No known allergies'}
                  </span>
                </div>
                {visitId && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-700 border border-purple-200 font-mono font-bold">
                    Linked to OPD Visit #{visitId}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Medication Selector Card */}
          <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-cyan-700 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>2. Add Medication to Dispense</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Medication from Formulary *</label>
                <select
                  value={selectedDrugId}
                  onChange={(e) => setSelectedDrugId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="">-- Select Medication --</option>
                  {drugs.map((d) => (
                    <option key={d.id} value={d.id} disabled={d.stock_quantity === 0}>
                      {d.name} ({d.stock_quantity} in stock) - {currency} {d.unit_price.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  max={activeDrug ? activeDrug.stock_quantity : 999}
                  value={qty}
                  onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-mono font-bold"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
                >
                  Add to Cart
                </button>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Dosage Schedule / Patient Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. 1 tablet twice daily after meals for 3 days / 2 puffs inhaled when breathless"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>
            </div>

            {activeDrug && (
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <span className="text-slate-600">Available Batch: <strong className="text-slate-900">{activeDrug.batch_number || 'N/A'}</strong> (Exp: {activeDrug.expiry_date})</span>
                <span className="font-mono text-cyan-700 font-bold">Unit Price: {currency} {activeDrug.unit_price.toFixed(2)}</span>
              </div>
            )}
          </div>

          {/* Cart Items Table */}
          <div className="bg-white rounded-2xl overflow-hidden border border-slate-200/90 shadow-sm">
            <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Dispensation Cart ({cart.length} Item{cart.length !== 1 ? 's' : ''})
              </span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                >
                  Clear All
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600 font-bold uppercase text-[10px]">
                    <th className="py-2.5 px-4">Item & Instructions</th>
                    <th className="py-2.5 px-4 text-center">Qty</th>
                    <th className="py-2.5 px-4 text-right">Price</th>
                    <th className="py-2.5 px-4 text-right">Subtotal</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cart.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-8 text-center text-slate-400 italic">
                        No medications added to cart yet. Select a drug above.
                      </td>
                    </tr>
                  ) : (
                    cart.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                          <div className="text-[10px] text-cyan-700 font-mono font-medium">{item.instructions}</div>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                          {item.quantity}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-600">
                          {currency} {item.unit_price.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                          {currency} {item.subtotal.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => removeFromCart(idx)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right 1 Col: Billing & Checkout Summary */}
        <div className="bg-white p-6 rounded-3xl h-fit space-y-5 border border-slate-200/90 shadow-md">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-200">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Financial & Billing Breakdown</span>
          </h3>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="font-medium">Items Total:</span>
              <span className="font-mono font-semibold text-slate-900">{currency} {subtotal.toFixed(2)}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600 font-medium">Discount ({currency}):</span>
              <input
                type="number"
                min="0"
                step="0.5"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-24 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 font-mono font-semibold"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between text-base font-bold text-slate-900">
              <span>Grand Total ({settings?.currency_code || 'PGK'}):</span>
              <span className="text-xl font-mono text-emerald-600 font-bold">
                {currency} {finalTotal.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            >
              <option value="Cash (Kina)">Cash (Kina - PGK)</option>
              <option value="Card / EFTPOS">Card / EFTPOS</option>
              <option value="Government / Free Clinic Waiver">Exempt / Health Department Waiver</option>
              <option value="Employer / Company Account">Corporate / Mine Site Account</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Dispensing Officer Notes</label>
            <textarea
              rows="2"
              placeholder="e.g. Advised to return if fever persists past 3 days..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:bg-white focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
            />
          </div>

          {/* Checkout Button */}
          <button
            onClick={handleCompleteDispense}
            disabled={cart.length === 0}
            className={`w-full py-3 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all ${
              cart.length === 0
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                : 'bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white hover:scale-[1.02] active:scale-95 shadow-cyan-500/20 cursor-pointer'
            }`}
          >
            <Printer className="w-4 h-4" />
            <span>Complete & Print Medical Receipt</span>
          </button>

          <p className="text-[11px] text-slate-500 text-center leading-relaxed">
            Completing transaction will immediately update SQLite stock counts and record in the shift reconciliation ledger.
          </p>
        </div>

      </div>

      {/* Official Receipt Modal */}
      <ReceiptModal
        isOpen={!!completedReceiptData}
        onClose={() => setCompletedReceiptData(null)}
        data={completedReceiptData}
      />
    </div>
  );
}

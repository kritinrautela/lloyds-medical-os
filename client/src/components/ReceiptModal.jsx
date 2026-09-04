import React, { useState } from 'react';
import { Printer, X, CheckCircle2, FileText, Receipt, ShieldCheck } from 'lucide-react';

export default function ReceiptModal({ isOpen, onClose, data }) {
  const [printFormat, setPrintFormat] = useState('a4'); // 'a4' or 'thermal'

  if (!isOpen || !data) return null;

  const { invoice, items = [], hospital, patient } = data;
  const currency = hospital?.currency_symbol || 'K';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div 
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      className="printable-modal-overlay fixed inset-0 z-50 flex items-start justify-center p-4 pt-6 pb-12 bg-slate-950/85 backdrop-blur-md overflow-y-auto"
    >
      <div className={`printable-modal-card relative w-full ${printFormat === 'thermal' ? 'max-w-md' : 'max-w-2xl'} bg-[#091528] border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden my-4 transition-all`}>
        
        {/* Modal Top Bar (Hidden during print) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-display font-bold text-white block">Official Medical Receipt</span>
              <span className="text-[11px] text-slate-400 font-mono">Invoice #{invoice?.invoice_number}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Format Selector */}
            <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setPrintFormat('a4')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  printFormat === 'a4' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>A4 Invoice</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat('thermal')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition-all ${
                  printFormat === 'thermal' ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>80mm Slip</span>
              </button>
            </div>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-display font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className={`printable-area ${printFormat === 'thermal' ? 'p-5 max-w-[380px] mx-auto text-[11px]' : 'p-8 text-xs'} bg-white text-slate-900 font-sans leading-normal`}>
          
          {/* Header */}
          <div className="text-center pb-4 border-b-2 border-slate-900">
            <img 
              src="/lloyds_metals_logo.png" 
              alt="Lloyds Metals" 
              className={`${printFormat === 'thermal' ? 'h-6' : 'h-8'} mx-auto mb-2 object-contain`}
            />
            <h2 className={`${printFormat === 'thermal' ? 'text-xs' : 'text-sm'} font-black text-slate-950 uppercase tracking-tight`}>
              {hospital?.name || 'LLOYDS METALS & ENERGY LTD'}
            </h2>
            <p className="text-[10px] text-slate-700 font-bold">
              {hospital?.tagline || 'Occupational Health Centre & Community Hospital — Papua New Guinea'}
            </p>
            <p className="text-[9px] text-slate-500 mt-0.5">
              {hospital?.address} | {hospital?.district ? `${hospital.district}, ` : ''}{hospital?.province}
            </p>
            <p className="text-[9px] text-slate-500 font-mono">
              Tel: {hospital?.phone} | Reg: {hospital?.reg_number}
            </p>

            <div className="mt-2 inline-block px-3 py-0.5 border border-slate-800 rounded text-[9px] font-mono font-bold uppercase tracking-widest text-slate-900 bg-slate-50">
              OFFICIAL MEDICAL & PHARMACY TAX INVOICE
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 py-3 border-b border-slate-300 text-[10px]">
            <div className="space-y-0.5">
              <p><span className="text-slate-500 font-semibold">Invoice No:</span> <strong className="font-mono text-slate-950">{invoice?.invoice_number}</strong></p>
              <p><span className="text-slate-500 font-semibold">Date & Time:</span> <span className="font-mono">{new Date(invoice?.created_at || Date.now()).toLocaleString()}</span></p>
              <p><span className="text-slate-500 font-semibold">Medical Officer:</span> <span>{hospital?.doctor_in_charge || 'Duty Medical Officer'}</span></p>
            </div>
            <div className="text-right space-y-0.5">
              <p><span className="text-slate-500 font-semibold">Patient:</span> <strong className="text-slate-950">{invoice?.patient_name || patient?.full_name}</strong></p>
              <p><span className="text-slate-500 font-semibold">Patient ID:</span> <span className="font-mono text-slate-800">{patient?.patient_code || 'Outpatient'}</span></p>
              <p><span className="text-slate-500 font-semibold">Payment Mode:</span> <span>{invoice?.payment_method || 'Cash (Kina)'}</span></p>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-3">
            <table className="w-full text-left border-collapse text-[10px]">
              <thead>
                <tr className="border-b-2 border-slate-900 text-slate-700 font-bold uppercase text-[8px]">
                  <th className="py-1">Medication / Service</th>
                  <th className="py-1 text-center">Qty</th>
                  <th className="py-1 text-right">Unit ({currency})</th>
                  <th className="py-1 text-right">Amount ({currency})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-3 text-center text-slate-400 italic">No items listed on invoice.</td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1 pr-2">
                        <div className="font-bold text-slate-900">{item.drug_name}</div>
                        {item.instructions && (
                          <div className="text-[9px] text-slate-600 italic font-mono">{item.instructions}</div>
                        )}
                      </td>
                      <td className="py-1 text-center font-mono font-medium">{item.quantity}</td>
                      <td className="py-1 text-right font-mono">{parseFloat(item.unit_price).toFixed(2)}</td>
                      <td className="py-1 text-right font-bold font-mono text-slate-950">{parseFloat(item.subtotal).toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Summary / Total Breakdown */}
          <div className="pt-2 border-t-2 border-slate-900 space-y-1 text-[10px]">
            {invoice?.discount > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Concession Subsidy / Discount:</span>
                <span className="font-mono text-red-600">-{currency} {parseFloat(invoice.discount).toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-black text-slate-950 pt-1 border-t border-slate-200">
              <span className="uppercase">TOTAL PAID ({hospital?.currency_code || 'PGK'}):</span>
              <span className="font-mono">{currency} {parseFloat(invoice?.paid_amount || invoice?.total_amount || 0).toFixed(2)}</span>
            </div>
          </div>

          {/* Footer & Signature / Stamp Box */}
          <div className="mt-6 pt-3 border-t border-dashed border-slate-300 text-center avoid-break">
            <p className="text-[9px] text-slate-600 italic">
              {hospital?.receipt_footer || 'Lloyds Metals & Energy Ltd Healthcare Initiative. Tenkyu tru na lukautim gut!'}
            </p>

            <div className="grid grid-cols-2 gap-4 mt-6 px-2 text-[9px] text-slate-600">
              <div className="border border-slate-300 rounded p-2 bg-white text-center">
                <div className="h-8 border-b border-slate-300 mb-1"></div>
                <span className="font-bold uppercase text-slate-700 block">Dispensing Officer</span>
                <span className="text-[8px] text-slate-500 font-mono">Lloyds Pharmacy Post</span>
              </div>

              <div className="border border-slate-300 rounded p-2 bg-white text-center">
                <div className="h-8 border-b border-slate-300 mb-1"></div>
                <span className="font-bold uppercase text-slate-700 block">Patient / Guardian</span>
                <span className="text-[8px] text-slate-500 font-mono">Acknowledgement</span>
              </div>
            </div>

            <div className="mt-4 text-[8px] text-slate-400 font-mono">
              System Ref: LMEL-TX-{invoice?.invoice_number || '000'} • Tax Status: Company Medical Care Concession
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

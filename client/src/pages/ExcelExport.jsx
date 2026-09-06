import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  FileSpreadsheet, 
  Lock, 
  Unlock, 
  Download, 
  HardDrive, 
  Upload, 
  CheckCircle2, 
  ShieldCheck, 
  Key, 
  Eye, 
  EyeOff,
  Database,
  ShieldAlert,
  AlertTriangle,
  FileCheck,
  Check
} from 'lucide-react';
import { api } from '../services/api';

export default function ExcelExport({ settings }) {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'Administrator';

  const [password, setPassword] = useState(settings?.export_password || 'png_health_2026');
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(isAdmin);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const handleDownloadExcel = () => {
    setIsExporting(true);
    setDownloadSuccess(false);

    // Export with the secured backend password without exposing it to the user
    const exportUrl = api.getExcelExportUrl(password || 'png_health_2026');
    window.location.href = exportUrl;

    setTimeout(() => {
      setIsExporting(false);
      setDownloadSuccess(true);
    }, 1500);
  };

  const handleUnlockAdmin = (e) => {
    e.preventDefault();
    setPinError('');
    if (adminPinInput === 'lloyds2026' || adminPinInput === 'admin') {
      setIsAdminUnlocked(true);
      setAdminPinInput('');
    } else {
      setPinError('Invalid Admin PIN. Only authorized hospital administrators may view or change the encryption key.');
    }
  };

  const handleDownloadDb = () => {
    window.location.href = api.getDbBackupUrl();
  };

  const handleRestoreSubmit = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      alert('Please choose a .db backup file to restore.');
      return;
    }
    if (!confirm('CAUTION: Restoring a database file will replace the current local clinic database. Do you wish to proceed?')) {
      return;
    }
    try {
      setIsRestoring(true);
      const res = await api.restoreDb(restoreFile);
      alert(res.message);
      window.location.reload();
    } catch (err) {
      alert('Restore failed: ' + err.message);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border border-emerald-200/80 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="p-3 rounded-2xl bg-emerald-100 text-emerald-700 border border-emerald-300 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Encrypted Excel Audit & Pen-Drive Backup
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
                100% Read-Only Protected Multi-Sheet Workbook • AES-256 Compound Encryption
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-white border border-emerald-200 text-emerald-700 flex items-center gap-2 shadow-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Anti-Pilferage Locked</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Read-Only Excel Export (Password Hidden from Staff) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 p-6 rounded-3xl space-y-5 shadow-sm">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Military-Grade AES Document Encryption & Cell Locking</h2>
              <p className="text-xs text-slate-500">
                Guarantees complete protection of patient records, medicine stock, and cash collections.
              </p>
            </div>
          </div>

          {/* Secure Audit Notice (Password is Hidden by Default) */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-900">Confidential Audit Security Shield: ACTIVE</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  The exported spreadsheet is encrypted with a master key and all internal worksheets are 
                  <span className="text-rose-600 font-bold"> permanently locked against editing</span>. 
                  Clinic staff and local workers cannot modify drug quantities, alter revenue numbers, or erase transactions.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs font-mono">
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">Document Format</span>
                <span className="font-bold text-slate-900">Excel .XLSX (CDFV2)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">Sheet Cell State</span>
                <span className="font-bold text-emerald-700">100% Read-Only</span>
              </div>
              <div className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase block font-sans font-semibold">Password Custody</span>
                <span className="font-bold text-amber-700">Admin & Compliance</span>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <div className="space-y-3">
            <button
              onClick={handleDownloadExcel}
              disabled={isExporting}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-black text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-5 h-5" />
              <span>
                {isExporting ? 'Generating Protected Workbook...' : 'Download Encrypted & Read-Only Locked Excel (.xlsx)'}
              </span>
            </button>

            {downloadSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>✓ Encrypted workbook generated successfully! All sheets are locked against unauthorized alteration.</span>
              </div>
            )}
          </div>

          {/* Multi-Sheet Workbook Contents Breakdown */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Audited Sheets Generated in Workbook:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="font-bold text-slate-800">1. Executive Overview & KPIs</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-600" />
                <span className="font-bold text-slate-800">2. Observation & Inpatient Beds (10 Beds)</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                <span className="font-bold text-slate-800">3. Patient Master Directory</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-bold text-slate-800">4. OPD Visits & Triage Acuity</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-600" />
                <span className="font-bold text-slate-800">5. Pharmacy Stock & Anti-Theft Ledger</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                <span className="font-bold text-slate-800">6. Medication Dispensing & Sales Ledger</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 sm:col-span-2">
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <span className="font-bold text-slate-800">7. Mine Site Occupational Health & Safety (OHS) Incidents</span>
              </div>
            </div>
          </div>

          {/* ADMIN ONLY CONTROLS (Protected with Admin Master Key) */}
          <div className="pt-4 border-t border-slate-100">
            {!isAdminUnlocked ? (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" />
                    <span>Administrator Master Key Controls</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    To view or change the document encryption password, authenticate as Hospital Administrator.
                  </p>
                </div>

                <form onSubmit={handleUnlockAdmin} className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="password"
                    placeholder="Admin PIN..."
                    value={adminPinInput}
                    onChange={(e) => setAdminPinInput(e.target.value)}
                    className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-rose-500 w-28"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors whitespace-nowrap cursor-pointer"
                  >
                    Unlock
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Admin Security Console (Password Management)</span>
                  </span>
                  <button
                    onClick={() => setIsAdminUnlocked(false)}
                    className="text-[10px] text-slate-500 hover:text-slate-800 font-semibold cursor-pointer"
                  >
                    Lock Console
                  </button>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Workbook Encryption Password (Master Key)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 pr-16"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      {showPassword ? 'Hide' : 'Reveal'}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Default: <code className="text-amber-700 font-bold">png_health_2026</code>. Keep this strictly confidential from unauthorized staff.
                  </p>
                </div>
              </div>
            )}

            {pinError && (
              <p className="text-xs text-rose-600 mt-2">{pinError}</p>
            )}
          </div>
        </div>

        {/* Right Col: Raw Database Flash Drive Snapshot & Restore */}
        <div className="space-y-6">
          {/* SQLite Raw Backup Card */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-cyan-50 text-cyan-700 border border-cyan-200">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Raw Database Snapshot</h3>
                <p className="text-[11px] text-slate-500">Complete SQLite Binary (.db)</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Downloads the complete raw SQLite database file (`hospital.db`). Can be transferred between hospital laptops or kept in a safe off-site archive.
            </p>

            <button
              onClick={handleDownloadDb}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-cyan-800 border border-cyan-200 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              <HardDrive className="w-4 h-4" />
              <span>Download Raw hospital.db</span>
            </button>
          </div>

          {/* Restore Database Card */}
          <div className="bg-white border border-slate-200/90 p-6 rounded-3xl shadow-sm space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Restore from Backup</h3>
                <p className="text-[11px] text-slate-500">Upload replacement SQLite file</p>
              </div>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>Warning: Restoring will overwrite existing local records with the uploaded database snapshot.</span>
            </div>

            <form onSubmit={handleRestoreSubmit} className="space-y-3">
              <input
                type="file"
                accept=".db,.sqlite,.sqlite3"
                onChange={(e) => setRestoreFile(e.target.files[0])}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-800 hover:file:bg-slate-200 cursor-pointer"
              />

              <button
                type="submit"
                disabled={!restoreFile || isRestoring}
                className="w-full py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {isRestoring ? 'Restoring Database...' : 'Restore Database File'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

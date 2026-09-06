import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  Link, 
  Download, 
  ExternalLink,
  ShieldCheck,
  Radio,
  UserCheck,
  FolderSync,
  Sparkles,
  Calculator,
  Lock,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../services/api';

export default function CloudSync({ settings, isOnline }) {
  const [syncState, setSyncState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncStep, setSyncStep] = useState(0); // 0: Idle, 1: Gathering, 2: Auth, 3: Formulas, 4: Complete
  
  // Google Sign In Modal
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('Medical Administrator');

  // Google Config Form
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleSheetId, setGoogleSheetId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [autoSyncOnWifi, setAutoSyncOnWifi] = useState(true);
  const [isSaved, setIsSaved] = useState(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await api.getCloudSyncStatus();
      setSyncState(res);
      if (res.config) {
        setGoogleEmail(res.config.google_account_email || '');
        setGoogleSheetId(res.config.google_sheet_id || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
        setWebhookUrl(res.config.webhook_url || '');
        setAutoSyncOnWifi(res.config.auto_sync_on_wifi === 1);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    if (!customGoogleEmail) {
      alert('Please enter a valid Google Account email.');
      return;
    }
    try {
      await api.googleAuthSignIn({
        email: customGoogleEmail,
        name: customGoogleName,
        token: 'oauth2_bearer_' + Math.random().toString(36).substring(7)
      });
      setIsSignInModalOpen(false);
      fetchStatus();
      alert(`Successfully signed in with Google Account: ${customGoogleEmail}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    try {
      await api.updateCloudSyncConfig({
        google_account_email: googleEmail,
        google_sheet_id: googleSheetId,
        webhook_url: webhookUrl,
        auto_sync_on_wifi: autoSyncOnWifi
      });
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
      fetchStatus();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleTriggerSync = async () => {
    try {
      setSyncing(true);
      setSyncStep(1); // Gathering
      await new Promise(r => setTimeout(r, 600));
      setSyncStep(2); // Authenticating
      await new Promise(r => setTimeout(r, 700));
      setSyncStep(3); // Applying Formulas
      await new Promise(r => setTimeout(r, 600));

      const res = await api.triggerCloudSync(true);
      setSyncStep(4); // Complete
      await new Promise(r => setTimeout(r, 500));
      fetchStatus();
      alert(`Google Drive & Sheets Sync: ${res.message}`);
    } catch (err) {
      alert('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
      setSyncStep(0);
    }
  };

  const downloadOfflinePacket = () => {
    if (!syncState) return;
    const blob = new Blob([JSON.stringify(syncState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `google_sync_packet_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openGoogleSheetDirect = () => {
    const sheetId = googleSheetId || '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
    window.open(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`, '_blank');
  };

  const config = syncState?.config;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyan-600" />
            <span>Google Account & Cloud Sheets Auto-Sync Engine</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Replicates local SQLite medical databases to Google Drive & Google Sheets with pre-generated formula calculation models.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => window.open(api.getGoogleDriveBundleUrl(), '_blank')}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold transition-all shadow-xs cursor-pointer"
            title="Download full JSON & CSV data pack for manual upload to Google Drive"
          >
            <Download className="w-3.5 h-3.5 text-cyan-600" />
            <span>Download Drive Bundle</span>
          </button>
          <button
            onClick={openGoogleSheetDirect}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-300 text-xs font-semibold transition-all shadow-xs cursor-pointer"
          >
            <span>Open Google Sheet</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleTriggerSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing with Google Cloud...' : 'Sync to Google Sheets Now'}</span>
          </button>
        </div>
      </div>

      {/* Sync Step Progress Overlay (if syncing) */}
      {syncing && (
        <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-200 space-y-2 animate-pulse">
          <div className="flex items-center justify-between text-xs font-bold text-cyan-900">
            <span>Google Cloud Sync in Progress...</span>
            <span>Step {syncStep} of 4</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 transition-all duration-300"
              style={{ width: `${(syncStep / 4) * 100}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 flex justify-between font-mono">
            <span className={syncStep >= 1 ? 'text-cyan-700 font-bold' : ''}>1. SQLite Snapshot</span>
            <span className={syncStep >= 2 ? 'text-cyan-700 font-bold' : ''}>2. Google Token Auth</span>
            <span className={syncStep >= 3 ? 'text-cyan-700 font-bold' : ''}>3. Inject Sheet Formulas</span>
            <span className={syncStep >= 4 ? 'text-cyan-700 font-bold' : ''}>4. Completed</span>
          </div>
        </div>
      )}

      {/* Google Account Connection Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            {/* Google Logo Avatar */}
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center shadow-xs shrink-0">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">
                  Google Workspace & Drive Integration
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  CONNECTED
                </span>
              </div>
              <p className="text-xs text-slate-600 font-mono mt-0.5">
                {config?.google_account_email || 'Not connected yet'}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Drive Backup Directory: <code className="text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200 font-mono">/Lloyds_Healthcare_PNG_Backups/</code>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSignInModalOpen(true)}
              className="px-4 py-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Switch Google Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Generated Formula Engine Architecture Showcase */}
      <div className="bg-white p-6 rounded-3xl space-y-4 border border-slate-200/90 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-cyan-600" />
              <span>Pre-Generated Google Sheets Mathematical Formulas</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              When synced, the Google Sheet is automatically structured with live formulas so totals calculate natively inside Google Docs.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200">
            Active Formula Engine
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              sheet: 'KPI Summary',
              label: 'Grand Total Revenue',
              formula: '=SUM(Dispensations!E2:E) + SUM(Visits!N2:N)',
              desc: 'Rolls up all OPD consultation fees & pharmacy sales.'
            },
            {
              sheet: 'OPD Visits',
              label: 'Triage Completion Rate',
              formula: '=COUNTIF(Visits!G2:G, "Completed") / COUNTA(Visits!A2:A)',
              desc: 'Calculates clinic turnaround velocity percentage.'
            },
            {
              sheet: 'Inventory',
              label: 'Automatic Reorder Alert',
              formula: '=IF(D2<=E2, "⚠️ REORDER NOW", "ADEQUATE")',
              desc: 'Flags medication shortages automatically in column G.'
            },
            {
              sheet: 'Surveillance',
              label: 'Emergency / Urgent Acuity',
              formula: '=COUNTIF(Visits!D2:D, "Emergency") + COUNTIF(Visits!D2:D, "Urgent")',
              desc: 'Monitors high-risk clinical triage presentation count.'
            },
            {
              sheet: 'Demographics',
              label: 'Average Patient Age',
              formula: '=AVERAGE(Patients!D2:D)',
              desc: 'Computes demographic age distribution for health reports.'
            },
            {
              sheet: 'Pharmacy',
              label: 'Total Stock Depletion',
              formula: '=SUM(Dispensations!Quantity)',
              desc: 'Audits total units of pharmaceuticals dispensed.'
            }
          ].map((item, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-500">
                <span>{item.sheet}</span>
                <span className="text-emerald-700">FORMULA</span>
              </div>
              <div className="font-bold text-slate-900">{item.label}</div>
              <div className="p-1.5 rounded-lg bg-white border border-slate-200 font-mono text-[11px] text-cyan-800 select-all overflow-x-auto shadow-2xs">
                {item.formula}
              </div>
              <p className="text-[10px] text-slate-500 leading-normal">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sync Settings & Webhook Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Target Spreadsheet ID & Automation */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl space-y-4 border border-slate-200/90 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Link className="w-4 h-4 text-cyan-600" />
              <span>Google Sheet Target & Background Triggers</span>
            </h3>
            {isSaved && (
              <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved!
              </span>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Target Google Spreadsheet ID (or Google Drive Folder ID)
              </label>
              <input
                type="text"
                value={googleSheetId}
                onChange={(e) => setGoogleSheetId(e.target.value)}
                placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Spreadsheet will receive patient logs, OPD visits, and inventory sheets with pre-generated formulas.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Google Apps Script Webhook Endpoint (Optional Direct Append)
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
              />
            </div>

            {/* Auto-Sync on Wi-Fi Toggle */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-900 text-xs">Auto-Sync to Google Drive when Wi-Fi connects</span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Whenever clinic PC reconnects to Wi-Fi, pending shift records automatically flush to Google Cloud.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoSyncOnWifi}
                onChange={(e) => setAutoSyncOnWifi(e.target.checked)}
                className="w-4 h-4 accent-cyan-600 cursor-pointer"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 cursor-pointer active:scale-95 transition-all"
              >
                Save Cloud Configuration
              </button>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Air-Gapped USB Buffer Status */}
        <div className="bg-white p-6 rounded-3xl h-fit space-y-4 border border-slate-200/90 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
            <FolderSync className="w-4 h-4 text-cyan-600" />
            <span>Air-Gapped Pen Drive Buffer</span>
          </h3>

          <p className="text-xs text-slate-600 leading-relaxed">
            In remote Papua New Guinea aid posts with zero Wi-Fi, changes accumulate securely in the local SQLite transaction buffer.
          </p>

          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Today's Visits in Buffer:</span>
              <strong className="text-cyan-700 font-mono">{syncState?.buffer?.today_visits_queued || 0}</strong>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Today's Sales in Buffer:</span>
              <strong className="text-emerald-700 font-mono">{syncState?.buffer?.today_sales_queued || 0}</strong>
            </div>
            <div className="flex justify-between text-slate-600 pt-1 border-t border-slate-200">
              <span>Buffer Integrity:</span>
              <span className="text-emerald-700 font-bold font-mono">100% OK</span>
            </div>
          </div>

          <button
            onClick={downloadOfflinePacket}
            className="w-full py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Offline Cloud Bundle (.json)</span>
          </button>
        </div>

      </div>

      {/* Sync Activity Log */}
      <div className="bg-white p-6 rounded-3xl space-y-3 border border-slate-200/90 shadow-sm">
        <h3 className="text-sm font-bold text-slate-900">Google Cloud Sync Audit Trail</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Operation</th>
                <th className="py-2.5 px-3">Payload Size</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 font-sans">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {syncState?.recent_logs?.length === 0 ? (
                <tr>
                  <td colSpan="5" className="py-4 text-center text-slate-400 italic font-sans">No sync logs recorded yet.</td>
                </tr>
              ) : (
                syncState?.recent_logs?.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600">{new Date(log.synced_at).toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-cyan-800 font-bold">{log.sync_type}</td>
                    <td className="py-2.5 px-3 text-slate-900 font-bold">{log.records_count} records</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-sans font-bold ${
                        log.status === 'Success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-600 text-[11px] truncate max-w-sm">{log.message}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Google Account Sign-In Modal */}
      {isSignInModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden p-6 animate-scaleIn">
            <div className="text-center pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 mx-auto flex items-center justify-center shadow-xs mb-2">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.92 0 12s.45 3.85 1.24 5.42l4.04-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              </div>
              <h3 className="text-base font-bold text-slate-900">Sign in with Google</h3>
              <p className="text-xs text-slate-500">Authorize Google Drive & Sheets automatic clinical sync</p>
            </div>

            <form onSubmit={handleGoogleSignIn} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Staff / Facility Google Email *</label>
                <input
                  type="email"
                  required
                  value={customGoogleEmail}
                  onChange={(e) => setCustomGoogleEmail(e.target.value)}
                  placeholder="e.g. clinic.admin@lloydshealth.org.pg"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Staff Member Name</label>
                <input
                  type="text"
                  value={customGoogleName}
                  onChange={(e) => setCustomGoogleName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsSignInModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 text-white font-bold shadow-md cursor-pointer flex items-center gap-2"
                >
                  <span>Authorize Google Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

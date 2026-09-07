import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AuthModal from './components/AuthModal';
import FirstRunSetup from './components/FirstRunSetup';
import ChangePasswordGate from './components/ChangePasswordGate';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import OPDQueue from './pages/OPDQueue';
import Registers from './pages/Registers';
import Pharmacy from './pages/Pharmacy';
import DispensePOS from './pages/DispensePOS';
import StaffManagement from './pages/StaffManagement';
import EndOfDay from './pages/EndOfDay';
import CloudSync from './pages/CloudSync';
import IdleGuard from './components/IdleGuard';
import ExcelExport from './pages/ExcelExport';
import Settings from './pages/Settings';
import QuickCheckInModal from './components/QuickCheckInModal';
import { api } from './services/api';

function HospitalAppContent() {
  const {
    currentUser, checking, isAuthModalOpen, setIsAuthModalOpen,
    sections, landing, mustChangePassword, needsSetup
  } = useAuth();
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      if (tabParam) return tabParam;
    }
    return null;
  });
  const [stats, setStats] = useState(null);
  // Which register opens when something on the dashboard points at one.
  const [registersTab, setRegistersTab] = useState('returns');
  const navigate = (tab, sub) => {
    if (tab === 'registers' && sub) setRegistersTab(sub);
    setActiveTab(tab);
  };
  const [settings, setSettings] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  // Only meaningful below the lg breakpoint, where the navigation is a drawer.
  const [isNavOpen, setIsNavOpen] = useState(false);

  // Quick Action States
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [preSelectedPatientForCheckIn, setPreSelectedPatientForCheckIn] = useState(null);
  const [preSelectedPatientForDispense, setPreSelectedPatientForDispense] = useState(null);

  /*
   * Which screen this person starts on, and what happens if they arrive at one
   * they may not open.
   *
   * A pharmacist lands at the dispensing counter and a nurse at the queue,
   * because the first screen of the shift should be the one they work on. A tab
   * named in the address bar is honoured only if their role allows it: a link
   * passed between staff, or an address typed from memory, cannot be a way into
   * a section the server would refuse anyway.
   */
  useEffect(() => {
    if (!currentUser || !sections?.length) return;
    const allowed = sections.map((section) => section.id);
    if (!activeTab || !allowed.includes(activeTab)) {
      setActiveTab(landing && allowed.includes(landing) ? landing : allowed[0]);
    }
  }, [currentUser, sections, landing, activeTab]);

  // Track Online / Offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      api.getCloudSyncStatus().then(res => {
        if (res?.config?.auto_sync_on_wifi) {
          api.triggerCloudSync(false).catch(() => {});
        }
      });
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Presence heartbeat. Each device tells the server it is still in use so the
  // controls board can show who is actually on the system rather than who
  // logged in at some point today.
  useEffect(() => {
    if (!currentUser?.id) return undefined;
    const beat = () => {
      api.sendHeartbeat({
        user_id: currentUser.id,
        full_name: currentUser.full_name,
        role: currentUser.role
      }).catch(() => {});
    };
    beat();
    const id = setInterval(beat, 120000);
    return () => clearInterval(id);
  }, [currentUser?.id, currentUser?.full_name, currentUser?.role]);

  const refreshAppData = async () => {
    try {
      const [statsRes, settingsRes] = await Promise.all([
        api.getDashboardStats(),
        api.getSettings()
      ]);
      setStats(statsRes.stats);
      setSettings(settingsRes.settings);
    } catch (err) {
      console.error('App refresh error:', err);
    }
  };

  useEffect(() => {
    refreshAppData();
  }, []);

  const handleOpenCheckIn = (patient = null) => {
    setPreSelectedPatientForCheckIn(patient);
    setIsCheckInModalOpen(true);
  };

  const handleOpenDispenseForPatient = (patientInfo) => {
    setPreSelectedPatientForDispense(patientInfo);
    setActiveTab('dispense');
  };

  const handleQuickSearch = (query) => {
    if (!query) return;
    setActiveTab('patients');
  };

  // While the stored session is being re-checked, show nothing rather than a
  // flash of the sign-in screen for someone who is already signed in.
  if (checking) {
    return <div className="light-theme min-h-screen bg-canvas" aria-busy="true" />;
  }

  /*
   * A new installation has no accounts at all, so there is nobody to sign in
   * as. The first person creates the administrator account instead.
   */
  if (needsSetup) {
    return (
      <div className="light-theme flex min-h-screen items-center justify-center bg-canvas py-10 text-ink">
        <FirstRunSetup facilityName={settings?.name} />
      </div>
    );
  }

  /*
   * Nobody sees clinical information before signing in. The sign-in screen is
   * the whole page rather than a panel over the dashboard, so patient names
   * are not readable behind it.
   */
  if (!currentUser) {
    return (
      <div className="light-theme min-h-screen bg-canvas text-ink">
        <AuthModal facilityName={settings?.name} facility={settings} />
      </div>
    );
  }

  /*
   * Signed in, but on a password somebody else chose. Nothing recorded under
   * this name would mean anything yet, so no clinical screen is reachable
   * until the holder has replaced it.
   */
  if (mustChangePassword) {
    return (
      <div className="light-theme flex min-h-screen items-center justify-center bg-canvas py-10 text-ink">
        <ChangePasswordGate />
      </div>
    );
  }

  return (
    <div className="light-theme flex min-h-screen bg-canvas text-ink">
      <IdleGuard />
      {/* Navigation Sidebar with Official Lloyds Branding */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={navigate}
        stats={stats}
        isOnline={isOnline}
        isOpen={isNavOpen}
        onClose={() => setIsNavOpen(false)}
      />

      {/* Tapping the page behind the drawer closes it, the way every phone
          application behaves. Hidden on a laptop, where there is no drawer. */}
      {isNavOpen ? (
        <button
          type="button"
          aria-label="Close the navigation"
          onClick={() => setIsNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      ) : null}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
          onOpenNav={() => setIsNavOpen(true)}
          settings={settings}
          onQuickSearch={handleQuickSearch}
          onOpenCheckIn={() => handleOpenCheckIn(null)}
          onOpenDispense={() => {
            setPreSelectedPatientForDispense(null);
            setActiveTab('dispense');
          }}
          onOpenExport={() => setActiveTab('export')}
          onOpenEmergencyAlert={() => setActiveTab('queue')}
        />

        <main className="mx-auto w-full max-w-[1600px] flex-1 p-4 md:p-6">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              settings={settings}
              setActiveTab={navigate}
              onOpenCheckIn={() => handleOpenCheckIn(null)}
              onOpenDispense={() => {
                setPreSelectedPatientForDispense(null);
                setActiveTab('dispense');
              }}
              onOpenExport={() => setActiveTab('export')}
              refreshStats={refreshAppData}
            />
          )}

          {activeTab === 'patients' && (
            <Patients
              settings={settings}
              onCheckInPatient={(p) => handleOpenCheckIn(p)}
              onDispensePatient={(p, visit) => handleOpenDispenseForPatient({ ...p, visit_id: visit?.id || null })}
              refreshStats={refreshAppData}
            />
          )}

          {activeTab === 'queue' && (
            <OPDQueue
              settings={settings}
              onOpenCheckIn={() => handleOpenCheckIn(null)}
              onOpenDispenseForPatient={handleOpenDispenseForPatient}
              refreshStats={refreshAppData}
            />
          )}

          {activeTab === 'registers' && (
            <Registers
              settings={settings}
              initialTab={registersTab}
              onCheckInPatient={(p) => handleOpenCheckIn(p)}
            />
          )}

          {activeTab === 'pharmacy' && (
            <Pharmacy
              settings={settings}
              refreshStats={refreshAppData}
            />
          )}

          {activeTab === 'dispense' && (
            <DispensePOS
              settings={settings}
              preSelectedPatient={preSelectedPatientForDispense}
              refreshStats={refreshAppData}
            />
          )}

          {activeTab === 'staff' && (
            <StaffManagement
              settings={settings}
            />
          )}

          {activeTab === 'end-of-day' && (
            <EndOfDay
              settings={settings}
              onOpenExport={() => setActiveTab('export')}
              refreshStats={refreshAppData}
            />
          )}

          {activeTab === 'cloud-sync' && (
            <CloudSync
              settings={settings}
              isOnline={isOnline}
            />
          )}

          {activeTab === 'export' && (
            <ExcelExport
              settings={settings}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              settings={settings}
              onUpdateSettings={(newSettings) => setSettings(newSettings)}
            />
          )}
        </main>
      </div>

      {/* Global Quick Check-In Modal */}
      <QuickCheckInModal
        isOpen={isCheckInModalOpen}
        onClose={() => {
          setIsCheckInModalOpen(false);
          setPreSelectedPatientForCheckIn(null);
        }}
        defaultPatient={preSelectedPatientForCheckIn}
        settings={settings}
        onSuccess={() => {
          refreshAppData();
          setActiveTab('queue');
        }}
      />

      <AuthModal facilityName={settings?.name} />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HospitalAppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

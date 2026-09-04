import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import AuthModal from './components/AuthModal';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import OPDQueue from './pages/OPDQueue';
import Pharmacy from './pages/Pharmacy';
import DispensePOS from './pages/DispensePOS';
import StaffManagement from './pages/StaffManagement';
import EndOfDay from './pages/EndOfDay';
import CloudSync from './pages/CloudSync';
import ExcelExport from './pages/ExcelExport';
import Settings from './pages/Settings';
import QuickCheckInModal from './components/QuickCheckInModal';
import { api } from './services/api';

function HospitalAppContent() {
  const { currentUser, isAuthModalOpen, setIsAuthModalOpen } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Quick Action States
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [preSelectedPatientForCheckIn, setPreSelectedPatientForCheckIn] = useState(null);
  const [preSelectedPatientForDispense, setPreSelectedPatientForDispense] = useState(null);

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

  return (
    <div className="flex min-h-screen bg-transparent text-slate-100 selection:bg-red-600 selection:text-white">
      {/* Navigation Sidebar with Official Lloyds Branding */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        stats={stats} 
        isOnline={isOnline} 
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar
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

        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <Dashboard
              stats={stats}
              settings={settings}
              setActiveTab={setActiveTab}
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

      {/* Staff Authentication & 1-Click Shift Handover Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <HospitalAppContent />
    </AuthProvider>
  );
}

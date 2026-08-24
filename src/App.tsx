import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import AuthPage from '@/pages/AuthPage';
import PendingAccessPage from '@/pages/PendingAccessPage';
import Dashboard from '@/pages/Dashboard';
import Documents from '@/pages/Documents';
import Caisse from '@/pages/Caisse';
import Inventaire from '@/pages/Inventaire';
import ScanInventaire from '@/pages/ScanInventaire';
import PatronMode from '@/pages/PatronMode';
import DailyReportPage from '@/pages/DailyReport';
import SuperAdmin from '@/pages/SuperAdmin';
import Employees from '@/pages/Employees';
import Expenses from '@/pages/Expenses';
import Suppliers from '@/pages/Suppliers';
import Purchases from '@/pages/Purchases';
import Customers from '@/pages/Customers';
import Tables from '@/pages/Tables';
import Orders from '@/pages/Orders';
import Kitchen from '@/pages/Kitchen';
import Accounting from '@/pages/Accounting';
import Statistics from '@/pages/Statistics';
import Reports from '@/pages/Reports';
import Notifications from '@/pages/Notifications';
import SettingsPage from '@/pages/Settings';
import SyncPending from '@/pages/SyncPending';
import AIAssistant from '@/pages/AIAssistant';
import CalendarPage from '@/pages/CalendarPage';
import ChatPage from '@/pages/Chat';
import SuiviGerant from '@/pages/SuiviGerant';
import TeamPage from '@/pages/Team';
import MesEmployes from '@/pages/MesEmployes';
import RentDashboard from '@/pages/rent/Dashboard';
import RentEquipment from '@/pages/rent/Equipment';
import RentClients from '@/pages/rent/Clients';
import RentOrders from '@/pages/rent/Orders';
import RentMovements from '@/pages/rent/Movements';
import RentPayments from '@/pages/rent/Payments';
import RentCalendar from '@/pages/rent/Calendar';
import RentPacks from '@/pages/rent/Packs';
import RentInvoices from '@/pages/rent/Invoices';
import { isLocationEvent } from '@/lib/businessTypes';

import AppLayout from '@/components/AppLayout';
import ErrorBoundary from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-950 p-6">
      <div className="max-w-md w-full bg-stone-900 border border-red-500/40 rounded-2xl p-6 text-center">
        <h1 className="text-xl font-bold text-red-400 mb-3">Configuration manquante</h1>
        <p className="text-stone-300 text-sm mb-4">
          Les variables Supabase ne sont pas configurées sur Vercel.
        </p>
        <div className="text-left bg-stone-800 rounded-xl p-4 text-sm text-stone-300 space-y-2">
          <p>1. Va dans Vercel → ton projet → <strong>Settings → Environment Variables</strong></p>
          <p>2. Ajoute :</p>
          <p className="font-mono text-xs text-amber-300">VITE_SUPABASE_URL</p>
          <p className="font-mono text-xs text-amber-300">VITE_SUPABASE_ANON_KEY</p>
          <p>3. Redeploie le site</p>
        </div>
      </div>
    </div>
  );
}

function DashboardSwitch() {
  const { activeEstablishment } = useAuth();
  if (isLocationEvent(activeEstablishment?.type)) return <RentDashboard />;
  return <Dashboard />;
}

function ProtectedRoutes() {
  const { user, member, loading, needsAccess } = useAuth();
  const [bootUser, setBootUser] = useState(user);

  useEffect(() => {
    setBootUser(user);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (user) return;
      try {
        if (sessionStorage.getItem('mm_signed_out') === '1') {
          sessionStorage.removeItem('mm_signed_out');
          setBootUser(null);
          return;
        }
      } catch { /* */ }
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session?.user) {
        setBootUser(session.user as any);
      } else if (!cancelled) {
        setBootUser(null);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!isSupabaseConfigured) return <ConfigError />;

  const effectiveUser = user || bootUser;

  if (loading && !effectiveUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <Loader2 className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  if (!effectiveUser) return <AuthPage />;
  if (needsAccess && !member && !effectiveUser) return <PendingAccessPage />;

  return (
    <AppLayout>
      <Routes>
        <Route path="/dashboard" element={<DashboardSwitch />} />
        <Route path="/rent/equipment" element={<RentEquipment />} />
        <Route path="/rent/clients" element={<RentClients />} />
        <Route path="/rent/orders" element={<RentOrders />} />
        <Route path="/rent/movements" element={<RentMovements />} />
        <Route path="/rent/payments" element={<RentPayments />} />
        <Route path="/rent/calendar" element={<RentCalendar />} />
        <Route path="/rent/packs" element={<RentPacks />} />
        <Route path="/rent/invoices" element={<RentInvoices />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/pos" element={<Caisse />} />
        <Route path="/caisse" element={<Navigate to="/pos" replace />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/kitchen" element={<Kitchen />} />
        <Route path="/inventory" element={<Inventaire />} />
        <Route path="/inventory/scan" element={<ScanInventaire />} />
        <Route path="/inventaire" element={<Navigate to="/inventory" replace />} />
        <Route path="/tables" element={<Tables />} />
        <Route path="/mes-employes" element={<MesEmployes />} />
        <Route path="/employees" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/purchases" element={<Purchases />} />
        <Route path="/accounting" element={<Accounting />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route path="/reports" element={<Navigate to="/daily-report" replace />} />
        <Route path="/daily-report" element={<DailyReportPage />} />
        <Route path="/patron" element={<PatronMode />} />
        <Route path="/cloture" element={<Navigate to="/daily-report" replace />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/suivi" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/suivi-gerant" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/sync-pending" element={<SyncPending />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/team" element={<Navigate to="/mes-employes" replace />} />
        <Route path="/admin" element={<SuperAdmin />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Routes>
            <Route path="/*" element={<ProtectedRoutes />} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DriverAuthProvider, useDriverAuth } from './context/DriverAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import AdminLogin from './pages/AdminLogin';
import Login from './pages/Login';
import DriverLogin from './pages/DriverLogin';
import Register from './pages/Register';
import RegisterDispatcher from './pages/RegisterDispatcher';
import RegisterDriver from './pages/RegisterDriver';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Tracking from './pages/Tracking';
import Drivers from './pages/Drivers';
import Fleet from './pages/Fleet';
import Reports from './pages/Reports';
import Billing from './pages/Billing';
import DispatcherCommissions from './pages/DispatcherCommissions';
import Settings from './pages/Settings';
import UsersManagement from './pages/UsersManagement';
import DispatcherProfiles from './pages/DispatcherProfiles';
import Verifications from './pages/Verifications';
import DispatcherHub from './pages/DispatcherHub';
import DispatcherProfilePage from './pages/DispatcherProfilePage';
import DriverPortal from './pages/DriverPortal';
import SetupAdmin from './pages/SetupAdmin';

function Spinner() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

function getHomeForRole(role: string) {
  if (role === 'driver') return '/driver';
  if (role === 'dispatcher') return '/hub';
  return '/dashboard';
}

function getLoginForRole(role: string) {
  if (role === 'admin') return '/admin';
  if (role === 'dispatcher') return '/dispatcher';
  if (role === 'driver') return '/driver';
  return '/app';
}

/** Redirect to role-specific portal if already logged in */
function PublicOnly({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to={getHomeForRole(user.role)} replace />;
  return <>{children}</>;
}

/** Protected: admin + dispatcher share the main layout */
function DispatcherGuard() {
  const { user, loading, logout } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/dispatcher" replace />;
  // Driver account in dispatch session = stale legacy token (pre-migration); purge it immediately
  if (user.role === 'driver') {
    localStorage.removeItem('osi_token');
    localStorage.removeItem('osi_user');
    logout();
    return <Navigate to="/dispatcher" replace />;
  }
  return <Layout />;
}

/** Protected: admin only */
function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/admin" replace />;
  if (user.role !== 'admin') return <Navigate to={getLoginForRole(user.role)} replace />;
  return <>{children}</>;
}

/**
 * Single entry point for the driver section:
 * - Not authenticated → shows DriverLogin
 * - Authenticated as driver → shows DriverPortal
 * Both live at /driver so the URL stays clean.
 */
function RegisterRoot() {
  const host = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const portal = params.get('portal');
  if (portal === 'driver' || host === 'driver.osilogistics.com') return <RegisterDriver />;
  return <RegisterDispatcher />;
}

function DriverRoot() {
  const { user, loading } = useDriverAuth();
  if (loading) return <Spinner />;
  if (!user || user.role !== 'driver') return <DriverLogin />;
  return <DriverPortal />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Landing — portal selector (accessible at / and /app) */}
      <Route path="/"    element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/app" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/setup-admin" element={<SetupAdmin />} />

      {/* Portal logins */}
      <Route path="/admin"      element={<PublicOnly><AdminLogin /></PublicOnly>} />
      <Route path="/dispatcher" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/login"      element={<Navigate to="/dispatcher" replace />} />

      {/* Registration */}
      <Route path="/dispatcher/register" element={<PublicOnly><RegisterDispatcher /></PublicOnly>} />
      <Route path="/driver/register"     element={<PublicOnly><RegisterDriver /></PublicOnly>} />
      <Route path="/register"            element={<PublicOnly><RegisterRoot /></PublicOnly>} />

      {/* Driver — login + portal under the same clean URL /driver */}
      <Route path="/driver"       element={<DriverAuthProvider><DriverRoot /></DriverAuthProvider>} />
      <Route path="/driver/login" element={<Navigate to="/driver" replace />} />

      {/* Dispatcher + Admin shared layout */}
      <Route path="/" element={<DispatcherGuard />}>
        <Route path="dashboard"   element={<Dashboard />} />
        <Route path="orders"      element={<Orders />} />
        <Route path="tracking"    element={<Tracking />} />
        <Route path="drivers"     element={<Drivers />} />
        <Route path="fleet"       element={<Fleet />} />
        <Route path="reports"     element={<Reports />} />
        <Route path="billing"     element={<Billing />} />
        <Route path="commissions" element={<DispatcherCommissions />} />
        <Route path="hub"         element={<DispatcherHub />} />
        <Route path="profile"     element={<DispatcherProfilePage />} />
        <Route path="settings"    element={<Settings />} />

        <Route path="users"         element={<AdminGuard><UsersManagement /></AdminGuard>} />
        <Route path="dispatchers"   element={<AdminGuard><DispatcherProfiles /></AdminGuard>} />
        <Route path="verifications" element={<AdminGuard><Verifications /></AdminGuard>} />
      </Route>

      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

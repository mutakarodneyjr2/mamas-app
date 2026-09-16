/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Logo } from './components/Logo';
import { NotificationBell } from './components/NotificationBell';
import { ThemeIconButton } from './components/ThemeToggle';
import { OnboardingTour } from './components/OnboardingTour';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import AdminUsers from './pages/AdminUsers';
import AdminRoles from './pages/AdminRoles';
import SetupSuperAdmin from './pages/SetupSuperAdmin';
import MoneyOut from './pages/MoneyOut';

function Layout() {
  const { logout, userProfile } = useAuth();
  
  return (
    <div className="min-h-screen bg-mamas-bg flex flex-col font-sans transition-colors duration-200">
      {userProfile && userProfile?.status === 'approved' && userProfile?.hasCompletedOnboarding !== true && (
        <OnboardingTour userProfile={userProfile} onComplete={() => {}} />
      )}
      <header className="bg-white/90 dark:bg-[#0c1731]/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-50 shadow-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center">
              <Logo />
            </Link>
            {userProfile && userProfile?.status === 'approved' && (
              <nav className="hidden md:flex gap-6">
                <Link to="/dashboard" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Dashboard</Link>
                <Link to="/directory" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Directory</Link>
                <Link to="/welfare" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Welfare</Link>
                <Link to="/expenses" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Expenses</Link>
                <Link to="/campaigns" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Campaigns</Link>
                <Link to="/statement" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Statement</Link>
                <Link to="/help" className="text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Help</Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeIconButton />
            {userProfile && <NotificationBell />}
            {userProfile && (
              <Link to="/profile" className="text-sm text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hidden sm:flex items-center gap-1.5 font-medium">
                <span>{userProfile?.fullName || 'User'}</span>
                <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  {userProfile?.role?.replace('_', ' ') || 'MEMBER'}
                </span>
              </Link>
            )}
            <button onClick={logout} className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors px-3 py-1.5 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer">Log Out</button>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:px-5 lg:px-8 pb-32 md:pb-8 flex flex-col gap-6 overflow-x-hidden text-slate-900 dark:text-slate-100">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

import PendingApproval from './pages/PendingApproval';

function ProtectedRoute({ children, requiredRole, allowPending = false }: { children: React.ReactNode, requiredRole?: string[], allowPending?: boolean }) {
  const { currentUser, userProfile, loading } = useAuth();

  if (loading) return <div className="p-8 text-center text-mamas-text-muted">Loading...</div>;

  if (!currentUser) return <Navigate to="/login" replace />;
  if (!userProfile) return <Navigate to="/register" replace />;

  if (!allowPending && (userProfile?.status === "pending" || userProfile?.status === "rejected")) {
    return <PendingApproval />;
  }

  if (requiredRole && (!userProfile?.role || !requiredRole.includes(userProfile.role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

import Dashboard from './pages/Dashboard';
import Contribute from './pages/Contribute';
import Statement from './pages/Statement';
import Welfare from './pages/Welfare';
import ApplyWelfare from './pages/ApplyWelfare';
import Expenses from './pages/Expenses';
import Directory from './pages/Directory';
import Profile from './pages/Profile';
import AdminContributions from './pages/AdminContributions';
import AdminSettings from './pages/AdminSettings';
import AdminMedia from './pages/AdminMedia';
import AdminWelfare from './pages/AdminWelfare';

import AdminCampaigns from './pages/AdminCampaigns';
import Campaigns from './pages/Campaigns';
import AdminReports from './pages/AdminReports';
import AdminNotices from './pages/AdminNotices';
import AdminLogs from "./pages/AdminLogs";
import AdminDashboard from './pages/AdminDashboard';
import Help from './pages/Help';
import TermsOfService from './pages/TermsOfService';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { BottomNav } from './components/BottomNav';

// Admin nested routes
const AdminLayout = () => {
  const { userProfile } = useAuth();
  const location = useLocation();

  if (!userProfile) return null;
  const role = userProfile?.role || 'member';

  const canSeeRoles = role === 'super_admin';
  const canSeeContribs = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'auditor'].includes(role);
  const canSeeWelfare = ['super_admin', 'chairperson', 'vice_chairperson', 'secretary', 'treasurer', 'auditor'].includes(role);
  const canSeeCampaigns = ['super_admin', 'chairperson', 'vice_chairperson'].includes(role);
  const canSeeReports = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'auditor'].includes(role);
  const canSeeNotices = ['super_admin', 'chairperson', 'vice_chairperson', 'secretary'].includes(role);
  const canSeeSettings = ['super_admin', 'chairperson', 'vice_chairperson'].includes(role);
  const canSeeLogs = ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary', 'auditor'].includes(role);

  const navItems = [
    { label: 'Admin Home', path: '/admin', show: true },
    { label: 'User Approvals', path: '/admin/users', show: ['super_admin', 'chairperson', 'vice_chairperson', 'treasurer', 'secretary'].includes(role) },
    { label: 'Role Mgmt', path: '/admin/roles', show: canSeeRoles },
    { label: 'Contributions', path: '/admin/contributions', show: canSeeContribs },
    { label: 'Welfare Review', path: '/admin/welfare', show: canSeeWelfare },
    { label: 'Campaigns', path: '/admin/campaigns', show: canSeeCampaigns },
    { label: 'Reports', path: '/admin/reports', show: canSeeReports },
    { label: 'Notices', path: '/admin/notices', show: canSeeNotices },
    { label: 'Settings', path: '/admin/settings', show: canSeeSettings },
    { label: 'Activity Logs', path: '/admin/logs', show: canSeeLogs },
    { label: 'Media', path: '/admin/media', show: canSeeRoles },
  ].filter(i => i.show);

  return (
    <div className="flex flex-col gap-4 pb-20 md:pb-0 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide no-scrollbar w-full px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/admin' && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`rounded-2xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-colors shadow-xs ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : 'bg-white dark:bg-[#0c1731] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div className="px-4">
        <Outlet />
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/" element={<Landing />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            
            <Route element={<ProtectedRoute allowPending><Layout /></ProtectedRoute>}>
              <Route path="/setup" element={<SetupSuperAdmin />} />
            </Route>

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/statement" element={<Statement />} />
              <Route path="/welfare" element={<Welfare />} />
              <Route path="/welfare/apply" element={<ApplyWelfare />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/campaigns" element={<Campaigns />} />
              <Route path="/help" element={<Help />} />
              <Route path="/money-out" element={<MoneyOut />} />
              <Route path="/expenses" element={<Expenses />} />
              
              <Route path="/admin" element={<ProtectedRoute requiredRole={["super_admin", "secretary", "chairperson", "vice_chairperson", "treasurer", "auditor"]}><AdminLayout /></ProtectedRoute>}>
                <Route index element={<AdminDashboard />} />
                <Route path="users" element={<ProtectedRoute requiredRole={["super_admin", "secretary", "chairperson", "vice_chairperson", "treasurer"]}><AdminUsers /></ProtectedRoute>} />
                <Route path="roles" element={<ProtectedRoute requiredRole={["super_admin"]}><AdminRoles /></ProtectedRoute>} />
                <Route path="contributions" element={<ProtectedRoute requiredRole={["super_admin", "treasurer", "chairperson", "vice_chairperson", "auditor"]}><AdminContributions /></ProtectedRoute>} />
                <Route path="welfare" element={<ProtectedRoute requiredRole={["super_admin", "chairperson", "vice_chairperson", "secretary", "treasurer", "auditor"]}><AdminWelfare /></ProtectedRoute>} />
                <Route path="campaigns" element={<ProtectedRoute requiredRole={["super_admin", "chairperson", "vice_chairperson"]}><AdminCampaigns /></ProtectedRoute>} />
                <Route path="reports" element={<ProtectedRoute requiredRole={["super_admin", "chairperson", "vice_chairperson", "treasurer", "auditor"]}><AdminReports /></ProtectedRoute>} />
                <Route path="notices" element={<ProtectedRoute requiredRole={["super_admin", "chairperson", "vice_chairperson", "secretary"]}><AdminNotices /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute requiredRole={["super_admin", "chairperson", "vice_chairperson"]}><AdminSettings /></ProtectedRoute>} />
                <Route path="logs" element={<ProtectedRoute requiredRole={["super_admin", "chairperson", "vice_chairperson", "treasurer", "secretary", "auditor"]}><AdminLogs /></ProtectedRoute>} />
                <Route path="media" element={<ProtectedRoute requiredRole={["super_admin"]}><AdminMedia /></ProtectedRoute>} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

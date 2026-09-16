/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Logo } from './components/Logo';
import { NotificationBell } from './components/NotificationBell';
import { ThemeIconButton } from './components/ThemeToggle';
import { OnboardingTour } from './components/OnboardingTour';
import { LeftDrawer } from './components/LeftDrawer';
import { BottomNav } from './components/BottomNav';
import Login from './pages/Login';
import Register from './pages/Register';
import Landing from './pages/Landing';
import AdminUsers from './pages/AdminUsers';
import AdminRoles from './pages/AdminRoles';
import SetupSuperAdmin from './pages/SetupSuperAdmin';
import MoneyOut from './pages/MoneyOut';
import TopContributors from './pages/TopContributors';
import { cancelAccountDeletion } from './lib/auth';
import { AdBannerModal } from './components/AdBannerModal';
import { AlertTriangle, Clock, RefreshCw, Undo2, Menu, Users, User, Shield } from 'lucide-react';

function DeletionBanner() {
  const { userProfile, currentUser } = useAuth();
  const [cancelling, setCancelling] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (!userProfile || userProfile.status !== 'pending_deletion' || !currentUser) {
    return null;
  }

  const effectiveDate = userProfile.deletionEffectiveAt 
    ? new Date(userProfile.deletionEffectiveAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : 'in 30 days';

  const daysRemaining = userProfile.deletionEffectiveAt 
    ? Math.max(0, Math.ceil((userProfile.deletionEffectiveAt - Date.now()) / (1000 * 60 * 60 * 24)))
    : 30;

  const handleCancel = async () => {
    setCancelling(true);
    setMsg(null);
    try {
      await cancelAccountDeletion(currentUser.uid);
      setMsg("Deletion cancelled. Full access restored!");
    } catch (err: any) {
      setMsg("Failed: " + (err.message || 'Could not cancel'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-3 border-b border-amber-600 shadow-md">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs sm:text-sm font-semibold">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-slate-950 shrink-0" />
          <span>
            <strong>Account Scheduled for Deletion:</strong> Permanent deletion on <strong>{effectiveDate}</strong> ({daysRemaining} days left). Member features are paused.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {msg && <span className="text-xs font-bold text-slate-900 bg-white/40 px-2 py-0.5 rounded-lg">{msg}</span>}
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="bg-slate-950 hover:bg-slate-900 text-white font-bold px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
          >
            {cancelling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />}
            <span>Cancel Deletion</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function Layout() {
  const { userProfile } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  return (
    <div className="h-screen w-screen overflow-hidden bg-mamas-bg flex flex-col font-sans transition-colors duration-200">
      <AdBannerModal />
      <DeletionBanner />
      {userProfile && userProfile?.status === 'approved' && userProfile?.hasCompletedOnboarding !== true && (
        <OnboardingTour userProfile={userProfile} onComplete={() => {}} />
      )}

      {/* Left Drawer Menu */}
      <LeftDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Vibrant Light Blue Fixed Top Header */}
      <header className="bg-blue-600 dark:bg-blue-700 text-white border-b border-blue-500/40 shrink-0 h-16 z-50 shadow-md transition-colors">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-full flex items-center justify-between">
          
          {/* Left Side: Drawer Toggle + User Profile Photo / Name */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
            {userProfile ? (
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="p-2 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                aria-label="Open menu drawer"
              >
                <Menu className="w-5 h-5" />
              </button>
            ) : (
              <Link to="/" className="flex items-center">
                <Logo dark />
              </Link>
            )}

            {userProfile && (
              <Link 
                to="/profile" 
                className="flex items-center gap-2.5 group p-1 -ml-1 rounded-2xl hover:bg-white/10 transition-colors min-w-0"
              >
                {userProfile.profilePictureUrl ? (
                  <img 
                    src={userProfile.profilePictureUrl} 
                    alt={userProfile.fullName} 
                    className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-white/20 shrink-0" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-blue-800 text-white font-extrabold text-xs flex items-center justify-center border border-white/30 shrink-0">
                    {userProfile.fullName ? userProfile.fullName.slice(0, 2).toUpperCase() : 'AM'}
                  </div>
                )}
                <div className="min-w-0 hidden xs:block sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-amber-300 transition-colors">
                      {userProfile.fullName || 'Member'}
                    </span>
                    <span className="text-[9px] font-extrabold bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full uppercase tracking-wider hidden md:inline">
                      {userProfile.role?.replace('_', ' ') || 'MEMBER'}
                    </span>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {/* Right Side: Theme, Notifications, Directory Button */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-white">
            <ThemeIconButton />

            {userProfile && <NotificationBell />}

            {userProfile && (
              <Link
                to="/directory"
                className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
                title="Open Alumni Directory"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Directory</span>
              </Link>
            )}

            {!userProfile && (
              <div className="flex items-center gap-2">
                <Link to="/login" className="text-xs font-bold text-white/90 hover:text-white transition-colors px-3 py-1.5 rounded-full hover:bg-white/10 cursor-pointer">Log In</Link>
                <Link to="/register" className="text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors px-4 py-1.5 rounded-full shadow-md cursor-pointer">Join MAMAS</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Inner Content Area (ONLY THIS SCROLLS) */}
      <main className="flex-1 w-full max-w-7xl mx-auto p-0 pb-28 overflow-y-auto text-slate-900 dark:text-slate-100">
        <Outlet />
      </main>

      {/* Fixed Bottom Navigation */}
      <div className="shrink-0 z-50">
        <BottomNav />
      </div>
    </div>
  );
}

import PendingApproval from './pages/PendingApproval';

function ProtectedRoute({ children, requiredRole, allowPending = false }: { children: React.ReactNode, requiredRole?: string[], allowPending?: boolean }) {
  const { currentUser, userProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="p-8 text-center text-mamas-text-muted">Loading...</div>;

  if (!currentUser) return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  if (!userProfile) return <Navigate to="/register" state={{ from: location.pathname + location.search }} replace />;

  if (userProfile?.status === "deleted") {
    return <PendingApproval />;
  }

  if (userProfile?.status === "suspended") {
    return <PendingApproval />;
  }

  if (!allowPending && (
    userProfile?.status === "pending" || 
    userProfile?.status === "rejected" || 
    userProfile?.status === "unverified" || 
    userProfile?.status === "awaiting_approval" ||
    userProfile?.status === "pending_deletion"
  )) {
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
            
            <Route element={<Layout />}>
              <Route path="/campaigns" element={<Campaigns />} />
            </Route>

            <Route element={<ProtectedRoute allowPending><Layout /></ProtectedRoute>}>
              <Route path="/setup" element={<SetupSuperAdmin />} />
              <Route path="/contribute" element={<Contribute />} />
              <Route path="/profile" element={<Profile />} />
            </Route>

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/statement" element={<Statement />} />
              <Route path="/welfare" element={<Welfare />} />
              <Route path="/welfare/apply" element={<ApplyWelfare />} />
              <Route path="/directory" element={<Directory />} />
              <Route path="/top-contributors" element={<TopContributors />} />
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

import React, { Suspense, lazy, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { LandingPage } from './components/LandingPage';
import { LoginModal } from './components/LoginModal';

// Code-split the dashboards so the public landing page doesn't have to
// download admin/member code, charts, tables, etc. up-front.
const AdminDashboard = lazy(() =>
  import('./pages/AdminDashboard').then((m) => ({ default: m.AdminDashboard })),
);
const MemberDashboard = lazy(() =>
  import('./pages/MemberDashboard').then((m) => ({ default: m.MemberDashboard })),
);

function FullPageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7f6] text-[#1e5a48]">
      <i className="fas fa-spinner fa-spin text-3xl"></i>
    </div>
  );
}

function ProtectedRoute({
  children,
  allowedRole,
}: {
  children: React.ReactNode;
  allowedRole: 'admin' | 'member';
}) {
  const { user, role, loading } = useAuth();

  if (loading) return <FullPageLoader />;
  if (!user || role !== allowedRole) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppContent() {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  return (
    <>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage onLoginClick={() => setIsLoginModalOpen(true)} />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member/*"
            element={
              <ProtectedRoute allowedRole="member">
                <MemberDashboard />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

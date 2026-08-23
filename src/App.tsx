import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { BlockLogin } from './pages/BlockLogin';
import { BlockReporting } from './pages/BlockReporting';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { ProgressTrend } from './pages/ProgressTrend';
import { VaccineManagementDashboard } from './pages/VaccineManagementDashboard';

import { ImagePreloader } from './components/ImagePreloader';

const PRELOAD_IMAGES = [
  '/loginlogo.png',
  '/logo.png',
  '/impactcode.png'
];

const PageViewTracker = () => {
  const location = useLocation();

  useEffect(() => {
    fetch('/api/track-activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page: location.pathname })
    }).catch(err => console.error('Failed to track activity:', err));
  }, [location]);

  return null;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <PageViewTracker />
      <ImagePreloader images={PRELOAD_IMAGES}>
        <Routes>
          <Route path="/" element={<BlockLogin />} />
          <Route path="/report" element={<BlockReporting />} />
          <Route path="/progress-trend" element={<ProgressTrend />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/vaccine-monitoring" element={<VaccineManagementDashboard />} />
        </Routes>
      </ImagePreloader>
    </BrowserRouter>
  );
};

export default App;

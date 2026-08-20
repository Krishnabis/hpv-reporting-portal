import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BlockLogin } from './pages/BlockLogin';
import { BlockReporting } from './pages/BlockReporting';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { ProgressTrend } from './pages/ProgressTrend';

import { ImagePreloader } from './components/ImagePreloader';

const PRELOAD_IMAGES = [
  '/loginlogo.png',
  '/logo.png',
  '/impactcode.png'
];

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ImagePreloader images={PRELOAD_IMAGES}>
        <Routes>
          <Route path="/" element={<BlockLogin />} />
          <Route path="/report" element={<BlockReporting />} />
          <Route path="/progress-trend" element={<ProgressTrend />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </ImagePreloader>
    </BrowserRouter>
  );
};

export default App;

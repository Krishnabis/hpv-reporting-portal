import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { BlockLogin } from './pages/BlockLogin';
import { BlockReporting } from './pages/BlockReporting';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';

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
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </ImagePreloader>
      <Analytics />
    </BrowserRouter>
  );
};

export default App;

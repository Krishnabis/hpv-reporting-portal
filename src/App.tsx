import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { BlockLogin } from './pages/BlockLogin';
import { BlockReporting } from './pages/BlockReporting';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BlockLogin />} />
        <Route path="/report" element={<BlockReporting />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import RunDetail from './RunDetail.jsx'
import MapView from './MapView.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './toast/ToastProvider.jsx'
import RequireRole from './auth/RequireRole.jsx'
import Login from './auth/Login.jsx'
import Signup from './auth/Signup.jsx'
import AdminLayout, { AdminIndex } from './admin/AdminLayout.jsx'
import AdminClubs from './admin/Clubs.jsx'
import AdminUsers from './admin/Users.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<App />}>
              <Route index element={<Dashboard />} />
              <Route path="run/:id" element={<RunDetail />} />
              <Route path="map" element={<MapView />} />
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />
              <Route element={<RequireRole roles={['super_admin', 'admin']} />}>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminIndex />} />
                  <Route path="clubs" element={<AdminClubs />} />
                  <Route path="users" element={<AdminUsers />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)

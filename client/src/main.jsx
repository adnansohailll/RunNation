import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import RunDetail from './RunDetail.jsx'
import Clubs from './Clubs.jsx'
import ClubDetail from './ClubDetail.jsx'
import Races from './Races.jsx'
import Events from './Events.jsx'
import Instructors from './Instructors.jsx'
import Shop from './Shop.jsx'
import Exchange from './Exchange.jsx'
import { AuthProvider } from './auth/AuthContext.jsx'
import { ToastProvider } from './toast/ToastProvider.jsx'
import RequireRole from './auth/RequireRole.jsx'
import Login from './auth/Login.jsx'
import Signup from './auth/Signup.jsx'
import Activate from './auth/Activate.jsx'
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
              <Route index element={<Clubs />} />
              <Route path="runs" element={<Dashboard />} />
              <Route path="run/:id" element={<RunDetail />} />
              <Route path="clubs" element={<Clubs />} />
              <Route path="club/:id" element={<ClubDetail />} />
              <Route path="races" element={<Races />} />
              <Route path="events" element={<Events />} />
              <Route path="instructors" element={<Instructors />} />
              <Route path="shop" element={<Shop />} />
              <Route path="exchange" element={<Exchange />} />
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />
              <Route path="activate" element={<Activate />} />
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

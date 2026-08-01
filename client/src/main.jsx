import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import RunDetail from './RunDetail.jsx'
import Clubs from './Clubs.jsx'
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
import AdminLayout, { AdminIndex } from './admin/AdminLayout.jsx'
import AdminRunGroups from './admin/RunGroups.jsx'
import AdminUsers from './admin/Users.jsx'
import RunGroupDataEntry from './dataentry/RunGroupDataEntry.jsx'
import RunDataEntry from './dataentry/RunDataEntry.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<App />}>
              <Route index element={<Dashboard />} />
              <Route path="run/:id" element={<RunDetail />} />
              <Route path="clubs" element={<Clubs />} />
              <Route path="races" element={<Races />} />
              <Route path="events" element={<Events />} />
              <Route path="instructors" element={<Instructors />} />
              <Route path="shop" element={<Shop />} />
              <Route path="exchange" element={<Exchange />} />
              <Route path="login" element={<Login />} />
              <Route path="signup" element={<Signup />} />
              <Route element={<RequireRole roles={['super_admin', 'admin']} />}>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminIndex />} />
                  <Route path="run-groups" element={<AdminRunGroups />} />
                  <Route path="users" element={<AdminUsers />} />
                </Route>
              </Route>
              {/* Unlisted — no nav link. Permalinks only, for any logged-in user. */}
              <Route element={<RequireRole roles={['super_admin', 'admin', 'user']} />}>
                <Route path="data-entry/run-groups" element={<RunGroupDataEntry />} />
                <Route path="data-entry/runs" element={<RunDataEntry />} />
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)

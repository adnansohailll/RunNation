import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Dashboard from './Dashboard.jsx'
import RunDetail from './RunDetail.jsx'
import MapView from './MapView.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<Dashboard />} />
          <Route path="run/:id" element={<RunDetail />} />
          <Route path="map" element={<MapView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)

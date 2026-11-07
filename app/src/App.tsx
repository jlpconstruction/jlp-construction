import { Route, Routes } from 'react-router'
import AdminLayout from './components/AdminLayout'
import SiteLayout from './components/SiteLayout'
import NotFound from './pages/NotFound'
import Login from './pages/admin/Login'
import RequestDetail from './pages/admin/RequestDetail'
import Requests from './pages/admin/Requests'
import Saturdays from './pages/admin/Saturdays'
import Today from './pages/admin/Today'
import Home from './pages/site/Home'
import OurWork from './pages/site/OurWork'
import Policies from './pages/site/Policies'
import RequestForm from './pages/site/RequestForm'
import Services from './pages/site/Services'

export default function App() {
  return (
    <Routes>
      {/* Customer website */}
      <Route element={<SiteLayout />}>
        <Route index element={<Home />} />
        <Route path="services" element={<Services />} />
        <Route path="our-work" element={<OurWork />} />
        <Route path="request" element={<RequestForm />} />
        <Route path="policies" element={<Policies />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Jorge's dashboard (login required) */}
      <Route path="admin/login" element={<Login />} />
      <Route path="admin" element={<AdminLayout />}>
        <Route index element={<Today />} />
        <Route path="requests" element={<Requests />} />
        <Route path="requests/:id" element={<RequestDetail />} />
        <Route path="saturdays" element={<Saturdays />} />
      </Route>
    </Routes>
  )
}

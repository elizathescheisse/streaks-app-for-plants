import { Routes, Route } from 'react-router-dom'
import DashboardHome from '../features/plants/pages/DashboardHome.jsx'
import PlantDetailPage from '../features/plants/pages/PlantDetailPage.jsx'

export default function AppRoutes({
  plants,
  today,
  openAdd,
  detailCallbacks,
}) {
  return (
    <Routes>
      <Route path="/plant/:id" element={
        <PlantDetailPage plants={plants} {...detailCallbacks} />
      } />
      <Route path="/" element={
        <DashboardHome
          plants={plants}
          today={today}
          openAdd={openAdd}
          detailCallbacks={detailCallbacks}
        />
      } />
    </Routes>
  )
}

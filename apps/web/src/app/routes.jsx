import { Routes, Route } from 'react-router-dom'
import HomePage from '../features/plants/pages/HomePage.jsx'
import PlantDetailPage from '../features/plants/pages/PlantDetailPage.jsx'

// Route definitions for the app. Modal panels (add/edit plant, log entry,
// quick log, settings) are rendered above this in App.jsx so they sit on
// top of any route. App owns all plant state and the detail callbacks;
// AppRoutes is a thin prop-forwarder.
export default function AppRoutes({ plants, today, openAdd, detailCallbacks }) {
  return (
    <Routes>
      <Route path="/plant/:id" element={
        <PlantDetailPage plants={plants} {...detailCallbacks} />
      } />
      <Route path="/" element={
        <HomePage
          plants={plants}
          today={today}
          openAdd={openAdd}
          detailCallbacks={detailCallbacks}
        />
      } />
    </Routes>
  )
}

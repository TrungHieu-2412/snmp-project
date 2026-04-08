// App.jsx: Root quản lý Bộ định tuyến (React Router) định nghĩa các đường dẫn URL cho dự án Frontend.
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MainLayout from './pages/MainLayout';
import OverviewPage from './pages/OverviewPage';
import BenchmarkPage from './pages/BenchmarkPage';
import TopologyPage from './pages/TopologyPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<OverviewPage />} />
          <Route path="benchmark" element={<BenchmarkPage />} />
          <Route path="topology" element={<TopologyPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
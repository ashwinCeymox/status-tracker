import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import TopBar from './components/layout/TopBar';
import Dashboard from './pages/Dashboard';
import ModelsPage from './pages/ModelsPage';
import PlanningPage from './pages/PlanningPage';
import ProjectsPage from './pages/ProjectsPage';
import LogsPage from './pages/LogsPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-brand-50 dark:bg-brand-950 text-brand-900 dark:text-brand-100">
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <TopBar />
          <main className="flex-1 overflow-y-auto p-6">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/planning" element={<PlanningPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/logs" element={<LogsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
        </div>
      </div>
    </Router>
  );
}

export default App;


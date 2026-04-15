import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Tasks from './pages/Tasks';
import TaskDetail from './pages/TaskDetail';
import TaskSubmit from './pages/TaskSubmit';
import TaskReview from './pages/TaskReview';
import TaskHistory from './pages/TaskHistory';
import Users from './pages/Users';
import SignupRequests from './pages/SignupRequests';
import ProtectedRoute from './components/ProtectedRoute';

const APPROVER_ROLES = ['Director', 'Operation Manager', 'Manager - Technical Architect'];
const ROLE_CHANGER_ROLES = ['Director', 'Manager - Technical Architect'];

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Tasks — all authenticated & approved users */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task/:id"
            element={
              <ProtectedRoute>
                <TaskDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task/:id/submit"
            element={
              <ProtectedRoute>
                <TaskSubmit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task/:id/review"
            element={
              <ProtectedRoute>
                <TaskReview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/task/:id/history"
            element={
              <ProtectedRoute>
                <TaskHistory />
              </ProtectedRoute>
            }
          />
          <Route path="/tasks" element={<Navigate to="/" replace />} />

          {/* Signup requests — Director, Op Manager, MTA */}
          <Route
            path="/signup-requests"
            element={
              <ProtectedRoute allowedRoles={APPROVER_ROLES}>
                <SignupRequests />
              </ProtectedRoute>
            }
          />

          {/* Users — Director & MTA only */}
          <Route
            path="/users"
            element={
              <ProtectedRoute allowedRoles={ROLE_CHANGER_ROLES}>
                <Users />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import MainLayout from './layouts/MainLayout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import DeckDetail from './pages/DeckDetail';
import StudySession from './pages/StudySession';
import Collections from './pages/Collections';
import CollectionDetail from './pages/CollectionDetail';
import QuizEditor from './pages/QuizEditor';
import QuizSession from './pages/QuizSession';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import PublicDecks from './pages/PublicDecks';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import { Toaster } from './components/ui/toaster';
import { LoadingState } from './components/LoadingState';

// Lazy-loaded: pulls in recharts only when the user opens Stats.
const Stats = React.lazy(() => import('./pages/Stats'));

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  return currentUser ? <>{children}</> : <Navigate to="/login" />;
};

const RootRoute: React.FC = () => {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/dashboard" replace /> : <Landing />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<RootRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route element={<MainLayout />}>
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/deck/:deckId"
              element={
                <PrivateRoute>
                  <DeckDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/study/:deckId"
              element={
                <PrivateRoute>
                  <StudySession />
                </PrivateRoute>
              }
            />
            <Route
              path="/collections"
              element={
                <PrivateRoute>
                  <Collections />
                </PrivateRoute>
              }
            />
            <Route
              path="/collection/:collectionId"
              element={
                <PrivateRoute>
                  <CollectionDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/quiz/:quizId"
              element={
                <PrivateRoute>
                  <QuizSession />
                </PrivateRoute>
              }
            />
            <Route
              path="/quiz/:quizId/edit"
              element={
                <PrivateRoute>
                  <QuizEditor />
                </PrivateRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <PrivateRoute>
                  <React.Suspense fallback={<LoadingState />}>
                    <Stats />
                  </React.Suspense>
                </PrivateRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <PrivateRoute>
                  <Leaderboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/public"
              element={
                <PrivateRoute>
                  <PublicDecks />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute>
                  <Profile />
                </PrivateRoute>
              }
            />
          </Route>
        </Routes>
      </Router>
      <Toaster />
    </AuthProvider>
  );
}

export default App;

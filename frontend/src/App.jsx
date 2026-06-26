import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import SmoothScroll from './components/SmoothScroll.jsx';
import Cursor from './components/Cursor.jsx';
import Nav from './components/Nav.jsx';
import Footer from './components/Footer.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { PageLoader } from './components/ui/PageHeader.jsx';
import { useUI } from './store/ui.js';

const Landing = lazy(() => import('./pages/Landing.jsx'));
const Playground = lazy(() => import('./pages/Playground.jsx'));
const Console = lazy(() => import('./pages/Console.jsx'));
const Sentinel = lazy(() => import('./pages/Sentinel.jsx'));
const Insights = lazy(() => import('./pages/Insights.jsx'));
const TicketDetail = lazy(() => import('./pages/TicketDetail.jsx'));
const Docs = lazy(() => import('./pages/Docs.jsx'));
const Settings = lazy(() => import('./pages/Settings.jsx'));
const NotFound = lazy(() => import('./pages/NotFound.jsx'));

export default function App() {
  const initTheme = useUI((s) => s.initTheme);
  useEffect(() => initTheme(), [initTheme]);

  return (
    <div className="grain min-h-screen">
      <Cursor />
      <SmoothScroll>
        <Nav />
        <main>
          <ErrorBoundary>
            <Suspense fallback={<div className="shell"><PageLoader /></div>}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/playground" element={<Playground />} />
                <Route path="/console" element={<Console />} />
                <Route path="/sentinel" element={<Sentinel />} />
                <Route path="/insights" element={<Insights />} />
                <Route path="/ticket/:id" element={<TicketDetail />} />
                <Route path="/docs" element={<Docs />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
        <Footer />
      </SmoothScroll>
    </div>
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import App from './App.jsx';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 10_000, retry: 1 } },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Honor prefers-reduced-motion across every framer-motion animation
          (drops transforms, keeps opacity). JS animations are not covered by
          the CSS reduced-motion rule, so this is required, not cosmetic. */}
      <MotionConfig reducedMotion="user">
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <App />
        </BrowserRouter>
      </MotionConfig>
    </QueryClientProvider>
  </React.StrictMode>,
);

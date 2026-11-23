import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { useLenis } from './hooks/useLenis';
import { StudentProvider } from './context';
import { BackgroundUploadProvider } from './page/assignments/context/BackgroundUploadContext';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { AppRoutes } from './routes/AppRoutes';
import { ScrollToTop, StudentChromeGuard } from './routes/RouteGuards';
import './styles/App.css';

const App: React.FC = () => {
  useLenis();

  return (
    <AppErrorBoundary>
      <StudentProvider>
        <BrowserRouter>
          <BackgroundUploadProvider>
            <ScrollToTop />
            <StudentChromeGuard />
            <AppRoutes />
          </BackgroundUploadProvider>
        </BrowserRouter>
      </StudentProvider>
    </AppErrorBoundary>
  );
};

export default App;

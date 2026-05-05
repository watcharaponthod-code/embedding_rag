import React, { useState } from 'react';
import { Navbar } from './components/Common/Auth/Navbar';
import { UploadView } from './components/Common/UploadView';
import { SearchView } from './components/Common/SearchView';
import { ChatView } from './components/Common/ChatView';
import { DocumentDetailView } from './components/Common/DocumentDetailView';
import { AuthView } from './components/Common/Auth/AuthView';
import { AppView } from './types';

import { UploadProvider } from './components/contexts/UploadContext';
import { DocumentProvider } from './components/contexts/DocumentContext';

function AppContent() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.LOGIN);

  // Persist current view
  React.useEffect(() => {
    if (currentView !== AppView.LOGIN && currentView !== AppView.REGISTER) {
      localStorage.setItem('sycapt_last_view', currentView);
    }
  }, [currentView]);

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('sycapt_user');
    return saved ? JSON.parse(saved) : null;
  });

  // Check for token on mount
  React.useEffect(() => {
    const token = localStorage.getItem('sycapt_token');
    const savedView = localStorage.getItem('sycapt_last_view') as AppView;

    if (token && user) {
      // Restore last view if valid, otherwise default to UPLOAD
      if (savedView && Object.values(AppView).includes(savedView) && savedView !== AppView.LOGIN && savedView !== AppView.REGISTER) {
        setCurrentView(savedView);
      } else {
        setCurrentView(AppView.UPLOAD);
      }
    } else {
      setCurrentView(AppView.LOGIN);
    }
  }, []);

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    setCurrentView(AppView.UPLOAD);
  };

  const handleLogout = () => {
    localStorage.removeItem('sycapt_token');
    localStorage.removeItem('sycapt_user');
    setUser(null);
    setCurrentView(AppView.LOGIN);
  };

  const handleDocumentSelect = (id: string) => {
    setSelectedDocId(id);
    setCurrentView(AppView.DETAILS);
  };

  const handleBackToSearch = () => {
    setSelectedDocId(null);
    setCurrentView(AppView.SEARCH);
  };

  const renderContent = () => {
    // If not logged in, force Login or Register view
    if (!user) {
      return (
        <AuthView
          onSuccess={handleLoginSuccess}
          initialMode={currentView === AppView.REGISTER ? 'register' : 'login'}
        />
      );
    }

    switch (currentView) {
      case AppView.LOGIN: // If somehow landed here while logged in, go to Upload
        return <UploadView />;
      case AppView.REGISTER:
        return <UploadView />;
      case AppView.UPLOAD:
        return <UploadView />;
      case AppView.SEARCH:
        return <SearchView onSelectDocument={handleDocumentSelect} />;
      case AppView.CHAT:
        return <ChatView />;
      case AppView.DETAILS:
        return selectedDocId ? (
          <DocumentDetailView docId={selectedDocId} onBack={handleBackToSearch} onNavigate={handleDocumentSelect} />
        ) : (
          <SearchView onSelectDocument={handleDocumentSelect} />
        );
      default:
        return <UploadView />;
    }
  };

  return (
    <div className="min-h-screen bg-sycapt-light-gray flex flex-col font-sans text-sycapt-dark selection:bg-sycapt-red selection:text-white overflow-x-hidden">

      {user && <Navbar currentView={currentView} onChangeView={setCurrentView} user={user} onLogout={handleLogout} />}

      <main className={`flex-grow relative z-10 w-full ${user ? 'h-[calc(100vh-64px)]' : 'h-screen'} overflow-hidden`}>
        <div className="w-full h-full bg-white transition-all duration-500">
          {renderContent()}
        </div>
      </main>

    </div>
  );
}

function App() {
  return (
    <UploadProvider>
      <DocumentProvider>
        <AppContent />
      </DocumentProvider>
    </UploadProvider>
  );
}

export default App;
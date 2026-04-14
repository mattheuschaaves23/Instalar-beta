import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ConfirmProvider } from './contexts/ConfirmContext';
import { NotificationProvider } from './contexts/NotificationContext';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <NotificationProvider>
        <ConfirmProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                borderRadius: '18px',
                border: '1px solid rgba(205, 163, 73, 0.18)',
                background: 'rgba(11, 10, 9, 0.94)',
                color: '#f6efdf',
                boxShadow: '0 18px 40px rgba(0, 0, 0, 0.3)',
              },
            }}
          />
        </ConfirmProvider>
      </NotificationProvider>
    </AuthProvider>
  </React.StrictMode>
);

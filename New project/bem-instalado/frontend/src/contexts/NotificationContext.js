import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);

  const loadNotifications = async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    try {
      const response = await api.get('/notifications');
      setNotifications(response.data);
    } catch (_error) {
      setNotifications([]);
    }
  };

  useEffect(() => {
    loadNotifications();

    if (!user) {
      return undefined;
    }

    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <NotificationContext.Provider value={{ notifications, refreshNotifications: loadNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

import { createContext, useContext, useEffect, useState } from 'react';
import { getProfileRequest, loginRequest, registerRequest } from '../services/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');

    if (!token) {
      setLoading(false);
      return;
    }

    getProfileRequest()
      .then((profile) => setUser(profile))
      .catch(() => {
        localStorage.removeItem('token');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (payload) => {
    const result = await loginRequest(payload);
    localStorage.setItem('token', result.token);
    setUser(result.user);
    return result;
  };

  const register = async (payload) => {
    const result = await registerRequest(payload);
    localStorage.setItem('token', result.token);
    setUser(result.user);
    return result;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

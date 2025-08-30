import { createContext, useState, useContext, useEffect } from 'react';
import { apiRequest } from '../lib/api';

const AuthContext = createContext();
export function useAuth() { 
  return useContext(AuthContext); 
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Computed property for backward compatibility
  const isLoggedIn = !!user;

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      const response = await apiRequest('/me');
      setUser({ customer_id: response.customer_id });
    } catch (error) {
      console.log('No valid session:', error.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  // Updated to be async and return a Promise
  async function login(customer_id) {
    // The actual login request is handled in login.js
    // This just updates the context state
    setUser({ customer_id });
    
    // Return a resolved promise to ensure proper async handling
    return Promise.resolve();
  }

  async function logout() {
    try {
      await apiRequest('/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
    }
  }

  // Add token getter for backward compatibility with components expecting it
  const token = isLoggedIn ? 'cookie-based' : null;

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '16px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ 
      user,
      isLoggedIn, 
      login, 
      logout, 
      token, // For components that still check for token
      loading 
    }}>
      {children}
    </AuthContext.Provider>
  );
}
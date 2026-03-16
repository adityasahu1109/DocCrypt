import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for mock session
    const storedUser = localStorage.getItem('mockUser');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  const BACKEND_URL = "http://localhost:8080";

  const login = async (email, password) => {
    try {
        const response = await fetch(`${BACKEND_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem('mockUser', JSON.stringify(data.user));
            setUser(data.user);
            return true;
        } else {
            throw new Error(data.detail || 'Login failed');
        }
    } catch (err) {
        console.error("Login Error:", err);
        throw err;
    }
  };

  const signup = async (userData) => {
      try {
          // Format the data for the backend API UserSignup model
          const payload = {
              email: userData.email,
              password: userData.password,
              userType: userData.type,
              firstName: userData.firstName,
              lastName: userData.lastName,
              orgName: userData.orgName,
              contactPerson: userData.contactPerson
          };

          const response = await fetch(`${BACKEND_URL}/signup`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
          });
          const data = await response.json();
          
          if (response.ok) {
              localStorage.setItem('mockUser', JSON.stringify(data.user));
              setUser(data.user);
              return true;
          } else {
              throw new Error(data.detail || 'Signup failed');
          }
      } catch (err) {
          console.error("Signup Error:", err);
          throw err;
      }
  }

  const logout = () => {
    localStorage.removeItem('mockUser');
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    try {
        const payload = {
            email: user.email,
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            orgName: profileData.orgName
        };
        const response = await fetch(`${BACKEND_URL}/update-profile`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('mockUser', JSON.stringify(data.user));
            setUser(data.user);
            return true;
        } else {
            throw new Error(data.detail || 'Profile update failed');
        }
    } catch (err) {
        console.error("Profile Update Error:", err);
        throw err;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, updateProfile, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

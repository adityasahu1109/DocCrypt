import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldCheck, LogOut, User } from 'lucide-react';
import { Button } from '../ui/Button';

export function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50">
      <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary-600 font-bold text-xl">
          <ShieldCheck className="w-6 h-6" />
          <span>DocCrypt</span>
        </Link>
        
        <div className="flex items-center gap-4">
          <Link to="/verify" className="text-gray-600 hover:text-gray-900 font-medium font-sm">
            Verify Document
          </Link>
          
          {user ? (
            <div className="flex items-center gap-4 border-l border-gray-200 pl-4">
              <Link to="/dashboard" className="flex items-center gap-2 text-gray-700 hover:text-gray-900 font-medium">
                <User className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500">
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          ) : (
            <Link to="/auth">
              <Button variant="primary" size="sm">
                Login / Issue
              </Button>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}

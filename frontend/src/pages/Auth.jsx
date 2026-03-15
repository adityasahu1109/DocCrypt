import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardContent, CardTitle, Input } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Lock, Mail, User, Building, Fingerprint } from 'lucide-react';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [userType, setUserType] = useState('Individual');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    orgName: '',
    contactPerson: ''
  });
  const [toastMessage, setToastMessage] = useState('');
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setToastMessage(''); // clear previous messages
    
    try {
      if (isLogin) {
        if (formData.email && formData.password) {
          await login(formData.email, formData.password);
          navigate('/dashboard');
        }
      } else {
        await signup({ ...formData, type: userType });
        navigate('/dashboard');
      }
    } catch (err) {
      setToastMessage(err.message || "Authentication failed");
    }
  };

  const handleForgotPassword = (e) => {
    e.preventDefault();
    if (!formData.email) {
      setToastMessage('Please enter your email first.');
    } else {
      setToastMessage(`Recovery link sent to ${formData.email}`);
    }
    setTimeout(() => setToastMessage(''), 3000);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-primary-500">
        <CardHeader className="text-center space-y-1">
          <div className="flex justify-center mb-4 text-primary-600">
            <Fingerprint className="w-12 h-12" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {isLogin ? 'Welcome Back' : 'Create an Issuer Account'}
          </CardTitle>
          <p className="text-gray-500 text-sm">
            {isLogin 
              ? 'Enter your credentials to securely issue documents.' 
              : 'Sign up to start stamping documents with cryptographic proofs.'}
          </p>
        </CardHeader>
        
        <CardContent>
          {toastMessage && (
            <div className={`mb-4 p-3 text-sm font-medium rounded-md border text-center animate-pulse ${toastMessage.includes('Recovery') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
              {toastMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div className="flex p-1 bg-gray-100 rounded-md mb-6">
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded ${userType === 'Individual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setUserType('Individual')}
                >
                  <User className="w-4 h-4 mr-2" />
                  Individual
                </button>
                <button
                  type="button"
                  className={`flex-1 flex items-center justify-center py-2 text-sm font-medium rounded ${userType === 'Organization' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => setUserType('Organization')}
                >
                  <Building className="w-4 h-4 mr-2" />
                  Organization
                </button>
              </div>
            )}

            {!isLogin && userType === 'Individual' && (
              <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" name="firstName" value={formData.firstName} onChange={handleInputChange} required />
                <Input label="Last Name" name="lastName" value={formData.lastName} onChange={handleInputChange} required />
              </div>
            )}

            {!isLogin && userType === 'Organization' && (
              <div className="space-y-4">
                <Input label="Organization Name" name="orgName" value={formData.orgName} onChange={handleInputChange} required />
                <Input label="Contact Person" name="contactPerson" value={formData.contactPerson} onChange={handleInputChange} required />
              </div>
            )}

            <div className="space-y-1">
              <Input 
                type="email" 
                label="Email address" 
                name="email" 
                placeholder="issuer@example.com"
                value={formData.email} 
                onChange={handleInputChange} 
                required 
              />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                {isLogin && (
                  <button type="button" onClick={handleForgotPassword} className="text-xs font-medium text-primary-600 hover:text-primary-500">
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <Input 
                  type="password" 
                  name="password"
                  value={formData.password} 
                  onChange={handleInputChange} 
                  required 
                  className="pl-10"
                />
              </div>
            </div>

            <Button type="submit" className="w-full mt-6 h-11 text-base">
              {isLogin ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-gray-500">
              {isLogin ? "Don't have an account? " : "Already an issuer? "}
            </span>
            <button 
              type="button" 
              onClick={() => setIsLogin(!isLogin)} 
              className="font-medium text-primary-600 hover:text-primary-500 transition-colors"
            >
              {isLogin ? 'Sign up' : 'Log in'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

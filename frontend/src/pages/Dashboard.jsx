import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardTitle, CardContent, Input } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { FileSignature, UploadCloud, Clock, Settings, FileText, CheckCircle, History } from 'lucide-react';

export default function Dashboard() {
  const { user, login, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('sign');
  
  // Signing State
  const [file, setFile] = useState(null);
  const [qrPlacement, setQrPlacement] = useState('Bottom-Right');
  const [isSigning, setIsSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState(false);
  
  // Mock History
  const [history, setHistory] = useState([]);

  // Profile Form State
  const [profileData, setProfileData] = useState({ name: user.name || '', orgName: user.orgName || '' });
  const [passData, setPassData] = useState({ old: '', new: '' });
  const [profileMsg, setProfileMsg] = useState('');

  // Fetch mock history on mount
  useEffect(() => {
    const mockHistory = JSON.parse(localStorage.getItem(`mockHistory_${user.email}`) || '[]');
    setHistory(mockHistory);
  }, [user.email]);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setSignSuccess(false);
    }
  };

  const startMockSigning = async () => {
    if (!file) return;
    setIsSigning(true);
    
    try {
        const { generateKeys, signAndStampPDF } = await import('../utils/crypto.js');
        
        // Ensure we have a keypair to sign with
        const currentKeyPair = await generateKeys();

        // Convert the dropped File object to an ArrayBuffer for pdf-lib parsing
        const fileBuffer = await file.arrayBuffer();

        // Perform the actual cryptographic signing and PDF modification
        const stampedBlob = await signAndStampPDF(fileBuffer, currentKeyPair, qrPlacement, user);
        
        // Trigger download of the newly stamped PDF
        const url = URL.createObjectURL(stampedBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name.replace('.pdf', '_stamped.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setSignSuccess(true);
        
        const newRecord = {
            id: Date.now(),
            fileName: file.name,
            date: new Date().toLocaleString(),
            status: 'Signed & Recorded'
        };
        const updatedHistory = [newRecord, ...history];
        setHistory(updatedHistory);
        localStorage.setItem(`mockHistory_${user.email}`, JSON.stringify(updatedHistory));
        
        setFile(null);
        document.getElementById('fileUpload').value = '';
    } catch (err) {
        console.error("Signing failed", err);
        alert("Cryptographic signing failed: " + err.message);
    } finally {
        setIsSigning(false);
    }
  };

  const handleProfileUpdate = async (e) => {
      e.preventDefault();
      try {
          const parts = (profileData.name || '').trim().split(' ');
          const fName = parts[0] || '';
          const lName = parts.slice(1).join(' ') || '';
          
          await updateProfile({
              firstName: fName,
              lastName: lName,
              orgName: profileData.orgName
          });
          setProfileMsg('Profile updated successfully.');
      } catch(err) {
          setProfileMsg('Update failed: ' + err.message);
      }
      setTimeout(() => setProfileMsg(''), 3000);
  }

  const handlePasswordUpdate = (e) => {
      e.preventDefault();
      // Mock verification simply checks if fields are typed (since we don't have real pw verification in mock)
      if (passData.old && passData.new) {
        setProfileMsg('Password changed successfully.');
        setPassData({ old: '', new: '' });
      } else {
        setProfileMsg('Please enter both passwords.');
      }
      setTimeout(() => setProfileMsg(''), 3000);
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-2">
          <div className="p-4 mb-4 bg-primary-50 rounded-lg border border-primary-100">
            <h2 className="font-semibold text-primary-900 truncate">
              {user.type === 'Organization' ? user.orgName : `${user.firstName} ${user.lastName}`}
            </h2>
            <p className="text-sm text-primary-700 capitalize">{user.type} Account</p>
          </div>

          <button 
            onClick={() => setActiveTab('sign')}
            className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${activeTab === 'sign' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <FileSignature className="w-5 h-5 mr-3" />
            Sign Document
          </button>
          
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${activeTab === 'history' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <Clock className="w-5 h-5 mr-3" />
            History
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center px-4 py-3 rounded-md transition-colors ${activeTab === 'settings' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
          >
            <Settings className="w-5 h-5 mr-3" />
            Profile Settings
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'sign' && (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Sign & Stamp Document</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Upload a PDF to cryptographically sign it and append a verification QR code.</p>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {signSuccess && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-md flex items-center text-green-700">
                    <CheckCircle className="w-5 h-5 mr-2" />
                    <strong>Success!</strong> &nbsp;Document signed and stamped successfully.
                  </div>
                )}

                <div 
                  className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${file ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'}`}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('fileUpload').click()}
                >
                  <input 
                    type="file" 
                    id="fileUpload" 
                    className="hidden" 
                    accept="application/pdf"
                    onChange={(e) => {
                      if(e.target.files[0]) {
                        setFile(e.target.files[0]);
                        setSignSuccess(false);
                      }
                    }}
                  />
                  
                  {file ? (
                    <div className="flex flex-col items-center text-primary-600">
                      <FileText className="w-12 h-12 mb-3" />
                      <p className="font-semibold">{file.name}</p>
                      <p className="text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-gray-500">
                      <UploadCloud className="w-12 h-12 mb-3 text-gray-400" />
                      <p className="font-medium text-gray-700">Click to select or drag and drop</p>
                      <p className="text-sm mt-1">PDF documents only</p>
                    </div>
                  )}
                </div>

                {file && (
                  <div className="bg-gray-50 p-4 rounded-md border border-gray-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">QR Code Placement</label>
                      <select 
                        className="w-full xl:w-1/2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        value={qrPlacement}
                        onChange={(e) => setQrPlacement(e.target.value)}
                      >
                        <option>Bottom-Right</option>
                        <option>Top-Left</option>
                        <option>Top-Right</option>
                        <option>New Page (Appended)</option>
                      </select>
                    </div>
                    
                    <Button 
                      className="w-full flex items-center justify-center gap-2 h-11"
                      onClick={startMockSigning}
                      disabled={isSigning}
                    >
                      {isSigning ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating Cryptographic Proof...
                        </>
                      ) : (
                        <>Sign Document</>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'history' && (
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Issuance History</CardTitle>
                <p className="text-sm text-gray-500 mt-1">Review previously signed and stamped documents.</p>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <div className="text-center py-10 bg-gray-50 rounded-md border border-gray-200 border-dashed">
                    <History className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No documents issued yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">File Name</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date Issued</th>
                          <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {history.map((record) => (
                          <tr key={record.id} className="hover:bg-gray-50 cursor-pointer">
                            <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-primary-600 sm:pl-6">{record.fileName}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{record.date}</td>
                            <td className="whitespace-nowrap px-3 py-4 text-sm">
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                                {record.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 gap-6">
              
              {profileMsg && (
                <div className="p-3 bg-green-50 text-green-700 text-sm font-medium rounded-md border border-green-200">
                  {profileMsg}
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Profile Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileUpdate} className="grid grid-cols-1 gap-4 max-w-md">
                    {user.type === 'Organization' ? (
                      <Input label="Organization Name" value={profileData.orgName} onChange={(e) => setProfileData({...profileData, orgName: e.target.value})} />
                    ) : (
                      <Input label="Display Name" value={profileData.name} onChange={(e) => setProfileData({...profileData, name: e.target.value})} />
                    )}
                    <Input label="Email Address" value={user.email} disabled />
                    <div>
                      <Button type="submit">Save Changes</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Security</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordUpdate} className="grid grid-cols-1 gap-4 max-w-md">
                    <Input type="password" label="Current Password" value={passData.old} onChange={(e) => setPassData({...passData, old: e.target.value})} />
                    <Input type="password" label="New Password" value={passData.new} onChange={(e) => setPassData({...passData, new: e.target.value})} />
                    <div>
                      <Button type="submit" variant="danger">Update Password</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

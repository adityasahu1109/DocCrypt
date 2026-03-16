import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { UploadCloud, CheckCircle, XCircle, FileSearch, Calendar, User, Hash, AlertTriangle, Key } from 'lucide-react';
import { Input } from '../components/ui/Card'; // Re-using Input from Card

export default function Verify() {
  const [activeTab, setActiveTab] = useState('scan');
  
  // Tab 1: Scan
  const [file, setFile] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [verificationLogs, setVerificationLogs] = useState([]);

  // Tab 2: Manual
  const [manualQuery, setManualQuery] = useState('');
  const [manualFile, setManualFile] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null);
    }
  };

  const handleManualDrop = async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      setManualFile(droppedFile);
      
      // Auto-hash the file for the user
      const buffer = await droppedFile.arrayBuffer();
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      setManualQuery(hashHex);
    }
  };

  const addLog = (msg) => {
      setVerificationLogs(prev => [...prev, msg]);
  };

  const handleVerify = async () => {
    if (!file) return;
    setIsVerifying(true);
    setResult(null);
    setVerificationLogs([]);

    try {
        const { verifyDocumentContent } = await import('../utils/crypto.js');
        const verificationResult = await verifyDocumentContent(file, addLog);

        if (verificationResult.success) {
            setResult({
                status: 'Pass',
                issuerName: 'Trust Registry Record',
                issuerType: 'Verified Key',
                dateIssued: 'From Blockchain / DB',
                originalHash: verificationResult.resultData.originalHash
            });
        } else {
            setResult({
                status: 'Fail',
                issuerName: 'Unknown / Invalid',
                issuerType: 'N/A',
                dateIssued: 'N/A',
                originalHash: 'Signature Tampering Detected'
            });
            addLog("VERIFICATION FULLY FAILED: " + verificationResult.error);
        }
    } catch (err) {
        setResult({
            status: 'Fail',
            issuerName: 'Error',
            issuerType: 'N/A',
            dateIssued: 'N/A',
            originalHash: 'System Error during Verification'
        });
        addLog("SYSTEM ERROR: " + err.message);
    } finally {
        setIsVerifying(false);
    }
  };

  const handleManualVerify = async (e) => {
      e.preventDefault();
      setIsVerifying(true);
      setResult(null);
      setVerificationLogs([]);
      
      try {
          const { verifyByManualHash } = await import('../utils/crypto.js');
          const verificationResult = await verifyByManualHash(manualQuery, addLog);
          
          if (verificationResult.success) {
            setResult({
                status: 'Pass',
                isOriginal: true,
                issuerName: 'Trust Registry Record',
                issuerType: 'Verified Key',
                dateIssued: 'From DB',
                originalHash: verificationResult.resultData.originalHash
            });
          } else {
              setResult({ status: 'Fail', originalHash: 'Forgery Detected' });
              addLog("VERIFICATION FULLY FAILED: " + verificationResult.error);
          }
      } catch(err) {
          addLog("SYSTEM ERROR: " + err.message);
      } finally {
          setIsVerifying(false);
      }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify a Document</h1>
        <p className="text-gray-600">Instantly cryptographically verify documents using DocCrypt's Trust Registry.</p>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <div className="bg-gray-100 p-1 rounded-lg inline-flex">
            <button 
                onClick={() => { setActiveTab('scan'); setResult(null); setVerificationLogs([]); }}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'scan' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Scan Stamped File
            </button>
            <button 
                onClick={() => { setActiveTab('manual'); setResult(null); setVerificationLogs([]); }}
                className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
                Manual Hash / Original File
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        
        {/* Input Zones */}
        {activeTab === 'scan' ? (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Scan Document Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div 
                className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
                  file ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }`}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => document.getElementById('verifyUpload').click()}
              >
                <input 
                  type="file" 
                  id="verifyUpload" 
                  className="hidden" 
                  accept="application/pdf, image/png, image/jpeg"
                  onChange={(e) => {
                    if(e.target.files[0]) {
                      setFile(e.target.files[0]);
                      setResult(null);
                    }
                  }}
                />
                
                {file ? (
                  <div className="flex flex-col items-center text-primary-600">
                    <FileSearch className="w-12 h-12 mb-3" />
                    <p className="font-semibold">{file.name}</p>
                    <p className="text-sm">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-500">
                    <UploadCloud className="w-12 h-12 mb-3 text-gray-400" />
                    <p className="font-medium text-gray-700">Drop a Stamped PDF or Image here</p>
                    <p className="text-sm mt-1">We will scan the QR code to verify the signature.</p>
                  </div>
                )}
              </div>

              <Button 
                  className="w-full h-12 text-lg" 
                  disabled={!file || isVerifying}
                  onClick={handleVerify}
              >
                {isVerifying ? 'Cryptographically Analyzing...' : 'Scan & Verify Integrity'}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Manual Cryptographic Validation</CardTitle>
              <p className="text-sm text-gray-500">Verify a document using its raw hash and signature payload.</p>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleManualVerify} className="space-y-4">
                    
                    <div 
                        className="border-2 border-dashed border-gray-300 hover:border-primary-400 rounded-lg p-4 text-center cursor-pointer bg-gray-50"
                        onDragOver={handleDragOver}
                        onDrop={handleManualDrop}
                    >
                        {manualFile ? (
                            <p className="text-primary-700 font-medium text-sm">Hashed: {manualFile.name}</p>
                        ) : (
                            <p className="text-gray-500 text-sm">Drag & Drop ORIGINAL file here to auto-calculate hash (Optional)</p>
                        )}
                    </div>

                    <div className="flex flex-col space-y-1">
                        <label className="text-sm font-medium text-gray-700">Document ID or SHA-256 Hash</label>
                        <input 
                            required 
                            type="text" 
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono" 
                            value={manualQuery}
                            onChange={(e) => setManualQuery(e.target.value)}
                            placeholder="e.g. doc_12345 or e3b0c442..."
                        />
                    </div>
                    
                    <Button type="submit" className="w-full h-12 text-lg" disabled={!manualQuery || isVerifying}>
                        {isVerifying ? 'Verifying...' : 'Validate Raw Signature'}
                    </Button>
                </form>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-4">
            {/* Results Card */}
            <div className="relative">
                {!result && !isVerifying && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                        <p className="text-gray-500 font-medium">Verify a file or hash to view results</p>
                    </div>
                )}
                
                <Card className={`shadow-md transition-all duration-300 ${(result && result.status === 'Pass') ? 'border-t-4 border-t-green-500' : (result && result.status === 'Fail') ? 'border-t-4 border-t-red-500' : ''}`}>
                <CardHeader>
                    <CardTitle className="flex justify-between items-center">
                        Verification Results
                        {result && result.status === 'Pass' && <span className="flex items-center text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full"><CheckCircle className="w-4 h-4 mr-1"/> Valid Signature</span>}
                        {result && result.status === 'Fail' && <span className="flex items-center text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full"><XCircle className="w-4 h-4 mr-1"/> Verification Failed</span>}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    
                    {result && result.status === 'Fail' && (
                        <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-700 text-sm">
                            <strong className="block mb-1">Integrity Check Failed</strong>
                            This document's cryptographic signature is invalid or tampered with.
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-start">
                            <Key className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                            <div>
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Public Key Registry</p>
                                <p className="font-medium text-gray-900">{result?.issuerName || '---'}</p>
                            </div>
                        </div>
                        
                        <div className="flex items-start">
                            <Hash className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                            <div className="w-full">
                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Verified Original Hash</p>
                                <p className="font-mono text-sm text-gray-900 break-all bg-gray-50 p-2 rounded border mt-1">
                                    {result?.originalHash || '---'}
                                </p>
                            </div>
                        </div>
                    </div>

                </CardContent>
                </Card>
            </div>

            {/* Verification Logs Stream */}
            {verificationLogs.length > 0 && (
                <Card className="shadow-md bg-gray-900 border-gray-800 text-gray-300 font-mono text-xs max-h-48 overflow-y-auto w-full">
                    <CardContent className="p-4 space-y-1">
                        {verificationLogs.map((log, i) => (
                            <div key={i}>
                               <span className="text-gray-500 mr-2">{'>'}</span> 
                               <span className={log.includes('ERROR') || log.includes('FAILED') ? 'text-red-400 font-bold' : log.includes('flawlessly') || log.includes('exactly') ? 'text-green-400 font-bold' : ''}>{log}</span>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
        </div>

      </div>
    </div>
  );
}

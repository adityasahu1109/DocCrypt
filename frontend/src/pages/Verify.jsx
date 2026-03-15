import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { UploadCloud, CheckCircle, XCircle, FileSearch, Calendar, User, Hash } from 'lucide-react';

export default function Verify() {
  const [file, setFile] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setResult(null); // Clear previous results
    }
  };

  const [verificationLogs, setVerificationLogs] = useState([]);

  const handleVerify = async () => {
    if (!file) return;
    setIsVerifying(true);
    setResult(null);
    setVerificationLogs([]);

    const addLog = (msg) => {
        setVerificationLogs(prev => [...prev, msg]);
    };

    try {
        const { verifyDocumentContent } = await import('../utils/crypto.js');
        const verificationResult = await verifyDocumentContent(file, addLog);

        if (verificationResult.success) {
            setResult({
                status: 'Pass',
                issuerName: 'Trust Registry Record',
                issuerType: 'Verified Issuer',
                dateIssued: new Date().toLocaleDateString(),
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
        setIsVerifying(false); // Make sure we stop spinning!
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Verify a Document</h1>
        <p className="text-gray-600">Upload a signed PDF or an image containing a DocCrypt QR code to instantly verify its authenticity against the trust registry.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Upload Zone */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Select Document</CardTitle>
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
                  <p className="font-medium text-gray-700">Click to select or drag and drop</p>
                  <p className="text-sm mt-1">.pdf, .png, .jpg supported</p>
                </div>
              )}
            </div>

            <Button 
                className="w-full h-12 text-lg" 
                disabled={!file || isVerifying}
                onClick={handleVerify}
            >
              {isVerifying ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Cryptographically Analyzing...
                </>
              ) : (
                'Scan & Verify Integrity'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Verification Logs Stream */}
        {verificationLogs.length > 0 && (
            <Card className="col-span-1 md:col-span-2 shadow-md bg-gray-900 border-gray-800 text-gray-300 font-mono text-sm max-h-48 overflow-y-auto mb-4">
                <CardContent className="p-4 space-y-1">
                    {verificationLogs.map((log, i) => (
                        <div key={i}>
                           <span className="text-gray-500 mr-2">{'>'}</span> 
                           <span className={log.includes('ERROR') || log.includes('FAILED') ? 'text-red-400 font-bold' : log.includes('flawlessly') ? 'text-green-400 font-bold' : ''}>{log}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        )}

        {/* Results Card */}
        <div className="relative">
            {!result && !isVerifying && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-gray-500 font-medium">Upload a file to view verification results</p>
                </div>
            )}
            
            <Card className={`shadow-md transition-all duration-300 ${(result && result.status === 'Pass') ? 'border-t-4 border-t-green-500' : (result && result.status === 'Fail') ? 'border-t-4 border-t-red-500' : ''}`}>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    Verification Results
                    {result && result.status === 'Pass' && <span className="flex items-center text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full"><CheckCircle className="w-4 h-4 mr-1"/> Valid Document</span>}
                    {result && result.status === 'Fail' && <span className="flex items-center text-sm font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full"><XCircle className="w-4 h-4 mr-1"/> Verification Failed</span>}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                
                {result && result.status === 'Fail' && (
                    <div className="bg-red-50 border border-red-200 p-4 rounded-md text-red-700 text-sm">
                        <strong className="block mb-1">Integrity Check Failed</strong>
                        This document's cryptographic signature does not match its contents, or the issuer is unknown. The file may have been tampered with.
                    </div>
                )}

                <div className="space-y-4">
                    <div className="flex items-start">
                        <User className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Issuer Name</p>
                            <p className="font-medium text-gray-900">{result?.issuerName || '---'}</p>
                            <p className="text-sm text-gray-500">{result?.issuerType || '---'}</p>
                        </div>
                    </div>
                    
                    <div className="flex items-start">
                        <Calendar className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                        <div>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Date Issued</p>
                            <p className="font-medium text-gray-900">{result?.dateIssued || '---'}</p>
                        </div>
                    </div>

                    <div className="flex items-start">
                        <Hash className="w-5 h-5 text-gray-400 mr-3 mt-0.5" />
                        <div className="w-full">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">Document Hash</p>
                            <p className="font-mono text-sm text-gray-900 break-all bg-gray-50 p-2 rounded border mt-1">
                                {result?.originalHash || '---'}
                            </p>
                        </div>
                    </div>
                </div>

            </CardContent>
            </Card>
        </div>

      </div>
    </div>
  );
}

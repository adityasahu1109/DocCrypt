import React from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, Fingerprint } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function Landing() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] bg-white text-center px-4">
      <div className="max-w-3xl space-y-8">
        
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl text-balance">
          Cryptographically Secure Document Verification
        </h1>
        
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Issue tampering-proof documents sealed with a digital cryptographic signature. 
          Instantly verify authenticity and origin on the blockchain-inspired trust registry.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-8">
          <Link to="/verify">
            <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg flex gap-2 shadow-md">
              <FileCheck2 className="w-5 h-5" />
              Verify a Document
            </Button>
          </Link>
          
          <Link to="/auth">
            <Button variant="secondary" size="lg" className="w-full sm:w-auto h-14 px-8 text-lg flex gap-2 bg-white shadow-sm">
              <Fingerprint className="w-5 h-5 text-gray-500" />
              Issue Documents
            </Button>
          </Link>
        </div>

      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, AlertCircle, HelpCircle, X, Loader2 } from 'lucide-react';

export default function FirebaseDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<{
    moduleImported: 'pending' | 'success' | 'error';
    firebaseInitialized: 'pending' | 'success' | 'error';
    collectionAccess: 'pending' | 'success' | 'error';
    queryExecution: 'pending' | 'success' | 'error';
    errorMessage?: string;
    collectionCount?: number;
  }>({
    moduleImported: 'pending',
    firebaseInitialized: 'pending',
    collectionAccess: 'pending',
    queryExecution: 'pending'
  });

  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    if (!showDiagnostics) return;
    
    const runDiagnostics = async () => {
      // Step 1: Try to import the Firebase module
      try {
        setDiagnostics(prev => ({ ...prev, moduleImported: 'pending' }));
        
        const firebaseModule = await import('@/lib/firebase');
        setDiagnostics(prev => ({ ...prev, moduleImported: 'success' }));
        
        // Step 2: Check if Firebase is initialized
        if (firebaseModule.db) {
          setDiagnostics(prev => ({ ...prev, firebaseInitialized: 'success' }));
          
          // Step 3: Try to access a collection
          try {
            setDiagnostics(prev => ({ ...prev, collectionAccess: 'pending' }));
            
            const propertiesRef = firebaseModule.db.collection('properties');
            setDiagnostics(prev => ({ ...prev, collectionAccess: 'success' }));
            
            // Step 4: Try to execute a query
            try {
              setDiagnostics(prev => ({ ...prev, queryExecution: 'pending' }));
              
              const snapshot = await propertiesRef.limit(5).get();
              setDiagnostics(prev => ({ 
                ...prev, 
                queryExecution: 'success',
                collectionCount: snapshot.size
              }));
            } catch (queryErr: any) {
              setDiagnostics(prev => ({ 
                ...prev, 
                queryExecution: 'error',
                errorMessage: queryErr.message
              }));
            }
          } catch (collErr: any) {
            setDiagnostics(prev => ({ 
              ...prev, 
              collectionAccess: 'error',
              errorMessage: collErr.message
            }));
          }
        } else {
          setDiagnostics(prev => ({ 
            ...prev, 
            firebaseInitialized: 'error',
            errorMessage: 'Firebase db instance is not available'
          }));
        }
      } catch (importErr: any) {
        setDiagnostics(prev => ({ 
          ...prev, 
          moduleImported: 'error',
          errorMessage: importErr.message
        }));
      }
    };

    runDiagnostics();
  }, [showDiagnostics]);

  // Status icon mapping
  const StatusIcon = ({ status }: { status: 'pending' | 'success' | 'error' }) => {
    switch (status) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'error':
        return <X className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  // Get overall status
  const getOverallStatus = () => {
    if (diagnostics.queryExecution === 'success') return 'success';
    if (diagnostics.moduleImported === 'error' || 
        diagnostics.firebaseInitialized === 'error' || 
        diagnostics.collectionAccess === 'error' || 
        diagnostics.queryExecution === 'error') return 'error';
    return 'pending';
  };

  const overallStatus = getOverallStatus();

  return (
    <div className="my-3">
      <div className="flex items-center mb-2">
        <button 
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="flex items-center text-xs font-medium text-blue-600 hover:text-blue-800"
        >
          {showDiagnostics ? 'Hide' : 'Run'} Firebase Diagnostics
          {!showDiagnostics && (
            <span className="ml-2">
              {overallStatus === 'success' && <Check className="h-3 w-3 text-green-500" />}
              {overallStatus === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
            </span>
          )}
        </button>
      </div>
      
      {showDiagnostics && (
        <Card className="bg-gray-50 border-gray-200">
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-sm font-medium flex items-center">
              Firebase Connection Diagnostics
              <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                overallStatus === 'success' ? 'bg-green-100 text-green-800' :
                overallStatus === 'error' ? 'bg-red-100 text-red-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {overallStatus === 'success' ? 'Healthy' :
                 overallStatus === 'error' ? 'Error' : 'Checking...'}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="py-3 px-4 text-xs">
            <ul className="space-y-2">
              <li className="flex items-center">
                <StatusIcon status={diagnostics.moduleImported} />
                <span className="ml-2">Firebase Module Import</span>
              </li>
              <li className="flex items-center">
                <StatusIcon status={diagnostics.firebaseInitialized} />
                <span className="ml-2">Firebase Client Initialized</span>
              </li>
              <li className="flex items-center">
                <StatusIcon status={diagnostics.collectionAccess} />
                <span className="ml-2">Collection Access</span>
              </li>
              <li className="flex items-center">
                <StatusIcon status={diagnostics.queryExecution} />
                <span className="ml-2">Query Execution</span>
                {diagnostics.queryExecution === 'success' && diagnostics.collectionCount !== undefined && (
                  <span className="ml-2 text-green-600">(Found {diagnostics.collectionCount} documents)</span>
                )}
              </li>
            </ul>
            
            {diagnostics.errorMessage && (
              <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700">
                <p className="font-medium">Error:</p>
                <p className="text-xs break-all">{diagnostics.errorMessage}</p>
              </div>
            )}
            
            <div className="mt-3 text-xs text-gray-500">
              <p>Last checked: {new Date().toLocaleTimeString()}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
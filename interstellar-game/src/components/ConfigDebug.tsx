/**
 * Debug component to verify runtime config and contract IDs are loaded correctly
 * Add this to your app temporarily to diagnose config issues
 */

import { useEffect, useState } from 'react';
import { getRuntimeConfig } from '../utils/runtimeConfig';
import { POCKER_CONTRACT, RPC_URL, NETWORK_PASSPHRASE } from '../utils/constants';

export function ConfigDebug() {
  const [runtimeConfig, setRuntimeConfig] = useState<any>(null);
  const [envVars, setEnvVars] = useState<any>({});

  useEffect(() => {
    // Get runtime config
    const config = getRuntimeConfig();
    setRuntimeConfig(config);

    // Get environment variables
    setEnvVars({
      VITE_POCKER_CONTRACT_ID: import.meta.env.VITE_POCKER_CONTRACT_ID,
      VITE_SOROBAN_RPC_URL: import.meta.env.VITE_SOROBAN_RPC_URL,
      VITE_NETWORK_PASSPHRASE: import.meta.env.VITE_NETWORK_PASSPHRASE,
    });
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(0,0,0,0.9)',
      color: '#0f0',
      padding: '10px',
      fontFamily: 'monospace',
      fontSize: '11px',
      maxHeight: '200px',
      overflow: 'auto',
      zIndex: 9999,
      borderTop: '2px solid #0f0'
    }}>
      <div style={{ marginBottom: '10px', fontWeight: 'bold', color: '#ff0' }}>
        🔍 CONFIG DEBUG
      </div>
      
      <div style={{ marginBottom: '5px' }}>
        <strong>Active Contract ID:</strong> {POCKER_CONTRACT || '❌ NOT SET'}
      </div>
      
      <div style={{ marginBottom: '5px' }}>
        <strong>RPC URL:</strong> {RPC_URL}
      </div>
      
      <div style={{ marginBottom: '5px' }}>
        <strong>Network:</strong> {NETWORK_PASSPHRASE}
      </div>

      <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '5px' }}>
        <strong>Runtime Config (from game-studio-config.js):</strong>
        <pre style={{ margin: '5px 0', fontSize: '10px' }}>
          {runtimeConfig ? JSON.stringify(runtimeConfig, null, 2) : '❌ NOT LOADED'}
        </pre>
      </div>

      <div style={{ marginTop: '10px', borderTop: '1px solid #333', paddingTop: '5px' }}>
        <strong>Environment Variables:</strong>
        <pre style={{ margin: '5px 0', fontSize: '10px' }}>
          {JSON.stringify(envVars, null, 2)}
        </pre>
      </div>

      <div style={{ marginTop: '10px', color: '#ff0', fontSize: '10px' }}>
        ⚠️ Expected Contract ID: CBVHGAN3B75DWRX5ZQ4I4EH5FOYOD745Y47OAYLVNPB2JJTMUDO7LAQ5
      </div>
    </div>
  );
}

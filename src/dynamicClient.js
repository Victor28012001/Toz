// /mnt/d/Documents/zombifi/client/src/dynamicClient.js
import { createDynamicClient } from '@dynamic-labs-sdk/client';
import { addSolanaExtension } from '@dynamic-labs-sdk/solana';

// Create the client
export const dynamicClient = createDynamicClient({
  environmentId: '49eed4eb-8b2a-4ba7-bad7-bf2c2efe87bd',
});

// Add Solana extension
addSolanaExtension();

// Create a promise that resolves when client is ready
export const dynamicClientReady = new Promise((resolve) => {
  const checkReady = () => {
    try {
      const core = dynamicClient.getCore();
      if (core && core.eventEmitter) {
        console.log("✅ Dynamic client ready");
        resolve(dynamicClient);
      } else {
        setTimeout(checkReady, 100);
      }
    } catch (e) {
      setTimeout(checkReady, 100);
    }
  };
  checkReady();
});
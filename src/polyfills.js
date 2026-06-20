import { Buffer } from 'buffer';
import process from 'process';

if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
  window.global = window;
  window.process = process;
  
  // Workaround for legacy prototype checks
  if (!window.crypto) {
    window.crypto = {
      getRandomValues: () => {
        throw new Error('crypto.getRandomValues() not supported');
      }
    };
  }
}
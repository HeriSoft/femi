// global.d.ts
// Import specific types from 'react' needed for the augmentation.
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// Augment the 'react' module directly.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': DetailedHTMLProps<HTMLAttributes<HTMLElement> & { 'agent-id'?: string }, HTMLElement>;
    }
  }
}

export {}; // Ensures this file is treated as a module.

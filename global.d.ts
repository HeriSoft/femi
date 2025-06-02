
import 'react'; // Ensures React's JSX namespace is available

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': {
        'agent-id': string;
        // Add other common HTML attributes that this component might use or expect
        className?: string;
        id?: string;
        style?: React.CSSProperties;
        // Add event handlers if needed, e.g.,
        // onClick?: (event: React.MouseEvent<HTMLElement>) => void;
        // For accessibility, if applicable
        role?: string;
        tabIndex?: number;
        // Add any other specific props your custom element might take
      };
    }
  }
}

export {}; // Ensures this file is treated as a module.


// Ensures global augmentation without module context.
// Relies on @types/react providing global React and JSX types.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 'agent-id': string; }, HTMLElement>;
    }
  }
}

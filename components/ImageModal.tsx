
import React from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from './Icons.tsx';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageBase64: string; // This prop will now receive either a base64 string OR a direct HTTP/HTTPS URL
  prompt: string;
  mimeType: 'image/jpeg' | 'image/png';
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageBase64, prompt, mimeType }) => {
  if (!isOpen) return null;

  const generateRandomAlphanumeric = (length: number): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
  };

  const getDisplaySrc = () => {
    if (imageBase64.startsWith('http')) {
      return imageBase64;
    }
    if (imageBase64.startsWith('data:image')) {
        return imageBase64; // It's already a full data URL
    }
    // Assume it's raw base64 data otherwise
    return `data:${mimeType};base64,${imageBase64}`;
  };

  const downloadImage = () => {
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    // Use a more descriptive name, including part of the prompt if possible
    const safePrompt = prompt.replace(/[^a-z0-9_.-]/gi, '_').substring(0, 30);
    const randomChars = generateRandomAlphanumeric(4);
    const fileName = `${safePrompt || 'ai_image'}_${randomChars}.${extension}`;

    const link = document.createElement('a');
    
    if (imageBase64.startsWith('http')) {
      // For direct URLs, set href and download attribute.
      // Browser will handle fetching. May be subject to CORS if cross-origin.
      link.href = imageBase64;
    } else if (imageBase64.startsWith('data:image')) {
      // If it's already a full data URL
      link.href = imageBase64;
    } else {
      // Assume it's raw base64 data
      link.href = `data:${mimeType};base64,${imageBase64}`;
    }
    
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div 
        className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 transition-opacity duration-300"
        onClick={onClose} // Click on backdrop closes modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-modal-title"
    >
      <div 
        className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="image-modal-title" className="text-xl font-semibold text-primary dark:text-primary-light truncate" title={prompt}>
            Image for: "{prompt.length > 50 ? prompt.substring(0,47) + '...' : prompt}"
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
            aria-label="Close image viewer"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="overflow-y-auto flex-grow flex items-center justify-center">
            <div className="relative">
              <img
                src={getDisplaySrc()}
                alt={`Generated image for prompt: ${prompt}`}
                className="max-w-full max-h-[calc(80vh-120px)] object-contain rounded-md" // Adjusted max height
              />
              <button
                onClick={downloadImage}
                className="absolute bottom-3 right-3 bg-black/40 hover:bg-black/60 text-white p-2.5 rounded-full transition-colors duration-150 ease-in-out"
                aria-label="Download image"
                title="Download image"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
            </div>
        </div>
         <button
            onClick={onClose}
            className="mt-6 w-full px-4 py-2 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark transition-colors"
          >
            Close
          </button>
      </div>
    </div>
  );
};

export default ImageModal;

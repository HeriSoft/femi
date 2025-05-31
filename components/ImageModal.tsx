import React from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from './Icons.tsx';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageBase64: string; 
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

  const downloadImage = (base64Data: string) => {
    const extension = mimeType === 'image/jpeg' ? 'jpg' : 'png';
    const randomChars = generateRandomAlphanumeric(4);
    const fileName = `imagen3_${randomChars}.${extension}`;

    const link = document.createElement('a');
    link.href = `data:${mimeType};base64,${base64Data}`;
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
                src={`data:${mimeType};base64,${imageBase64}`}
                alt={`Generated image for prompt: ${prompt}`}
                className="max-w-full max-h-[calc(80vh-120px)] object-contain rounded-md" // Adjusted max height
              />
              <button
                onClick={() => downloadImage(imageBase64)}
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
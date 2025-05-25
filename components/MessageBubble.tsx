

import React from 'react';
// Update to .ts/.tsx extensions
import { ChatMessage } from '../types.ts';
import { RobotIcon, UserIcon, LinkIcon, PhotoIcon } from './Icons.tsx';

interface MessageBubbleProps {
  message: ChatMessage;
  onImageClick?: (imageBase64: string, prompt: string, mimeType: 'image/jpeg' | 'image/png') => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onImageClick }) => {
  const isUser = message.sender === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-xl lg:max-w-2xl p-3 rounded-lg shadow ${
          isUser
            ? 'bg-primary text-white rounded-br-none'
            : 'bg-neutral-light dark:bg-neutral-darker text-neutral-darker dark:text-secondary-light rounded-bl-none'
        }`}
      >
        <div className="flex items-start space-x-2 mb-1">
          {isUser ? 
            (message.isImageQuery ? <PhotoIcon className="w-5 h-5 mt-0.5 text-white"/> : <UserIcon className="w-5 h-5 mt-0.5 text-white"/>)
            : <RobotIcon className="w-5 h-5 mt-0.5 text-primary dark:text-primary-light"/>
          }
          <span className="font-semibold text-sm">
            {isUser ? (message.isImageQuery ? 'Image Prompt' : 'You') : message.model || 'AI'}
          </span>
        </div>

        {/* User uploaded image (single) */}
        {message.imagePreview && isUser && !message.isImageQuery && (
          <div className="my-2">
            <img src={message.imagePreview} alt="Uploaded content" className="max-w-xs max-h-48 rounded-md object-contain" />
          </div>
        )}

        {/* AI generated images (can be multiple) */}
        {message.imagePreviews && message.imagePreviews.length > 0 && !isUser && (
          <div className="my-2 flex flex-wrap gap-2">
            {message.imagePreviews.map((imgSrc, index) => (
              <button
                key={index}
                onClick={() => onImageClick?.(
                  imgSrc.split(',')[1], // Send only base64 data
                  message.originalPrompt || "Image generation", 
                  message.imageMimeType || 'image/jpeg'
                )}
                className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent dark:focus:ring-accent-light rounded-md transition-all hover:opacity-80"
                aria-label={`View generated image ${index + 1}`}
              >
                <img 
                  src={imgSrc} 
                  alt={`Generated AI content ${index + 1} for prompt: ${message.originalPrompt || ""}`} 
                  className="max-w-full sm:max-w-xs max-h-96 rounded-md object-contain" 
                />
              </button>
            ))}
          </div>
        )}

        {message.fileName && isUser && (
             <div className="my-1 p-2 bg-black/10 dark:bg-white/10 rounded text-xs">
                Attached File: {message.fileName}
            </div>
        )}
        
        {/* Display message text if it has meaningful content */}
        {message.text && message.text.trim().length > 0 && (
          <p className="text-sm whitespace-pre-wrap">
            {message.text}
          </p>
        )}

        {message.groundingSources && message.groundingSources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-black/20 dark:border-white/20">
            <p className="text-xs font-semibold mb-1">Sources:</p>
            <ul className="space-y-1">
              {message.groundingSources.map((source, index) => (
                <li key={index} className="text-xs">
                  <a
                    href={source.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center hover:underline text-accent-dark dark:text-accent-light"
                  >
                    <LinkIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                    <span className="truncate">{source.title || source.uri}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
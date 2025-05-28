
import React, { useEffect, useRef, useState, useContext } from 'react';
import hljs from 'https://esm.sh/highlight.js@11.9.0'; 
import { ChatMessage, ThemeContextType } from '../types.ts';
import { RobotIcon, UserIcon, LinkIcon, PhotoIcon, ArrowPathIcon, ClipboardIcon, CheckIcon, SpeakerWaveIcon, StopCircleIcon } from './Icons.tsx';
import { useNotification } from '../contexts/NotificationContext.tsx'; 
import { ThemeContext } from '../App.tsx';

interface CodeBlockRendererProps {
  language: string | null;
  code: string;
}

const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = React.memo(({ language, code }) => {
  const codeRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const { addNotification } = useNotification(); 

  useEffect(() => {
    if (codeRef.current) {
      hljs.highlightElement(codeRef.current);
    }
  }, [code, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      addNotification("Code copied to clipboard.", "info");
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error("Failed to copy code:", err);
      addNotification("Failed to copy code.", "error", (err as Error).message);
    });
  };

  const displayLanguage = language || 'plaintext';

  return (
    <div className="my-2 bg-neutral-darkest text-secondary-light p-3 rounded-md shadow relative group/codeblock">
      <div className="flex justify-between items-center mb-1.5 text-xs">
        <span className="text-neutral-400">{displayLanguage}</span>
        <button
          onClick={handleCopy}
          className="px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-secondary-light rounded text-xs flex items-center opacity-50 group-hover/codeblock:opacity-100 transition-opacity"
          aria-label={copied ? "Copied code" : "Copy code"}
        >
          {copied ? <CheckIcon className="w-3 h-3 mr-1" /> : <ClipboardIcon className="w-3 h-3 mr-1" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto text-sm">
        <code ref={codeRef} className={`language-${displayLanguage} hljs`}>
          {code.trimEnd()}
        </code>
      </pre>
    </div>
  );
});


interface EnhancedMessageContentProps {
  text: string;
  searchQuery?: string; 
}

const EnhancedMessageContent: React.FC<EnhancedMessageContentProps> = React.memo(({ text, searchQuery }) => {

  const highlightText = (inputText: string, query: string, keyPrefix: string): React.ReactNode[] => {
    if (!query || !inputText) return [inputText];
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex = 0;
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;

    while ((match = regex.exec(inputText)) !== null) {
      if (match.index > lastIndex) {
        parts.push(<span key={`${keyPrefix}-nomatch-${matchIndex}`}>{inputText.substring(lastIndex, match.index)}</span>);
      }
      parts.push(<mark key={`${keyPrefix}-match-${matchIndex}`} className="bg-yellow-300 dark:bg-yellow-500 text-black px-0.5 rounded">{match[0]}</mark>);
      lastIndex = regex.lastIndex;
      matchIndex++;
    }

    if (lastIndex < inputText.length) {
      parts.push(<span key={`${keyPrefix}-nomatch-${matchIndex}`}>{inputText.substring(lastIndex)}</span>);
    }
    return parts.length > 0 ? parts : [inputText]; 
  };


  const processLineSegmentForFormatting = (segmentText: string, keyPrefix: string): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];
    const formattingRegex = /\*\*(.*?)\*\*|__(.*?)__|(\bhttps?:\/\/[^\s<>()"]+[^\s<>()".,;:?!'.])/g;
    let lastIndex = 0;
    let segmentMatch;
    let partKey = 0;

    while ((segmentMatch = formattingRegex.exec(segmentText)) !== null) {
      if (segmentMatch.index > lastIndex) {
        const textPart = segmentText.substring(lastIndex, segmentMatch.index);
        elements.push(...highlightText(textPart, searchQuery || '', `${keyPrefix}-text-${partKey++}`));
      }

      if (segmentMatch[1] !== undefined) { 
        elements.push(<strong key={`${keyPrefix}-bold1-${partKey++}`}>{segmentMatch[1]}</strong>);
      } else if (segmentMatch[2] !== undefined) { 
        elements.push(<strong key={`${keyPrefix}-bold2-${partKey++}`}>{segmentMatch[2]}</strong>);
      } else if (segmentMatch[3] !== undefined) { 
        elements.push(
          <a href={segmentMatch[3]} target="_blank" rel="noopener noreferrer" key={`${keyPrefix}-link-${partKey++}`} className="text-accent dark:text-accent-light hover:underline break-all">
            {segmentMatch[3]}
          </a>
        );
      }
      lastIndex = formattingRegex.lastIndex;
    }

    if (lastIndex < segmentText.length) {
        const textPart = segmentText.substring(lastIndex);
        elements.push(...highlightText(textPart, searchQuery || '', `${keyPrefix}-text-${partKey++}`));
    }
    return elements;
  };

  const processRegularTextLine = (line: string, lineKey: string | number): React.ReactNode[] => {
    const lineElements: React.ReactNode[] = [];
    const commentTitleRegex = /^(?<prefix>(?:\/\/|#)\s*(?:[-=*_]{3,}|(?:##?#?)\s*|\*{2,}\s*))(?<titleContent>[^-=*_#\s].*?)(?<suffix>(?:[-=*_]{3,})?(?:\*{2,})?\s*)$/;
    const titleMatch = line.match(commentTitleRegex);

    if (titleMatch && titleMatch.groups?.titleContent.trim()) {
      if (titleMatch.groups.prefix) {
          lineElements.push(<span key={`${lineKey}-prefix`}>{titleMatch.groups.prefix}</span>);
      }
      lineElements.push(<strong key={`${lineKey}-title`}>{titleMatch.groups.titleContent.trim()}</strong>);
      if (titleMatch.groups.suffix) {
        lineElements.push(<span key={`${lineKey}-suffix`}>{titleMatch.groups.suffix}</span>);
      }
    } else {
      if (line.length > 0) {
          return processLineSegmentForFormatting(line, `${lineKey}-seg`);
      }
    }
    return lineElements; 
  };

  const codeBlockRegex = /```(\w*)\n([\s\S]*?)\n```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let partIndex = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const textSegment = text.substring(lastIndex, match.index);
      textSegment.split('\n').forEach((line, lineIdx, arr) => {
        const processedLineElements = processRegularTextLine(line, `text-${partIndex}-line-${lineIdx}`);
        if (processedLineElements.length > 0) {
            processedLineElements.forEach(el => parts.push(el));
        }
        if (lineIdx < arr.length - 1) {
          parts.push(<br key={`text-${partIndex}-br-${lineIdx}`} />);
        }
      });
      partIndex++;
    }
    const language = match[1] || null;
    const codeContent = match[2];
    parts.push(
      <CodeBlockRenderer
        key={`code-${partIndex}`}
        language={language}
        code={codeContent}
      />
    );
    partIndex++;
    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    const textSegment = text.substring(lastIndex);
    textSegment.split('\n').forEach((line, lineIdx, arr) => {
      const processedLineElements = processRegularTextLine(line, `text-${partIndex}-line-${lineIdx}`);
      if (processedLineElements.length > 0) {
        processedLineElements.forEach(el => parts.push(el));
      }
      if (lineIdx < arr.length - 1) {
         parts.push(<br key={`text-${partIndex}-br-${lineIdx}`} />);
      }
    });
  }
  
  if (parts.length === 0 && text.trim() === '') {
      return <>&nbsp;</>; 
  }
  if (parts.length === 0 && text.trim() !== '') { 
     text.split('\n').forEach((line, lineIdx, arr) => {
      const processedLineElements = processRegularTextLine(line, `fallback-text-line-${lineIdx}`);
      if (processedLineElements.length > 0) {
        processedLineElements.forEach(el => parts.push(el));
      }
      if (lineIdx < arr.length - 1) {
        parts.push(<br key={`fallback-br-${lineIdx}`} />);
      }
    });
  }

  return <>{parts}</>;
});

interface MessageBubbleProps {
  message: ChatMessage;
  showAvatar: boolean; 
  onImageClick?: (imageBase64: string, promptText: string, mimeType: 'image/jpeg' | 'image/png') => void;
  onRegenerate?: (aiMessageId: string, promptedByMessageId: string) => void;
  isLoading?: boolean;
  onPlayAudio?: () => void;
  isAudioPlaying?: boolean;
  searchQuery?: string; 
  isCurrentSearchResult?: boolean; 
}

const formatTime = (timestamp: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString(navigator.language, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  showAvatar,
  onImageClick, 
  onRegenerate, 
  isLoading,
  onPlayAudio,
  isAudioPlaying,
  searchQuery,
  isCurrentSearchResult
}) => {
  const isUser = message.sender === 'user';
  const themeContext = useContext(ThemeContext);
  const currentTheme = themeContext?.theme || 'light';

  let bubbleBackgroundColor = '';
  let bubbleTextColor = '';
  let tailColor = '';
  let audioButtonClasses = ''; // For the play audio button
  let timestampColor = '';

  if (currentTheme === 'light') {
    if (isUser) {
      bubbleBackgroundColor = '#effdde'; // Light green for user
      bubbleTextColor = '#374151';    // Dark gray text (Tailwind gray-700 like)
      audioButtonClasses = 'bg-black/10 hover:bg-black/20 text-neutral-700'; // Darker button on light green
      timestampColor = 'rgba(75, 85, 99, 0.7)'; // Tailwind gray-600 with opacity
    } else { // AI in light theme
      bubbleBackgroundColor = '#ffffff'; // White for AI
      bubbleTextColor = '#374151';    // Dark gray text
      audioButtonClasses = 'bg-gray-200 hover:bg-gray-300 text-neutral-700'; // Standard light button on white
      timestampColor = 'rgba(107, 114, 128, 0.9)'; // Tailwind gray-500 with opacity
    }
  } else { // Dark theme
    if (isUser) {
      bubbleBackgroundColor = '#2b5278'; // Dark blue for user
      bubbleTextColor = '#FFFFFF';    // White text
      audioButtonClasses = 'bg-white/20 hover:bg-white/30 text-white'; // Light button on dark blue
      timestampColor = 'rgba(209, 213, 219, 0.7)'; // Tailwind gray-300 with opacity
    } else { // AI in dark theme
      bubbleBackgroundColor = '#182533'; // Darker gray/blue for AI
      bubbleTextColor = '#FFFFFF';    // White text
      audioButtonClasses = 'bg-white/20 hover:bg-white/30 text-white'; // Light button on dark gray/blue
      timestampColor = 'rgba(156, 163, 175, 0.8)'; // Tailwind gray-400 with opacity
    }
  }
  tailColor = bubbleBackgroundColor;


  const bubbleStyle: React.CSSProperties = {
    backgroundColor: bubbleBackgroundColor,
    color: bubbleTextColor,
  };

  const tailStyle: React.CSSProperties = {
    backgroundColor: tailColor,
    clipPath: 'polygon(100% 100%, 0% 100%, 100% 0%)', 
  };
  
  const searchHighlightStyle = isCurrentSearchResult ? 'ring-2 ring-accent dark:ring-accent-light ring-offset-2 ring-offset-secondary-light dark:ring-offset-neutral-dark' : '';
  
  const bubbleContentClasses = [
    "max-w-md sm:max-w-lg md:max-w-xl p-3 rounded-xl shadow relative z-10",
    message.isRegenerating ? 'opacity-75' : '',
    searchHighlightStyle
  ].filter(Boolean).join(' ');

  const tailClasses = "absolute bottom-0 w-3 h-3 z-0 left-[-6px]";

  return (
    <div className={`flex items-end space-x-2 group justify-start`}> 
      <div className="w-8 h-8 flex-shrink-0"> 
        {showAvatar && (
          <div className={`w-full h-full rounded-full flex items-center justify-center ${
            isUser 
              ? 'bg-blue-100 dark:bg-blue-900' 
              : 'bg-gray-200 dark:bg-gray-700'
          }`}>
            {isUser ? (
              <UserIcon className="w-5 h-5 text-blue-700 dark:text-blue-300" />
            ) : (
              <RobotIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            )}
          </div>
        )}
      </div>
      
      <div className="relative"> 
        <div
          className={tailClasses}
          style={tailStyle}
          aria-hidden="true"
        ></div>
        
        <div className={bubbleContentClasses} style={bubbleStyle}>
          <div className="mb-1">
            {!isUser && (
                <span className="font-semibold text-sm" style={{ color: bubbleTextColor }}>
                {message.model || 'AI'}
                {message.isRegenerating && <span className="italic text-xs"> (Regenerating...)</span>}
                </span>
            )}
          </div>

          {message.imagePreview && isUser && !message.isImageQuery && (
            <div className="my-2">
              <img src={message.imagePreview} alt="Uploaded content" className="max-w-xs max-h-48 rounded-md object-contain" />
            </div>
          )}

          {message.imagePreviews && message.imagePreviews.length > 0 && !isUser && (
            <div className="my-2 flex flex-wrap gap-2">
              {message.imagePreviews.map((imgSrc, index) => (
                <button
                  key={index}
                  onClick={() => onImageClick?.(
                    imgSrc.split(',')[1], 
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
             <div className="my-1 p-2 rounded text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}> {/* Slightly darker overlay */}
                Attached File: {message.fileName}
            </div>
          )}
          
          {message.text && message.text.trim().length > 0 && (
            <div className="text-sm whitespace-pre-wrap break-words" style={{ color: bubbleTextColor }}>
              <EnhancedMessageContent text={message.text} searchQuery={searchQuery} />
            </div>
          )}
           {message.text === '' && !isUser && !message.isRegenerating && ( 
              <div className="text-sm italic" style={{ color: currentTheme === 'light' ? '#6b7280' : '#9ca3af' }}>(AI returned an empty response)</div>
          )}

          {message.audioUrl && onPlayAudio && !isUser && (
            <div className="mt-2">
              <button
                onClick={onPlayAudio}
                disabled={isLoading}
                className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors 
                  ${isAudioPlaying
                    ? (currentTheme === 'light' ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-red-900 text-red-400 hover:bg-red-800')
                    : audioButtonClasses
                  } disabled:opacity-50`}
                aria-label={isAudioPlaying ? "Stop audio" : "Play audio"}
              >
                {isAudioPlaying ? <StopCircleIcon className="w-4 h-4 mr-1.5" /> : <SpeakerWaveIcon className="w-4 h-4 mr-1.5" />}
                {isAudioPlaying ? 'Stop' : 'Play Audio'}
              </button>
            </div>
          )}

          {message.groundingSources && message.groundingSources.length > 0 && (
            <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.2)'}}> {/* Adjusted border for dynamic bubble colors */}
              <p className="text-xs font-semibold mb-1">Sources:</p>
              <ul className="space-y-1">
                {message.groundingSources.map((source, index) => (
                  <li key={index} className="text-xs">
                    <a
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center hover:underline text-accent dark:text-accent-light" // Keep accent for links
                    >
                      <LinkIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span className="truncate">{source.title || source.uri}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isUser && onRegenerate && message.promptedByMessageId && !message.isRegenerating && (
            <button
              onClick={() => onRegenerate(message.id, message.promptedByMessageId!)}
              disabled={isLoading}
              className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-30"
              style={{ 
                color: bubbleTextColor === '#FFFFFF' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)',
              }}
              onMouseEnter={e => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.backgroundColor = bubbleTextColor === '#FFFFFF' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)';
                target.style.color = bubbleTextColor === '#FFFFFF' ? 'white' : 'black';
              }}
              onMouseLeave={e => {
                const target = e.currentTarget as HTMLButtonElement;
                target.style.backgroundColor = 'transparent';
                target.style.color = bubbleTextColor === '#FFFFFF' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)';
              }}
              aria-label="Regenerate response"
              title="Regenerate response"
            >
              <ArrowPathIcon className="w-4 h-4" />
            </button>
          )}

          {/* Timestamp */}
          {message.timestamp > 0 && (
             <div 
                className="text-xs text-right mt-1" 
                style={{ color: timestampColor }}
            >
                {formatTime(message.timestamp)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;

import React, { useEffect, useRef, useState, useContext } from 'react';
import hljs from 'https://esm.sh/highlight.js@11.9.0'; 
import { ChatMessage, ThemeContextType, Model, GroundingSource, TradingPairValue } from '../types.ts';
import { RobotIcon, UserIcon, LinkIcon, PhotoIcon, ArrowPathIcon, ClipboardIcon, CheckIcon, SpeakerWaveIcon, StopCircleIcon, ArrowDownTrayIcon, FilmIcon, DocumentPlusIcon, PresentationChartLineIcon, MapPinIcon, ChatBubbleOvalLeftEllipsisIcon } from './Icons.tsx'; // Added MapPinIcon, ChatBubbleOvalLeftEllipsisIcon
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

export const EnhancedMessageContent: React.FC<EnhancedMessageContentProps> = React.memo(({ text, searchQuery }) => {

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
  onImageClick?: (imageData: string, promptText: string, mimeType: 'image/jpeg' | 'image/png') => void;
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

type AASMessagePart = 
  | { type: 'aas-system'; text: string }
  | { type: 'aas-place-detail'; label: string; value: string }
  | { type: 'aas-button'; label: string; actionId: string }
  | { type: 'regular'; text: string };

const parseAASMessageContent = (text: string): AASMessagePart[] => {
  const parts: AASMessagePart[] = [];
  const lines = text.split('\n');
  let currentRegularBlock = "";

  const systemMessageRegex = /^\(\( System: (.*?)\)\)$/;
  const placeDetailRegex = /^(ĐỊA ĐIỂM|ĐỊA CHỈ|GIÁ|KM|ĐÁNH GIÁ):\s*(.*)/;
  const buttonRegex = /^\[BUTTON:(.*?):(.*?)\]$/;

  const finalizeRegularBlock = () => {
    if (currentRegularBlock.trim()) {
      parts.push({ type: 'regular', text: currentRegularBlock.trimEnd() });
    }
    currentRegularBlock = "";
  };

  lines.forEach(line => {
    const systemMatch = line.match(systemMessageRegex);
    const placeDetailMatch = line.match(placeDetailRegex);
    const buttonMatch = line.match(buttonRegex);

    if (systemMatch) {
      finalizeRegularBlock();
      parts.push({ type: 'aas-system', text: systemMatch[1] });
    } else if (placeDetailMatch) {
      finalizeRegularBlock();
      parts.push({ type: 'aas-place-detail', label: placeDetailMatch[1], value: placeDetailMatch[2] });
    } else if (buttonMatch) {
      finalizeRegularBlock();
      parts.push({ type: 'aas-button', label: buttonMatch[1], actionId: buttonMatch[2] });
    } else {
      currentRegularBlock += line + '\n';
    }
  });

  finalizeRegularBlock(); // Add any remaining regular text
  return parts;
};


export const MessageBubble: React.FC<MessageBubbleProps> = ({ 
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
  const { addNotification } = useNotification();
  const [isTextCopied, setIsTextCopied] = useState(false);

  let bubbleBackgroundColor = '';
  let bubbleTextColor = '';
  let tailColor = '';
  let audioButtonClasses = ''; 
  let timestampColor = '';
  let specialBorderClass = '';
  let aasButtonClasses = '';

  if (currentTheme === 'light') {
    if (isUser) {
      bubbleBackgroundColor = message.isTaskGoal ? '#e0f2fe' : (message.model === Model.PRIVATE ? '#e2e8f0' : '#dcfce7'); 
      bubbleTextColor = '#374151';    
      audioButtonClasses = 'bg-black/10 hover:bg-black/20 text-neutral-700'; 
      timestampColor = 'rgba(75, 85, 99, 0.7)'; 
      if (message.isTaskGoal) specialBorderClass = 'border-l-4 border-blue-400';
      else if (message.model === Model.PRIVATE) specialBorderClass = 'border-l-4 border-slate-400';
    } else { 
      bubbleBackgroundColor = message.isTaskPlan ? '#d1fae5' : (message.model === Model.KLING_VIDEO && message.videoUrl ? '#e0e7ff' : (message.model === Model.TRADING_PRO && message.tradingAnalysis ? '#eef2ff' : (message.model === Model.AI_AGENT_SMART ? '#e0f2f7' : '#ffffff')));
      bubbleTextColor = '#374151';    
      audioButtonClasses = 'bg-gray-200 hover:bg-gray-300 text-neutral-700'; 
      timestampColor = 'rgba(107, 114, 128, 0.9)'; 
      aasButtonClasses = 'bg-accent hover:bg-accent-dark text-white';
      if (message.isTaskPlan) specialBorderClass = 'border-l-4 border-green-400';
      else if (message.model === Model.KLING_VIDEO && message.videoUrl) specialBorderClass = 'border-l-4 border-indigo-400';
      else if (message.model === Model.TRADING_PRO && message.tradingAnalysis) specialBorderClass = 'border-l-4 border-purple-400';
      else if (message.model === Model.AI_AGENT_SMART) specialBorderClass = 'border-l-4 border-cyan-400';
    }
  } else { 
    if (isUser) {
      bubbleBackgroundColor = message.isTaskGoal ? '#1e3a8a' : (message.model === Model.PRIVATE ? '#374151' : '#1e40af'); 
      bubbleTextColor = '#FFFFFF';    
      audioButtonClasses = 'bg-white/20 hover:bg-white/30 text-white'; 
      timestampColor = 'rgba(209, 213, 219, 0.7)'; 
      if (message.isTaskGoal) specialBorderClass = 'border-l-4 border-blue-500';
      else if (message.model === Model.PRIVATE) specialBorderClass = 'border-l-4 border-slate-500';
    } else { 
      bubbleBackgroundColor = message.isTaskPlan ? '#065f46' : (message.model === Model.KLING_VIDEO && message.videoUrl ? '#312e81' : (message.model === Model.TRADING_PRO && message.tradingAnalysis ? '#3730a3' : (message.model === Model.AI_AGENT_SMART ? '#0e7490' : '#182533')));
      bubbleTextColor = '#FFFFFF';    
      audioButtonClasses = 'bg-white/20 hover:bg-white/30 text-white'; 
      timestampColor = 'rgba(156, 163, 175, 0.8)'; 
      aasButtonClasses = 'bg-accent-light hover:bg-accent text-neutral-darker';
      if (message.isTaskPlan) specialBorderClass = 'border-l-4 border-green-500';
      else if (message.model === Model.KLING_VIDEO && message.videoUrl) specialBorderClass = 'border-l-4 border-indigo-500';
      else if (message.model === Model.TRADING_PRO && message.tradingAnalysis) specialBorderClass = 'border-l-4 border-purple-500';
      else if (message.model === Model.AI_AGENT_SMART) specialBorderClass = 'border-l-4 border-cyan-500';
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
    searchHighlightStyle,
    specialBorderClass 
  ].filter(Boolean).join(' ');

  const tailClasses = "absolute bottom-0 w-3 h-3 z-0 left-[-6px]";

  const displayText = message.text;
  const taskGoalPrefix = message.isTaskGoal ? "🎯 **Goal:** " : "";
  const taskPlanPrefix = message.isTaskPlan && message.model !== Model.AI_AGENT_SMART ? "📝 **Agent Response:** " : ""; 
  const privateNotePrefix = message.isNote && message.model === Model.PRIVATE ? "📝 **Note:** ": "";
  const tradingProPrefix = message.model === Model.TRADING_PRO && message.tradingAnalysis ? `📊 **Trading Analysis (${message.tradingAnalysis.pair}):** ` : "";
  let finalDisplayText = `${taskGoalPrefix}${taskPlanPrefix}${privateNotePrefix}${tradingProPrefix}${displayText}`;

  if (message.model === Model.AI_AGENT_SMART && message.sender === 'ai') {
      finalDisplayText = displayText; 
  }


  const handleCopyText = () => {
    if (!finalDisplayText.trim()) return;
    navigator.clipboard.writeText(finalDisplayText.trim())
      .then(() => {
        setIsTextCopied(true);
        addNotification("Message copied to clipboard.", "success");
        setTimeout(() => setIsTextCopied(false), 2000);
      })
      .catch(err => {
        console.error("Failed to copy message text:", err);
        addNotification("Failed to copy message.", "error", (err as Error).message);
      });
  };

  const handleDownloadAudio = () => {
    if (!message.audioUrl) return;
    const link = document.createElement('a');
    link.href = message.audioUrl;
    
    const safePrompt = (message.originalPrompt || 'tts_audio').replace(/[^a-z0-9_.-]/gi, '_').substring(0, 50);
    const timestamp = message.id || Date.now();
    link.download = `${safePrompt}_${timestamp}.mp3`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification("Audio download started.", "success");
  };

  const handleDownloadAgentResponse = () => {
    if (!message.text || !message.promptedByMessageId) return;
    const goalText = message.originalPrompt || message.promptedByMessageId || "ai_agent_plan";
    const sanitizedGoalText = goalText.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 30);
    const fileName = `${sanitizedGoalText}_${new Date().toISOString().split('T')[0]}.txt`;
    const blob = new Blob([message.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addNotification("Agent response downloaded.", "success");
  };

  const handleDownloadFluxKontextJson = () => {
    if (message.model !== Model.FLUX_KONTEX || !message.imagePreviews || message.imagePreviews.length === 0) return;

    const jsonData = {
      model: message.model.toString(), 
      originalPrompt: message.originalPrompt || '',
      editedImageUrl: message.imagePreviews[0],
      timestamp: message.timestamp,
      fluxRequestId: message.fluxRequestId || null,
      imageMimeType: message.imageMimeType || null,
    };

    const jsonString = JSON.stringify(jsonData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const safePrompt = (message.originalPrompt || 'flux_edit').replace(/[^a-z0-9_.-]/gi, '_').substring(0, 25);
    const timestampForFile = message.id || Date.now();
    link.download = `flux_kontext_edit_${safePrompt}_${timestampForFile}.json`;
    
    link.href = href;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    addNotification("Flux Kontext edit details saved as JSON.", "success");
  };

  const handleDownloadVideo = () => {
    if (!message.videoUrl) return;
    const link = document.createElement('a');
    link.href = message.videoUrl;
    const safePrompt = (message.originalPrompt || 'kling_video').replace(/[^a-z0-9_.-]/gi, '_').substring(0, 30);
    const timestampForFile = message.id || Date.now();
    link.download = `kling_video_${safePrompt}_${timestampForFile}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addNotification("Kling AI video download started.", "success");
  };

  const handleAASButtonClick = (actionId: string, label: string) => {
    addNotification(`Action button "${label}" clicked (Action ID: ${actionId}). Feature coming soon!`, 'info');
  };


  const ActionButton: React.FC<{
    onClick?: () => void;
    disabled?: boolean;
    title: string;
    ariaLabel: string;
    children: React.ReactNode;
    className?: string;
  }> = ({ onClick, disabled, title, ariaLabel, children, className }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 disabled:opacity-30 ml-1.5 flex-shrink-0 ${className}`}
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
      aria-label={ariaLabel}
      title={title}
    >
      {children}
    </button>
  );
  
  const parsedContent = (message.model === Model.AI_AGENT_SMART && !isUser) 
    ? parseAASMessageContent(finalDisplayText) 
    : [{ type: 'regular' as const, text: finalDisplayText }];


  return (
    <div className="flex items-end space-x-2 group justify-start"> 
      <div className="w-8 h-8 flex-shrink-0"> 
        {showAvatar && (
          <div className={`w-full h-full rounded-full flex items-center justify-center ${
            isUser 
              ? (message.model === Model.PRIVATE ? 'bg-slate-200 dark:bg-slate-700' : 'bg-blue-100 dark:bg-blue-900')
              : (message.model === Model.KLING_VIDEO ? 'bg-indigo-200 dark:bg-indigo-700' 
                  : (message.model === Model.TRADING_PRO ? 'bg-purple-200 dark:bg-purple-700' 
                  : (message.model === Model.AI_AGENT_SMART ? 'bg-cyan-200 dark:bg-cyan-700' : 'bg-gray-200 dark:bg-gray-700')))
            } shadow-sm`}
            title={isUser ? 'User' : (message.model || 'AI Assistant')}
          >
            {isUser ? <UserIcon className={`w-5 h-5 ${message.model === Model.PRIVATE ? 'text-slate-600 dark:text-slate-300' : 'text-blue-600 dark:text-blue-300'}`} /> 
                     : (message.model === Model.KLING_VIDEO ? <FilmIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-300" /> 
                     : (message.model === Model.TRADING_PRO ? <PresentationChartLineIcon className="w-5 h-5 text-purple-600 dark:text-purple-300" /> 
                     : (message.model === Model.AI_AGENT_SMART ? <MapPinIcon className="w-5 h-5 text-cyan-600 dark:text-cyan-300" /> : <RobotIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />)))}
          </div>
        )}
      </div>
      <div className="flex flex-col items-start">
        <div 
          className={bubbleContentClasses}
          style={bubbleStyle}
          role="log" 
          aria-live={message.isRegenerating ? "polite" : "off"}
          aria-atomic="true"
        >
           {showAvatar && <div className={tailClasses} style={tailStyle}></div>}
          
          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
             {parsedContent.map((part, index) => {
                if (part.type === 'aas-system') {
                    return <p key={index} className="text-xs italic text-neutral-500 dark:text-neutral-400 my-1">{part.text}</p>;
                }
                if (part.type === 'aas-place-detail') {
                    return (
                        <div key={index} className="my-0.5 flex items-start">
                            <strong className="mr-1.5 flex-shrink-0">{part.label}:</strong>
                            <span>{part.value}</span>
                        </div>
                    );
                }
                if (part.type === 'aas-button') {
                    return (
                        <button
                            key={index}
                            onClick={() => handleAASButtonClick(part.actionId, part.label)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors my-1.5 inline-block shadow-sm hover:shadow-md ${aasButtonClasses}`}
                            aria-label={part.label}
                        >
                           <MapPinIcon className="w-3.5 h-3.5 inline mr-1 align-text-bottom" /> {part.label}
                        </button>
                    );
                }
                // part.type === 'regular'
                return <EnhancedMessageContent key={index} text={part.text} searchQuery={searchQuery} />;
            })}
          </div>
          
          {message.imagePreview && isUser && (
            <div className="mt-2">
              <img src={message.imagePreview} alt="Uploaded content" className="max-w-xs max-h-64 rounded-md object-contain" />
            </div>
          )}

          {message.imagePreviews && !isUser && message.model !== Model.KLING_VIDEO && message.imagePreviews.length > 0 && (
             <div className={`mt-2 grid gap-2 ${message.imagePreviews.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} place-items-center`}>
              {message.imagePreviews.map((imgStr, index) => ( 
                <div 
                  key={index} 
                  className="inline-block align-middle" 
                  onClick={() => onImageClick && onImageClick(imgStr, message.originalPrompt || '', message.imageMimeType || 'image/jpeg')}
                  role="button" tabIndex={0} aria-label={`View generated image ${index + 1}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onImageClick && onImageClick(imgStr, message.originalPrompt || '', message.imageMimeType || 'image/jpeg'); }}
                >
                  <div className="relative group/image inline-block rounded-md overflow-hidden"> 
                    <img src={imgStr} alt={`Generated art ${index + 1}`} className="block max-w-full h-auto max-h-60 rounded-md object-contain cursor-pointer" />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover/image:bg-opacity-20 transition-opacity flex items-center justify-center">
                        <PhotoIcon className="w-8 h-8 text-white opacity-0 group-hover/image:opacity-80 transform scale-75 group-hover/image:scale-100 transition-all" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
           {message.model === Model.KLING_VIDEO && message.videoUrl && !message.klingVideoRequestId && (
            <div className="mt-2">
              <video
                src={message.videoUrl}
                controls
                className="w-full max-w-md rounded-md shadow-md"
                aria-label="Generated video"
              >
                Your browser does not support the video tag.
              </video>
              <button
                onClick={handleDownloadVideo}
                className="mt-2 flex items-center px-3 py-1.5 text-xs bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md transition-colors"
                aria-label="Download video"
              >
                <ArrowDownTrayIcon className="w-4 h-4 mr-1.5" /> Download Video
              </button>
            </div>
          )}
          
          {message.fileName && isUser && message.model === Model.PRIVATE && !message.imagePreview && !message.videoFileName && (
             <div className="mt-2 p-2 bg-black/5 dark:bg-white/10 rounded-md text-xs flex items-center">
                <DocumentPlusIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
                File: <span className="truncate ml-1">{message.fileName}</span>
             </div>
          )}

          {message.videoFileName && isUser && message.model === Model.PRIVATE && (
            <div className="mt-2 p-2 bg-black/5 dark:bg-white/10 rounded-md text-xs flex items-center">
                <FilmIcon className="w-4 h-4 mr-1.5 flex-shrink-0" />
                Video: <span className="truncate ml-1">{message.videoFileName} ({message.videoMimeType || 'video/unknown'})</span>
            </div>
          )}

           {message.tradingAnalysis && (
            <div className="mt-3 p-3 border-t border-black/10 dark:border-white/10">
              {message.tradingAnalysis.chartImageUrl && (
                <img src={message.tradingAnalysis.chartImageUrl} alt={`Chart for ${message.tradingAnalysis.pair}`} className="max-w-full h-auto rounded-md mb-2 shadow" />
              )}
              {message.tradingAnalysis.trendPredictions && (
                <div className="text-xs mb-1">
                  Prediction: UP {message.tradingAnalysis.trendPredictions.up_percentage}% | 
                  DOWN {message.tradingAnalysis.trendPredictions.down_percentage}% | 
                  SIDEWAYS {message.tradingAnalysis.trendPredictions.sideways_percentage}%
                </div>
              )}
            </div>
          )}

          {message.groundingSources && message.groundingSources.length > 0 && (
            <div className="mt-2 border-t border-black/10 dark:border-white/10 pt-2">
              <p className="text-xs font-semibold mb-0.5" style={{color: bubbleTextColor === '#FFFFFF' ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)'}}>Sources:</p>
              <ul className="space-y-0.5">
                {message.groundingSources.map((source, index) => (
                  <li key={index} className="text-xs">
                    <a href={source.uri} target="_blank" rel="noopener noreferrer"
                       className="flex items-center hover:underline opacity-80 hover:opacity-100"
                       style={{color: bubbleTextColor === '#FFFFFF' ? 'rgba(200,220,255,0.9)' : 'rgba(0,50,150,0.9)' }}
                       title={source.uri}>
                      <LinkIcon className="w-3 h-3 mr-1 flex-shrink-0"/>
                      <span className="truncate">{source.title || source.uri}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {message.audioUrl && !isUser && (
             <div className="mt-2 flex items-center flex-wrap gap-2">
                <button onClick={onPlayAudio} disabled={isLoading}
                    className={`${audioButtonClasses} p-2 rounded-full transition-colors disabled:opacity-50`}
                    aria-label={isAudioPlaying ? "Stop audio playback" : "Play audio response"}
                    title={isAudioPlaying ? "Stop audio" : "Play audio"}
                >
                    {isAudioPlaying ? <StopCircleIcon className="w-5 h-5"/> : <SpeakerWaveIcon className="w-5 h-5"/>}
                </button>
                <button onClick={handleDownloadAudio} disabled={isLoading}
                    className={`${audioButtonClasses} p-2 rounded-full transition-colors disabled:opacity-50`}
                    aria-label="Download audio file"
                    title="Download audio"
                >
                    <ArrowDownTrayIcon className="w-5 h-5"/>
                </button>
                <span className="text-xs italic opacity-80" style={{color: bubbleTextColor === '#FFFFFF' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'}}>
                    Audio for: "{message.originalPrompt ? (message.originalPrompt.length > 30 ? message.originalPrompt.substring(0,27)+'...' : message.originalPrompt) : 'your prompt'}"
                </span>
             </div>
          )}

           <div className="absolute -top-1 -right-1 sm:top-0 sm:right-0 flex items-center p-0.5 sm:p-1 rounded-full transition-opacity duration-150">
              {message.text.trim() && !message.isRegenerating && (
                <ActionButton onClick={handleCopyText} title={isTextCopied ? "Copied!" : "Copy Text"} ariaLabel="Copy message text">
                  {isTextCopied ? <CheckIcon className="w-3.5 h-3.5" /> : <ClipboardIcon className="w-3.5 h-3.5" />}
                </ActionButton>
              )}
              {!isUser && onRegenerate && message.promptedByMessageId && !message.isImageQuery && !message.audioUrl && !message.isTaskPlan && message.model !== Model.AI_AGENT_SMART && !message.videoUrl && !message.tradingAnalysis && (
                <ActionButton onClick={() => onRegenerate(message.id, message.promptedByMessageId!)} disabled={isLoading} title="Regenerate Response" ariaLabel="Regenerate AI response">
                  <ArrowPathIcon className="w-3.5 h-3.5" />
                </ActionButton>
              )}
              {message.isTaskPlan && message.model !== Model.AI_AGENT_SMART && message.text.trim() && (
                 <ActionButton onClick={handleDownloadAgentResponse} title="Download Agent Response" ariaLabel="Download AI Agent response as text file">
                   <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                 </ActionButton>
              )}
              {message.model === Model.FLUX_KONTEX && message.imagePreviews && message.imagePreviews.length > 0 && !message.isRegenerating && (
                <ActionButton onClick={handleDownloadFluxKontextJson} title="Save Edit Details (JSON)" ariaLabel="Download Flux Kontext edit details as JSON file">
                  <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                </ActionButton>
              )}
          </div>
        </div>
        {message.timestamp && (
            <p 
                className="text-xs mt-0.5" 
                style={{ 
                    color: timestampColor, 
                    paddingLeft: showAvatar ? '0.75rem' : '0', 
                    paddingRight: '0'
                }}
            >
                {formatTime(message.timestamp)}
            </p>
        )}
      </div>
    </div>
  );
};


import React, { useState } from 'react';
import { ChatSession, HistoryPanelProps, Model } from '../types.ts';
import { ArchiveBoxIcon, DocumentPlusIcon, PencilSquareIcon, TrashIcon, FolderOpenIcon, ClockIcon, StarIcon } from './Icons.tsx';

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  savedSessions,
  activeSessionId,
  onLoadSession,
  onDeleteSession,
  onRenameSession,
  onSaveCurrentChat,
  onStartNewChat,
  isLoading,
  onTogglePinSession,
}) => {
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [newSessionName, setNewSessionName] = useState('');

  const handleRenameClick = (session: ChatSession) => {
    setSessionToRename(session.id);
    setNewSessionName(session.name);
  };

  const handleRenameSubmit = () => {
    if (sessionToRename && newSessionName.trim()) {
      onRenameSession(sessionToRename, newSessionName.trim());
      setSessionToRename(null);
      setNewSessionName('');
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };
  
  const getModelShortName = (modelEnumString: string): string => {
      if (!modelEnumString) return "AI";
      if (modelEnumString.startsWith(Model.GEMINI.substring(0,6))) return "Gemini";
      if (modelEnumString.startsWith(Model.GPT4O.substring(0,3))) return "GPT";
      if (modelEnumString.startsWith(Model.DEEPSEEK.substring(0,4))) return "Deepseek";
      if (modelEnumString.startsWith(Model.IMAGEN3.substring(0,6))) return "Imagen3";
      if (modelEnumString.startsWith(Model.CLAUDE.substring(0,5))) return "Claude";
      const match = modelEnumString.match(/^([^\s(]+)/);
      return match ? match[1] : "AI";
  };

  const sortedSessions = [...savedSessions].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.timestamp - a.timestamp;
  });

  return (
    <div className="space-y-4 p-1 flex flex-col h-full">
      <h2 className="text-xl font-semibold text-neutral-darker dark:text-secondary-light mb-3">Chat History</h2>

      <div className="space-y-2 mb-4">
        <button
          onClick={onSaveCurrentChat}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-dark dark:bg-primary-light dark:text-neutral-darker dark:hover:bg-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark disabled:opacity-50"
        >
          <ArchiveBoxIcon className="w-5 h-5 mr-2" />
          Save Current Chat
        </button>
        <button
          onClick={onStartNewChat}
          disabled={isLoading}
          className="w-full flex items-center justify-center px-4 py-2 border border-secondary dark:border-neutral-darkest rounded-md shadow-sm text-sm font-medium text-neutral-darker dark:text-secondary-light hover:bg-secondary/50 dark:hover:bg-neutral-dark/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-dark disabled:opacity-50"
        >
          <DocumentPlusIcon className="w-5 h-5 mr-2" />
          Start New Chat
        </button>
      </div>

      {sortedSessions.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-4">No saved chats yet.</p>
      )}

      <div className="flex-grow overflow-y-auto space-y-2 pr-1">
        {sortedSessions.map((session) => (
          <div
            key={session.id}
            className={`p-3 rounded-md border relative ${
              session.id === activeSessionId
                ? 'bg-primary-light/20 border-primary dark:bg-primary-dark/30 dark:border-primary-light'
                : 'bg-neutral-light dark:bg-neutral-darker border-secondary dark:border-neutral-darkest hover:bg-secondary/30 dark:hover:bg-neutral-dark/30'
            } ${session.isPinned ? 'border-l-4 border-l-accent dark:border-l-accent-light' : ''}`}
          >
            <button
                onClick={() => onTogglePinSession(session.id)}
                disabled={isLoading}
                className={`absolute top-2 right-2 p-1 rounded-full hover:bg-gray-300 dark:hover:bg-neutral-500 
                            ${session.isPinned ? 'text-accent dark:text-accent-light' : 'text-gray-400 dark:text-neutral-400'}`}
                title={session.isPinned ? "Unpin Chat" : "Pin Chat"}
                aria-label={session.isPinned ? "Unpin chat session" : "Pin chat session"}
            >
                <StarIcon className="w-4 h-4" solid={session.isPinned} />
            </button>
            {sessionToRename === session.id ? (
              <div className="space-y-2 mt-1">
                <input
                  type="text"
                  value={newSessionName}
                  onChange={(e) => setNewSessionName(e.target.value)}
                  className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-white dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-sm"
                  autoFocus
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleRenameSubmit}
                    className="px-2 py-1 text-xs bg-green-500 hover:bg-green-600 text-white rounded"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setSessionToRename(null)}
                    className="px-2 py-1 text-xs bg-gray-300 hover:bg-gray-400 dark:bg-neutral-500 dark:hover:bg-neutral-600 text-black dark:text-white rounded"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="font-medium text-sm text-neutral-darker dark:text-secondary-light truncate pr-16" title={session.name}>
                  {session.name}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                  <ClockIcon className="w-3 h-3 mr-1" /> {formatDate(session.timestamp)} 
                  <span className="mx-1">|</span>
                  {getModelShortName(session.model)}
                </p>
                <div className="mt-2 flex space-x-1 justify-end">
                  <button
                    onClick={() => onLoadSession(session.id)}
                    disabled={isLoading || session.id === activeSessionId}
                    className="p-1.5 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Load Chat"
                    aria-label="Load chat session"
                  >
                    <FolderOpenIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleRenameClick(session)}
                    disabled={isLoading}
                    className="p-1.5 text-xs text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-300 rounded disabled:opacity-50"
                    title="Rename Chat"
                     aria-label="Rename chat session"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDeleteSession(session.id)}
                    disabled={isLoading}
                    className="p-1.5 text-xs text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 rounded disabled:opacity-50"
                    title="Delete Chat"
                    aria-label="Delete chat session"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;

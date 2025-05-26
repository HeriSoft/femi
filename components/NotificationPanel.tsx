
import React from 'react';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { NotificationMessage, NotificationType } from '../types.ts';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, TrashIcon, XMarkIcon } from './Icons.tsx';

interface NotificationPanelProps {
  onClose: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ onClose }) => {
  const { notifications, clearAllNotifications } = useNotification();

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'info':
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffSeconds = Math.round((now.getTime() - then.getTime()) / 1000);

    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.round(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    // For older dates, show date and time
    return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 max-h-[70vh] bg-neutral-light dark:bg-neutral-darker border border-secondary dark:border-neutral-darkest rounded-lg shadow-xl z-50 flex flex-col">
      <div className="flex justify-between items-center p-3 border-b border-secondary dark:border-neutral-darkest">
        <h3 className="text-md font-semibold text-neutral-darker dark:text-secondary-light">Notifications</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-secondary dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light"
          aria-label="Close notifications panel"
        >
          <XMarkIcon className="w-5 h-5" />
        </button>
      </div>

      {notifications.length === 0 ? (
        <p className="p-4 text-sm text-center text-neutral-500 dark:text-neutral-400">No new notifications.</p>
      ) : (
        <div className="overflow-y-auto flex-grow p-1">
          {notifications.map((n: NotificationMessage) => (
            <div
              key={n.id}
              className={`p-2.5 border-b border-secondary/50 dark:border-neutral-dark/50 last:border-b-0 flex items-start space-x-2.5 ${
                !n.read ? 'bg-primary-light/10 dark:bg-primary-dark/20' : ''
              }`}
            >
              <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
              <div className="flex-grow">
                <p className={`text-sm ${
                    n.type === 'error' ? 'text-red-700 dark:text-red-400' 
                    : 'text-neutral-darker dark:text-secondary-light'
                } break-words`}>
                  {n.message}
                </p>
                {n.details && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 break-all">
                        Details: {n.details}
                    </p>
                )}
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                  {formatTimestamp(n.timestamp)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {notifications.length > 0 && (
        <div className="p-2 border-t border-secondary dark:border-neutral-darkest">
          <button
            onClick={clearAllNotifications}
            className="w-full flex items-center justify-center px-3 py-1.5 text-xs text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-900/50 rounded-md transition-colors"
          >
            <TrashIcon className="w-3.5 h-3.5 mr-1.5" /> Clear All Notifications
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;


import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { NotificationMessage, NotificationType, NotificationContextType } from '../types.ts';
import { LOCAL_STORAGE_NOTIFICATIONS_KEY, MAX_NOTIFICATIONS } from '../constants.ts';

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<NotificationMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    try {
      const storedNotifications = localStorage.getItem(LOCAL_STORAGE_NOTIFICATIONS_KEY);
      if (storedNotifications) {
        const parsedNotifications: NotificationMessage[] = JSON.parse(storedNotifications);
        setNotifications(parsedNotifications);
        setUnreadCount(parsedNotifications.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error("Error loading notifications from localStorage:", error);
      // Potentially add a notification about this error, carefully to avoid loops
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
    } catch (error) {
      console.error("Error saving notifications to localStorage:", error);
    }
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const addNotification = useCallback((message: string, type: NotificationType, details?: string) => {
    const newNotification: NotificationMessage = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      message,
      type,
      timestamp: Date.now(),
      read: false,
      details,
    };
    setNotifications(prev => [newNotification, ...prev.slice(0, MAX_NOTIFICATIONS - 1)]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        addNotification,
        markAllAsRead,
        clearAllNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

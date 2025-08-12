import React, { useState, useEffect, useCallback } from 'react';
import { Model, getActualModelIdentifier, ApiChatMessage, UserSessionState, ModelSettings } from '../types.ts';
import { useNotification } from '../contexts/NotificationContext.tsx';
import { sendGeminiMessageStream } from '../services/geminiService.ts';
import { sendOpenAIMessageStream } from '../services/openaiService.ts';
import { GlobeAltIcon, FilmIcon, SunIcon, MapPinIcon, ArrowDownTrayIcon } from './Icons.tsx';
import { EnhancedMessageContent } from './MessageBubble.tsx';
import type { Content } from '@google/genai';

interface AdvancedToolsViewProps {
  userSession: UserSessionState;
  addNotification: (message: string, type: 'success' | 'error' | 'info' | 'warning', details?: string) => void;
}

// IP Info Tool Component
const IpInfoTool: React.FC<{ addNotification: AdvancedToolsViewProps['addNotification'] }> = ({ addNotification }) => {
  const [ipInfo, setIpInfo] = useState<{ ip: string; country: string; city: string; flag: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchIpInfo = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tools/ip-info', { method: 'POST' });
      const data = await response.json();
      if (response.ok) {
        // Simple country code to flag emoji conversion
        const flag = data.countryCode ? data.countryCode.toUpperCase().replace(/./g, (char: string) => String.fromCodePoint(char.charCodeAt(0) + 127397)) : '🏳️';
        setIpInfo({ ...data, flag });
      } else {
        throw new Error(data.error || 'Failed to fetch IP information.');
      }
    } catch (error: any) {
      addNotification('Error fetching IP info', 'error', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    fetchIpInfo();
  }, [fetchIpInfo]);

  return (
    <div className="bg-secondary/30 dark:bg-neutral-dark/30 p-4 rounded-lg shadow-sm">
      <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3 flex items-center">
        <GlobeAltIcon className="w-5 h-5 mr-2" /> My IP Information
      </h3>
      <div className="space-y-2 text-sm">
        {isLoading ? (
          <p className="animate-pulse">Fetching IP data...</p>
        ) : ipInfo ? (
          <>
            <p><strong>Your IP Address:</strong> {ipInfo.ip}</p>
            <p><strong>City:</strong> {ipInfo.city}</p>
            <p><strong>Country:</strong> {ipInfo.flag} {ipInfo.country}</p>
          </>
        ) : (
          <p className="text-red-500">Could not retrieve IP information.</p>
        )}
      </div>
      <button onClick={fetchIpInfo} disabled={isLoading} className="mt-4 px-4 py-1.5 text-xs bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50">
        Refresh
      </button>
    </div>
  );
};

// Video Downloader Tool Component
const VideoDownloaderTool: React.FC<{ addNotification: AdvancedToolsViewProps['addNotification'] }> = ({ addNotification }) => {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleDownload = async (format: 'mp3' | 'mp4' | 'bilibili') => {
        if (!url.trim() || !/^https?:\/\//.test(url.trim())) {
            addNotification('Please enter a valid video URL.', 'error');
            return;
        }
        setIsLoading(true);
        addNotification(`Requesting ${format === 'mp3' ? 'MP3' : 'Video'} download... This may take a moment.`, 'info');

        try {
            const response = await fetch('/api/tools/download-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, format }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred on the server.' }));
                throw new Error(errorData.error || `Server responded with status ${response.status}`);
            }

            const disposition = response.headers.get('content-disposition');
            let filename = `video.${format === 'mp3' ? 'mp3' : 'mp4'}`;
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = decodeURIComponent(matches[1].replace(/['"]/g, ''));
                }
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(downloadUrl);
            
            addNotification('Download started successfully!', 'success');

        } catch (error: any) {
            addNotification('Failed to download video.', 'error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-secondary/30 dark:bg-neutral-dark/30 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3 flex items-center">
                <FilmIcon className="w-5 h-5 mr-2" /> Video Downloader
            </h3>
            <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter YouTube or Bilibili URL"
                className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark text-sm mb-3"
                disabled={isLoading}
            />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button onClick={() => handleDownload('mp3')} disabled={isLoading} className="px-3 py-2 text-xs bg-orange-500 hover:bg-orange-600 text-white rounded-md disabled:opacity-50 flex items-center justify-center">
                    <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> YouTube MP3
                </button>
                <button onClick={() => handleDownload('mp4')} disabled={isLoading} className="px-3 py-2 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md disabled:opacity-50 flex items-center justify-center">
                    <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> YouTube MP4
                </button>
                <button onClick={() => handleDownload('bilibili')} disabled={isLoading} className="px-3 py-2 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md disabled:opacity-50 flex items-center justify-center">
                    <ArrowDownTrayIcon className="w-4 h-4 mr-1" /> Bilibili [VIP]
                </button>
            </div>
        </div>
    );
};

// Weather Tool Component
const WeatherTool: React.FC<AdvancedToolsViewProps> = ({ userSession, addNotification }) => {
    const [location, setLocation] = useState('');
    const [weatherResult, setWeatherResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGetWeather = async () => {
        if (!location.trim()) {
            addNotification('Please enter a location.', 'error');
            return;
        }
        setIsLoading(true);
        setWeatherResult('');
        try {
            const prompt = `Provide a weather forecast for "${location}". Include current temperature (in Celsius), conditions (e.g., sunny, cloudy), wind speed, and a brief 3-day outlook. Format the response nicely.`;
            const modelIdentifier = getActualModelIdentifier(Model.GEMINI);
            const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
            const stream = sendGeminiMessageStream({
                modelName: modelIdentifier,
                historyContents: history,
                modelSettings: { temperature: 0.3, topK: 32, topP: 0.95, systemInstruction: "You are a helpful weather assistant." },
                enableGoogleSearch: true,
                userSession
            });

            for await (const chunk of stream) {
                if (chunk.error) throw new Error(chunk.error);
                if (chunk.textDelta) {
                    setWeatherResult(prev => prev + chunk.textDelta);
                }
            }
        } catch (error: any) {
            addNotification('Failed to get weather forecast.', 'error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-secondary/30 dark:bg-neutral-dark/30 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3 flex items-center">
                <SunIcon className="w-5 h-5 mr-2" /> Weather Forecast
            </h3>
            <div className="flex gap-2">
                <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter city or location"
                    className="flex-grow p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark text-sm"
                    disabled={isLoading}
                    onKeyPress={(e) => {if(e.key === 'Enter') handleGetWeather()}}
                />
                <button onClick={handleGetWeather} disabled={isLoading} className="px-4 py-2 text-sm bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50">
                    Get
                </button>
            </div>
            {isLoading && !weatherResult && <p className="mt-3 text-sm animate-pulse">Fetching forecast...</p>}
            {weatherResult && (
                <div className="mt-3 p-3 bg-neutral-light dark:bg-neutral-dark rounded-md border border-secondary dark:border-neutral-darkest prose prose-sm dark:prose-invert max-w-none">
                   <EnhancedMessageContent text={weatherResult} />
                </div>
            )}
        </div>
    );
};

// Directions Tool Component
const DirectionsTool: React.FC<AdvancedToolsViewProps> = ({ userSession, addNotification }) => {
    const [start, setStart] = useState('');
    const [destination, setDestination] = useState('');
    const [directionsResult, setDirectionsResult] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleGetDirections = async () => {
        if (!start.trim() || !destination.trim()) {
            addNotification('Please enter both start and destination.', 'error');
            return;
        }
        setIsLoading(true);
        setDirectionsResult('');
        try {
            const prompt = `Provide clear, step-by-step driving directions from "${start}" to a destination described as "${destination}". Format the response as a numbered list.`;
            const modelIdentifier = getActualModelIdentifier(Model.GPT4O_MINI);
            const history: ApiChatMessage[] = [
                { role: 'system', content: 'You are a helpful directions assistant.' },
                { role: 'user', content: prompt }
            ];
            const stream = sendOpenAIMessageStream({
                modelIdentifier,
                history,
                modelSettings: { temperature: 0.2, topK: 40, topP: 0.9, systemInstruction: "Provide driving directions." },
                userSession
            });
            for await (const chunk of stream) {
                if (chunk.error) throw new Error(chunk.error);
                if (chunk.textDelta) {
                    setDirectionsResult(prev => prev + chunk.textDelta);
                }
            }
        } catch (error: any) {
            addNotification('Failed to get directions.', 'error', error.message);
        } finally {
            setIsLoading(false);
        }
    };

    const useCurrentLocation = () => {
        if (!navigator.geolocation) {
            addNotification("Geolocation is not supported by your browser.", "error");
            return;
        }
        addNotification("Getting your location...", "info");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setStart(`Lat: ${latitude.toFixed(5)}, Lon: ${longitude.toFixed(5)}`);
                addNotification("Location set successfully!", "success");
            },
            (error) => {
                addNotification("Could not get location.", "error", error.message);
            }
        );
    };

    return (
        <div className="bg-secondary/30 dark:bg-neutral-dark/30 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-3 flex items-center">
                <MapPinIcon className="w-5 h-5 mr-2" /> Get Directions
            </h3>
            <div className="space-y-3">
                <div className="flex gap-2 items-center">
                    <input
                        type="text"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        placeholder="Your start location"
                        className="flex-grow p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark text-sm"
                        disabled={isLoading}
                    />
                    <button onClick={useCurrentLocation} disabled={isLoading} className="p-2 bg-secondary dark:bg-neutral-darkest rounded-md" title="Use Current Location">
                        <MapPinIcon className="w-5 h-5"/>
                    </button>
                </div>
                <textarea
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Where do you want to go?"
                    rows={2}
                    className="w-full p-2 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark text-sm"
                    disabled={isLoading}
                />
                <button onClick={handleGetDirections} disabled={isLoading} className="w-full px-4 py-2 text-sm bg-primary hover:bg-primary-dark text-white rounded-md disabled:opacity-50">
                    Find Route
                </button>
            </div>
            {isLoading && !directionsResult && <p className="mt-3 text-sm animate-pulse">Finding directions...</p>}
            {directionsResult && (
                <div className="mt-3 p-3 bg-neutral-light dark:bg-neutral-dark rounded-md border border-secondary dark:border-neutral-darkest prose prose-sm dark:prose-invert max-w-none">
                    <EnhancedMessageContent text={directionsResult} />
                </div>
            )}
        </div>
    );
};


const AdvancedToolsView: React.FC<AdvancedToolsViewProps> = ({ userSession, addNotification }) => {
  return (
    <div className="flex-grow p-4 overflow-y-auto space-y-6 bg-neutral-light dark:bg-neutral-darker">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-primary dark:text-primary-light">Advanced Tools</h2>
        <p className="text-neutral-500 dark:text-neutral-400">A suite of utilities to enhance your experience.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
        <IpInfoTool addNotification={addNotification} />
        <VideoDownloaderTool addNotification={addNotification} />
        <WeatherTool userSession={userSession} addNotification={addNotification} />
        <DirectionsTool userSession={userSession} addNotification={addNotification} />
      </div>
    </div>
  );
};

export default AdvancedToolsView;
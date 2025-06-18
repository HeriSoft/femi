
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TradingProSettings, TradingProState, TradingPair, AlphaVantageTimeSeries, UserSessionState, GroundingSource } from '../types.ts';
import { TRADING_PRO_PAIRS, TRADING_PRO_DISCLAIMER } from '../constants.ts';
import TradingChart, { TradingChartRef } from './TradingChart.tsx';
import { InformationCircleIcon, PresentationChartLineIcon, XMarkIcon, LinkIcon } from './Icons.tsx';
import { EnhancedMessageContent } from './MessageBubble.tsx';

interface TradingProViewProps {
  settings: TradingProSettings;
  onSettingsChange: (newSettings: Partial<TradingProSettings>) => void;
  tradingProState: TradingProState;
  setTradingProState: React.Dispatch<React.SetStateAction<TradingProState>>;
  fetchChartData: (pair: TradingPair) => Promise<void>;
  handleAnalysis: (pair: TradingPair, chartImageBase64: string | null) => Promise<void>;
  userSession: UserSessionState;
}

const TradingProView: React.FC<TradingProViewProps> = ({
  settings,
  onSettingsChange,
  tradingProState,
  setTradingProState,
  fetchChartData,
  handleAnalysis,
  userSession 
}) => {
  const [showDisclaimer, setShowDisclaimer] = useState(!tradingProState.disclaimerAgreed);
  const chartComponentRef = useRef<TradingChartRef>(null);

  const fetchChartDataCb = useCallback(fetchChartData, []); // Memoize fetchChartData

  useEffect(() => {
    if (settings.selectedPair && tradingProState.disclaimerAgreed && !tradingProState.chartData && !tradingProState.isLoadingChart && !tradingProState.analysisError?.includes('Chart Data Error')) {
      fetchChartDataCb(TRADING_PRO_PAIRS.find(p => p.value === settings.selectedPair)!);
    }
  }, [settings.selectedPair, tradingProState.disclaimerAgreed, fetchChartDataCb, tradingProState.chartData, tradingProState.isLoadingChart, tradingProState.analysisError]);

  useEffect(() => {
    setShowDisclaimer(!tradingProState.disclaimerAgreed);
  }, [tradingProState.disclaimerAgreed]);

  const handlePairChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPairValue = event.target.value as TradingPair['value'] | "";
    const newSelectedPairObject = TRADING_PRO_PAIRS.find(p => p.value === newPairValue) || null;
    
    onSettingsChange({ selectedPair: newSelectedPairObject ? newSelectedPairObject.value : null });
    setTradingProState(prev => ({
      ...prev,
      selectedPair: newSelectedPairObject ? newSelectedPairObject.value : null,
      chartData: null,
      chartImageUrl: null,
      analysisText: null,
      trendPredictions: null,
      analysisError: null,
      groundingSources: undefined,
      isLoadingChart: newSelectedPairObject !== null && prev.disclaimerAgreed,
    }));

    if (newSelectedPairObject !== null && tradingProState.disclaimerAgreed) {
      fetchChartDataCb(newSelectedPairObject);
    } else if (newSelectedPairObject !== null && !tradingProState.disclaimerAgreed) {
        setShowDisclaimer(true);
    }
  };

  const handleDisclaimerAgree = () => {
    setTradingProState(prev => ({ ...prev, disclaimerAgreed: true }));
    setShowDisclaimer(false);
    const currentSelectedPairObject = TRADING_PRO_PAIRS.find(p => p.value === settings.selectedPair);
    if (currentSelectedPairObject && !tradingProState.chartData && !tradingProState.isLoadingChart) {
      fetchChartDataCb(currentSelectedPairObject);
    }
  };
  
  const memoizedOnChartRendered = useCallback((base64Image: string | null) => {
    if (base64Image) {
        setTradingProState(prev => {
            if (prev.chartImageUrl !== base64Image) {
                return {...prev, chartImageUrl: base64Image};
            }
            return prev; // No change needed
        });
    }
  // tradingProState.chartImageUrl is included to allow comparison, 
  // but setTradingProState itself is stable and doesn't need to be a dependency.
  // If we only want this to update once per chart data change, we might adjust dependencies.
  // However, for ensuring the image URL is always current IF IT CHANGES after render, this is okay.
  // The critical fix is that the function reference itself is stable.
  }, [setTradingProState]);


  const onAnalyzeClick = async () => {
    const currentSelectedPairObject = TRADING_PRO_PAIRS.find(p => p.value === settings.selectedPair);
    if (!currentSelectedPairObject) {
      setTradingProState(prev => ({ ...prev, analysisError: "Please select a trading pair first." }));
      return;
    }
    if (!tradingProState.disclaimerAgreed) {
      setShowDisclaimer(true);
      return;
    }
    if (tradingProState.isLoadingChart || tradingProState.isLoadingAnalysis) {
        return; 
    }

    let currentChartImage = tradingProState.chartImageUrl;
    if (!currentChartImage && chartComponentRef.current) {
        currentChartImage = chartComponentRef.current.getChartAsBase64();
    }
    
    if (!currentChartImage) {
        const errorMsg = tradingProState.chartData 
            ? "Chart image is not ready. Please wait for the chart to render fully."
            : "Chart data not loaded. Cannot generate analysis.";
        setTradingProState(prev => ({ ...prev, analysisError: errorMsg }));
        return;
    }
    
    setTradingProState(prev => ({ 
      ...prev, 
      isLoadingAnalysis: true, 
      analysisError: null, 
      analysisText: null, 
      trendPredictions: null,
      groundingSources: undefined,
      chartImageUrl: currentChartImage // Ensure the image used for analysis is stored if freshly captured
    }));
    await handleAnalysis(currentSelectedPairObject, currentChartImage);
  };

  const isAnalyzeButtonDisabled = 
    !settings.selectedPair || 
    !tradingProState.disclaimerAgreed ||
    tradingProState.isLoadingChart || 
    tradingProState.isLoadingAnalysis ||
    (!tradingProState.chartData && !tradingProState.chartImageUrl); 


  if (showDisclaimer) {
    return (
      <div className="flex-grow p-4 sm:p-6 flex flex-col items-center justify-center bg-neutral-light dark:bg-neutral-darker text-center">
        <InformationCircleIcon className="w-12 h-12 text-yellow-500 dark:text-yellow-400 mb-4" />
        <h3 className="text-xl font-semibold text-neutral-darker dark:text-secondary-light mb-3">Important Disclaimer</h3>
        <div className="max-w-lg text-sm text-neutral-600 dark:text-neutral-400 mb-6 whitespace-pre-line leading-relaxed">
          {TRADING_PRO_DISCLAIMER}
        </div>
        <button
          onClick={handleDisclaimerAgree}
          className="px-8 py-3 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-lg text-base font-medium transition-colors"
        >
          I Understand and Agree
        </button>
      </div>
    );
  }

  return (
    <div className="flex-grow p-3 sm:p-4 flex flex-col overflow-y-auto space-y-4">
      <div>
        <label htmlFor="trading-pair-select-view" className="block text-sm font-medium text-neutral-darker dark:text-secondary-light mb-1">
          Select Trading Pair:
        </label>
        <select
          id="trading-pair-select-view"
          value={settings.selectedPair || ""}
          onChange={handlePairChange}
          className="w-full sm:w-auto p-2.5 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark focus:ring-primary dark:focus:ring-primary-light focus:border-primary dark:focus:border-primary-light outline-none text-neutral-darker dark:text-secondary-light"
        >
          <option value="" disabled>-- Select a Pair --</option>
          {TRADING_PRO_PAIRS.map(pair => (
            <option key={pair.value} value={pair.value}>{pair.label}</option>
          ))}
        </select>
      </div>

      {settings.selectedPair && (
        <>
          <div className="h-64 md:h-80 lg:h-96 bg-secondary/30 dark:bg-neutral-dark/20 p-1 sm:p-2 rounded-md shadow-inner">
            <TradingChart
              ref={chartComponentRef}
              chartData={tradingProState.chartData}
              isLoading={tradingProState.isLoadingChart}
              pairLabel={TRADING_PRO_PAIRS.find(p => p.value === settings.selectedPair)?.label || settings.selectedPair}
              onChartRendered={memoizedOnChartRendered}
            />
          </div>
          
          <button
            onClick={onAnalyzeClick}
            disabled={isAnalyzeButtonDisabled}
            className="w-full sm:w-auto px-6 py-2.5 bg-accent hover:bg-accent-dark text-white rounded-md text-base font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center"
            aria-label="Analyze market for selected pair"
            aria-disabled={isAnalyzeButtonDisabled}
          >
            <PresentationChartLineIcon className="w-5 h-5 mr-2" />
            {tradingProState.isLoadingAnalysis ? "Analyzing..." : "Analyze Market"}
          </button>

          {tradingProState.analysisError && (
            <div className="p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-600 rounded-md text-red-700 dark:text-red-300 text-sm" role="alert">
              <XMarkIcon className="w-5 h-5 inline mr-1.5 align-text-bottom" />
              {tradingProState.analysisError}
            </div>
          )}

          {tradingProState.isLoadingAnalysis && !tradingProState.analysisError && (
             <div className="flex items-center justify-center p-4 text-neutral-600 dark:text-neutral-300" role="status" aria-live="polite">
                <svg aria-hidden="true" className="animate-spin -ml-1 mr-3 h-5 w-5 text-primary dark:text-primary-light" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating analysis... This may take a moment.
            </div>
          )}

          {tradingProState.analysisText && !tradingProState.isLoadingAnalysis && (
            <div className="p-3 border border-secondary dark:border-neutral-darkest rounded-md bg-neutral-light dark:bg-neutral-dark shadow-sm">
              <h4 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light mb-2">AI Analysis:</h4>
              <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed text-neutral-700 dark:text-neutral-200">
                <EnhancedMessageContent text={tradingProState.analysisText} />
              </div>
              {tradingProState.trendPredictions && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 rounded-md">
                  <h5 className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Trend Prediction (Next 1-7 Days):</h5>
                  <p className="text-sm text-blue-600 dark:text-blue-200">
                    TĂNG (UP): <span className="font-bold">{tradingProState.trendPredictions.up}%</span> | 
                    GIẢM (DOWN): <span className="font-bold">{tradingProState.trendPredictions.down}%</span> | 
                    ĐI NGANG (SIDEWAYS): <span className="font-bold">{tradingProState.trendPredictions.sideways}%</span>
                  </p>
                </div>
              )}
              {tradingProState.groundingSources && tradingProState.groundingSources.length > 0 && (
                <div className="mt-4">
                  <h5 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 mb-1">Sources:</h5>
                  <ul className="space-y-1">
                    {tradingProState.groundingSources.map((source: GroundingSource, index: number) => (
                      <li key={index} className="text-xs">
                        <a href={source.uri} target="_blank" rel="noopener noreferrer"
                          className="flex items-center text-accent dark:text-accent-light hover:underline opacity-90 hover:opacity-100"
                          title={source.uri}>
                          <LinkIcon className="w-3 h-3 mr-1 flex-shrink-0" />
                          <span className="truncate">{source.title || source.uri}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TradingProView;

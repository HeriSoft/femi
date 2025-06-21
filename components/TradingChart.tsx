
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useLayoutEffect, useContext } from 'react';
import Chart from "chart.js/auto"; // This should handle Colors and core components
import 'chartjs-adapter-date-fns'; 
// Import directly from the source ESM index file within the package
import {
  CandlestickController,
  CandlestickElement,
  OhlcController,
  OhlcElement
} from 'chart.js-chart-financial/src/index.esm.js'; // Target specific ESM entry

import { AlphaVantageTimeSeries, AlphaVantageCandle, ThemeContextType, CandlestickPoint } from '../types.ts';
import { InformationCircleIcon } from './Icons.tsx';
import { ThemeContext } from '../App.tsx'; 

// Explicitly register the financial chart components
Chart.register(CandlestickController, CandlestickElement, OhlcController, OhlcElement);

interface TradingChartProps {
  chartData: AlphaVantageTimeSeries | null;
  isLoading: boolean;
  pairLabel: string;
  onChartRendered?: (base64Image: string | null) => void;
}

export interface TradingChartRef {
  getChartAsBase64: () => string | null;
}

const TradingChart = forwardRef<TradingChartRef, TradingChartProps>(({ chartData, isLoading, pairLabel, onChartRendered }, ref) => {
  const chartContainerRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<Chart<'candlestick', CandlestickPoint[], unknown> | null>(null);
  const [chartError, setChartError] = useState<string | null>(null);
  const themeContext = useContext(ThemeContext);


  useImperativeHandle(ref, () => ({
    getChartAsBase64: () => {
      if (chartInstanceRef.current && chartInstanceRef.current.canvas) {
        try {
          const canvas = chartInstanceRef.current.canvas;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-over';
            const currentTheme = themeContext?.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
            ctx.fillStyle = currentTheme === 'dark' ? '#1A202C' : '#FFFFFF'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
          }
          return chartInstanceRef.current.toBase64Image('image/png');
        } catch (e) {
          console.error("Error getting chart as base64:", e);
          setChartError("Error exporting chart image.");
          return null;
        }
      }
      setChartError("Chart instance not available for image export.");
      return null;
    },
  }));

  useLayoutEffect(() => {
    if (isLoading || !chartData || Object.keys(chartData).length === 0) {
        if (chartInstanceRef.current) { 
            chartInstanceRef.current.destroy();
            chartInstanceRef.current = null;
        }
        if (chartError === "Chart canvas container not found, though expected." || chartError?.startsWith("Error rendering chart")) {
            setChartError(null);
        }
        return;
    }

    if (!chartContainerRef.current) {
        setChartError("Chart canvas container not found, though expected.");
        return;
    }
    
    if (chartError) { 
        setChartError(null);
    }

    if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
    }
    
    const labels = Object.keys(chartData).sort((a,b) => new Date(a).getTime() - new Date(b).getTime());
    const dataPoints: CandlestickPoint[] = labels.map(label => {
      const candle: AlphaVantageCandle = chartData[label];
      return {
        x: new Date(label).getTime(),
        o: parseFloat(candle['1. open']),
        h: parseFloat(candle['2. high']),
        l: parseFloat(candle['3. low']),
        c: parseFloat(candle['4. close']),
      };
    });

    const currentTheme = themeContext?.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    const isDarkMode = currentTheme === 'dark';
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? 'rgba(229, 231, 235, 0.8)' : 'rgba(55, 65, 81, 0.9)';

    const candlestickData = {
      datasets: [{
        label: `${pairLabel} Candlestick`,
        data: dataPoints,
        color: { 
            up: isDarkMode ? 'rgba(74, 222, 128, 0.8)' : 'rgba(34, 197, 94, 0.8)', 
            down: isDarkMode ? 'rgba(248, 113, 113, 0.8)' : 'rgba(239, 68, 68, 0.8)', 
            unchanged: isDarkMode ? 'rgba(156, 163, 175, 0.8)' : 'rgba(107, 114, 128, 0.8)', 
        },
        borderColor: isDarkMode ? 'rgba(203, 213, 225, 0.7)' : 'rgba(55, 65, 81, 0.7)', 
      }]
    };

    const isDailyData = labels.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(labels[0].split(' ')[0]); 
    let timeUnit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year' = 'day';
    if (!isDailyData && dataPoints.length > 0) { 
        const timeDiff = dataPoints[dataPoints.length - 1].x - dataPoints[0].x;
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        if (daysDiff > 90) timeUnit = 'week';
        else if (daysDiff > 7) timeUnit = 'day';
        else if (dataPoints.length > 50 && daysDiff > 0.5) timeUnit = 'hour'; 
        else timeUnit = 'minute'; 
    }


    try {
        const ctx = chartContainerRef.current.getContext('2d');
        if (!ctx) {
            setChartError("Failed to get canvas context for chart creation.");
            return;
        }
        chartInstanceRef.current = new Chart(ctx, {
            type: 'candlestick',
            data: candlestickData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: timeUnit,
                            tooltipFormat: isDailyData ? 'MMM d, yyyy' : 'MMM d, yyyy HH:mm',
                            displayFormats: {
                                minute: isDailyData ? 'MMM d' : 'HH:mm',
                                hour: isDailyData ? 'MMM d' : 'HH:mm', 
                                day: 'MMM d',
                                week: 'MMM d, yy',
                                month: 'MMM yyyy',
                                quarter: 'QQQ yyyy',
                                year: 'yyyy',
                            }
                        },
                        title: { display: true, text: 'Time', color: textColor },
                        grid: { color: gridColor },
                        border: { display: true, color: gridColor },
                        ticks: { color: textColor, maxRotation: 0, autoSkip: true, autoSkipPadding: 30, source: 'auto' }
                    },
                    y: {
                        title: { display: true, text: 'Price (USD)', color: textColor },
                        grid: { color: gridColor },
                        border: { display: true, color: gridColor },
                        ticks: { color: textColor, callback: function(value) { return '$' + (typeof value === 'number' ? value.toFixed(2) : value); } }
                    }
                },
                plugins: {
                    legend: { display: true, position: 'top', labels: { color: textColor, font: {size: 10} } },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: isDarkMode ? 'rgba(30,41,59,0.9)' : 'rgba(255,255,255,0.9)',
                        titleColor: isDarkMode ? '#e2e8f0' : '#1f2937',
                        bodyColor: isDarkMode ? '#cbd5e1' : '#374151',
                        borderColor: isDarkMode ? '#334155' : '#e5e7eb',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context: any) {
                                const raw = context.raw as CandlestickPoint; 
                                if (raw && typeof raw.o === 'number') {
                                    return [
                                        `Open: ${raw.o.toFixed(2)}`,
                                        `High: ${raw.h.toFixed(2)}`,
                                        `Low: ${raw.l.toFixed(2)}`,
                                        `Close: ${raw.c.toFixed(2)}`,
                                    ];
                                }
                                return context.dataset.label + ': ' + context.formattedValue;
                            }
                        }
                    },
                    chartAreaPainter: { 
                        color: isDarkMode ? '#1A202C' : '#FFFFFF',
                    } as any, 
                },
                animation: {
                    duration: 300,
                    onComplete: (animation) => {
                        if (onChartRendered && animation.chart && chartInstanceRef.current) {
                            const chart = chartInstanceRef.current;
                            const canvas = chart.canvas;
                            const chartCtx = canvas.getContext('2d');
                            if (chartCtx) {
                                chartCtx.save();
                                chartCtx.globalCompositeOperation = 'destination-over';
                                const currentThemeForRender = themeContext?.theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
                                chartCtx.fillStyle = currentThemeForRender === 'dark' ? '#1A202C' : '#FFFFFF'; 
                                chartCtx.fillRect(0, 0, canvas.width, canvas.height);
                                chartCtx.restore();
                            }
                           onChartRendered(chart.toBase64Image('image/png') || null);
                        }
                    }
                },
            }
        });
    } catch (e: any) {
        console.error("Error creating chart:", e);
        setChartError(`Error rendering chart: ${e.message || String(e)}`);
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartData, pairLabel, isLoading, onChartRendered, themeContext?.theme]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center text-neutral-500 dark:text-neutral-400" role="status">
        <svg aria-hidden="true" className="animate-spin -ml-1 mr-3 h-6 w-6 text-primary dark:text-primary-light" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        Loading chart data for {pairLabel}...
      </div>
    );
  }

  if (chartError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-red-600 dark:text-red-400 p-4" role="alert">
        <InformationCircleIcon className="w-8 h-8 mb-2" />
        <p className="font-semibold">Chart Error</p>
        <p className="text-sm text-center">{chartError}</p>
      </div>
    );
  }

  if (!chartData && !isLoading) { 
    return (
         <div className="w-full h-full flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400 p-4 text-center">
            <InformationCircleIcon className="w-8 h-8 mb-2" />
            <p>No data available to display chart for {pairLabel}.</p>
            <p className="text-xs mt-1">This might be due to API limits, data unavailability for the selected pair/interval, or an error during data fetching. Check messages in the main view.</p>
        </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <canvas ref={chartContainerRef} aria-label={`${pairLabel} price chart`}></canvas>
    </div>
  );
});

export default TradingChart;
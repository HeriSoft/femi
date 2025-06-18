// chartjs-augment.d.ts
// Import specific types from 'react' needed for the augmentation.
import type { DetailedHTMLProps, HTMLAttributes } from 'react';
import type { ChartType, CoreChartOptions, ElementChartOptions, PluginChartOptions, DatasetChartOptions, ScaleChartOptions, ChartTypeRegistry, Point, BubbleDataPoint, CartesianScaleTypeRegistry } from 'chart.js';
import type { CandlestickPoint } from '../types'; // Import from types.ts

// Augment the 'react' module directly.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'elevenlabs-convai': DetailedHTMLProps<HTMLAttributes<HTMLElement> & { 'agent-id'?: string }, HTMLElement>;
    }
  }
}


export interface FinancialElementOptions {
    color?: {
        up?: string;
        down?: string;
        unchanged?: string;
    };
    borderColor?: string | { up?: string; down?: string; unchanged?: string; };
    // Add other financial element specific options if needed
}


declare module 'chart.js' {
  interface ChartTypeRegistry {
    candlestick: {
      chartOptions: CoreChartOptions<'candlestick'> & ElementChartOptions<'candlestick'> & PluginChartOptions<'candlestick'> & DatasetChartOptions<'candlestick'> & ScaleChartOptions<'candlestick'>;
      datasetOptions: FinancialElementOptions & { // Ensure this aligns with what chart.js-chart-financial expects or provides
        // For example, if chart.js-chart-financial uses `borderColor` as an object:
        // borderColor?: string | { up?: string; down?: string; unchanged?: string; };
      };
      defaultDataPoint: CandlestickPoint; // Use our defined CandlestickPoint
      metaExtensions: object; // Or be more specific if known
      parsedDataType: CandlestickPoint; // Use our defined CandlestickPoint
      scales: keyof CartesianScaleTypeRegistry; // Candlestick typically uses Cartesian scales
    };
  }

  // Augment PluginOptionsByType to include chartAreaPainter if it's a custom global plugin
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface PluginOptionsByType<TType extends ChartType> {
    chartAreaPainter?: {
      color?: string;
    };
  }
}

export {}; // Ensures this file is treated as a module.


import React, { useEffect, useRef, useState } from 'react';
import { HandwritingCanvasProps } from '../types'; // Assuming types.ts is in parent directory

const HandwritingCanvas: React.FC<HandwritingCanvasProps> = ({
  width,
  height,
  penColor = '#000000', // Default black
  penThickness = 3,   // Default thickness
  canvasRef,
  disabled = false,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  // Effect A: Handles canvas dimensioning and basic context setup.
  // Runs ONLY when width, height, or canvasRef change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = width * window.devicePixelRatio;
    canvas.height = height * window.devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext('2d');
    if (context) {
        context.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Explicitly fill canvas with white background
        context.fillStyle = '#FFFFFF';
        context.fillRect(0, 0, width, height); // Fill based on logical width/height

        context.lineCap = 'round';
        context.lineJoin = 'round';
        contextRef.current = context; // Store the context
        // Initial penColor/penThickness will be applied by Effect B
    }
  }, [canvasRef, width, height]); // Dependencies: canvasRef, width, height

  // Effect B: Applies dynamic drawing styles (pen color, thickness).
  // Runs if penColor or penThickness change, or after context is initially set.
  useEffect(() => {
    if (contextRef.current) { // Ensure context exists
        contextRef.current.strokeStyle = penColor;
        contextRef.current.lineWidth = penThickness;
    }
  }, [penColor, penThickness]); // Dependencies: penColor, penThickness. Implicitly runs after contextRef.current is set.


  const getCoordinates = (event: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;

    if ('touches' in event) {
      if (event.touches.length === 0) return null; // No touch points
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (event: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const coords = getCoordinates(event);
    if (!coords || !contextRef.current) return;
    
    contextRef.current.beginPath();
    contextRef.current.moveTo(coords.x, coords.y);
    setIsDrawing(true);
    event.preventDefault(); // Prevent scrolling on touch devices
  };

  const draw = (event: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled || !contextRef.current) return;
    const coords = getCoordinates(event);
    if (!coords) return;

    contextRef.current.lineTo(coords.x, coords.y);
    contextRef.current.stroke();
    event.preventDefault(); // Prevent scrolling on touch devices
  };

  const stopDrawing = () => {
    if (!contextRef.current || !isDrawing) return;
    contextRef.current.closePath();
    setIsDrawing(false);
  };
  
  return (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing} // Stop drawing if mouse leaves canvas
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      className={`border border-neutral-400 dark:border-neutral-600 rounded-md bg-white dark:bg-gray-100 ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-crosshair'}`}
      aria-label="Drawing canvas for handwriting practice"
      role="img" // Treat as an image for accessibility, as it produces visual content
    />
  );
};

export default HandwritingCanvas;

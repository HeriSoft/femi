
import React from 'react';
import { TienLenCard, CardSuit } from '../../../types.ts';

interface CardDisplayProps {
  card: TienLenCard | null; // Can be null if it's a placeholder or hidden card
  onClick?: () => void;
  className?: string;
  isFaceDown?: boolean; // For AI cards or deck
  isSelected?: boolean; // For player's hand interaction
  isPlayable?: boolean; // If card can be played (visual cue)
  isDimmed?: boolean; // For cards that cannot be selected or played
}

const CardDisplay: React.FC<CardDisplayProps> = ({
  card,
  onClick,
  className = '',
  isFaceDown = false,
  isSelected = false,
  isPlayable = true, // Default to true, game logic will set this
  isDimmed = false,
}) => {
  const getSuitColor = (suit: CardSuit | undefined) => {
    if (!suit) return 'text-neutral-800 dark:text-neutral-200'; // Default for no card
    return (suit === CardSuit.HEARTS || suit === CardSuit.DIAMONDS)
      ? 'text-red-600 dark:text-red-400'
      : 'text-neutral-800 dark:text-neutral-200';
  };

  const baseClasses = `
    w-16 h-24 sm:w-20 sm:h-28
    border-2 rounded-lg shadow-md flex flex-col items-center justify-center 
    p-1 transition-all duration-150 ease-in-out
    ${className}
  `;

  const interactiveClasses = onClick && !isFaceDown && isPlayable && !isDimmed
    ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1'
    : 'cursor-default';
  
  const selectionClasses = isSelected ? 'ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-green-600 dark:ring-offset-green-700 -translate-y-2' : '';
  const dimmedClasses = isDimmed ? 'opacity-50 filter grayscale' : '';
  const playabilityClasses = !isPlayable && !isFaceDown ? 'opacity-60' : ''; // Dim if not playable but not completely greyed out

  if (isFaceDown) {
    return (
      <div
        className={`${baseClasses} bg-blue-500 border-blue-700 dark:bg-blue-700 dark:border-blue-900 relative`}
        aria-label="Facedown card"
      >
        <div className="absolute inset-1 border-2 border-blue-300 dark:border-blue-500 rounded-md opacity-50"></div>
        {/* You can add a more detailed card back design here */}
        <span className="text-white text-opacity-80 text-xs">CARD</span>
      </div>
    );
  }

  if (!card) {
    return <div className={`${baseClasses} bg-neutral-200 dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 ${dimmedClasses}`} aria-label="Empty card slot"></div>;
  }

  const suitColor = getSuitColor(card.suit);

  return (
    <div
      className={`${baseClasses} bg-white dark:bg-neutral-100 border-neutral-300 dark:border-neutral-400 
                  ${interactiveClasses} ${selectionClasses} ${dimmedClasses} ${playabilityClasses}`}
      onClick={onClick}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Card ${card.rank} of ${card.suit}${isSelected ? ', selected' : ''}`}
      tabIndex={onClick && isPlayable && !isDimmed ? 0 : -1}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.();}}
    >
      <div className={`text-lg sm:text-xl font-bold ${suitColor} self-start`}>{card.rank}</div>
      <div className={`text-2xl sm:text-3xl ${suitColor}`}>{card.suit}</div>
      <div className={`text-lg sm:text-xl font-bold ${suitColor} self-end transform rotate-180`}>{card.rank}</div>
    </div>
  );
};

export default CardDisplay;

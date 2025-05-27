
import React from 'react';
import { WebGamePlayerModalProps } from '../types.ts';
import { XMarkIcon } from './Icons.tsx';
import TicTacToeGame from './games/TicTacToeGame.tsx';
import SlidingPuzzleGame from './games/SlidingPuzzleGame.tsx';
import FlappyBirdGame from './games/FlappyBirdGame.tsx';

const WebGamePlayerModal: React.FC<WebGamePlayerModalProps> = ({ isOpen, onClose, gameType, gameTitle }) => {
  if (!isOpen || !gameType) return null;

  const renderGame = () => {
    switch (gameType) {
      case 'tic-tac-toe':
        return <TicTacToeGame />;
      case 'sliding-puzzle':
        return <SlidingPuzzleGame />;
      case 'flappy-bird':
        return <FlappyBirdGame />;
      default:
        return <p className="text-center text-neutral-500 dark:text-neutral-400">Game not available or type is incorrect.</p>;
    }
  };
  
  const getModalMaxWidth = () => {
    switch (gameType) {
      case 'flappy-bird':
        return 'max-w-sm sm:max-w-md'; // Flappy bird might be narrower
      case 'sliding-puzzle':
        return 'max-w-xs sm:max-w-sm'; // Sliding puzzle might be more compact
      case 'tic-tac-toe':
        return 'max-w-xs sm:max-w-sm'; // Tic-tac-toe is also compact
      default:
        return 'max-w-md'; // Default
    }
  }


  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[80] p-2 sm:p-4 transition-opacity duration-300"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="web-game-modal-title"
    >
      <div
        className={`bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl w-full ${getModalMaxWidth()} max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100 p-3 sm:p-4`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full flex justify-between items-center mb-2 sm:mb-3">
          <h2 id="web-game-modal-title" className="text-lg sm:text-xl font-semibold text-primary dark:text-primary-light truncate">
            {gameTitle || 'Playing Game'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
            aria-label="Close game"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:w-6" />
          </button>
        </div>

        <div className="flex-grow overflow-hidden p-1 sm:p-2 bg-secondary-light dark:bg-neutral-dark rounded-md flex items-center justify-center web-game-content-area">
          {/* The game component itself will handle internal scrolling or fitting if necessary */}
          {renderGame()}
        </div>
        
        <div className="mt-2 sm:mt-3 w-full flex justify-center">
             <button
                onClick={onClose}
                className="px-6 py-2 bg-secondary dark:bg-neutral-darkest hover:bg-secondary-dark dark:hover:bg-neutral-dark text-neutral-darker dark:text-secondary-light rounded-md text-sm transition-colors"
            >
                Close Game
            </button>
        </div>
         <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 text-center">
            {gameType === 'flappy-bird' ? 'Click or Tap to Jump.' : 'Use mouse click or tap to play.'}
          </p>
      </div>
    </div>
  );
};

export default WebGamePlayerModal;

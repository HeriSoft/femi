

import React from 'react';
import { XMarkIcon, PuzzlePieceIcon, CardsIcon } from './Icons.tsx'; 
import { useNotification } from '../contexts/NotificationContext.tsx';
import { GamesModalProps as LocalGamesModalProps, WebGameType } from '../types.ts'; // Removed DosGameConfig

const placeholderGamesUiData: { 
  id: string; 
  title: string; 
  description: string; 
  icon?: React.ReactNode; 
  isImplemented?: boolean; 
  webGameType?: WebGameType; 
}[] = [
  { id: 'tienlen-game', title: "Tiến Lên (Miền Nam)", description: "Classic Vietnamese card game. Be the first to empty your hand!", icon: <CardsIcon className="w-6 h-6 text-red-500" />, isImplemented: true, webGameType: 'tien-len'},
  { id: 'tictactoe-game', title: "Tic-Tac-Toe", description: "Classic X's and O's. Can you beat the opponent or a friend?", icon: <span className="text-2xl">⭕️</span>, isImplemented: true, webGameType: 'tic-tac-toe'},
  { id: 'slidingpuzzle-game', title: "Sliding Puzzle (Numbers)", description: "Arrange the tiles in numerical order.", icon: <span className="text-2xl">🔢</span>, isImplemented: true, webGameType: 'sliding-puzzle'}, 
  { id: 'flappybird-game', title: "Flappy Ball", description: "Navigate the ball through pipes by tapping.", icon: <span className="text-2xl">🏀</span>, isImplemented: true, webGameType: 'flappy-bird'}, 
];


const GamesModal: React.FC<LocalGamesModalProps> = ({ isOpen, onClose, onPlayWebGame }) => {
  const { addNotification } = useNotification();

  const handlePlayGameClick = (gameUiData: typeof placeholderGamesUiData[0]) => {
    if (gameUiData.isImplemented) {
      if (gameUiData.webGameType) {
        onPlayWebGame(gameUiData.webGameType, gameUiData.title);
      } else {
        addNotification(`${gameUiData.title} configuration is incomplete.`, 'error');
      }
    } else {
      addNotification(`${gameUiData.title} is coming soon!`, 'info');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 transition-opacity duration-300"
      onClick={onClose} 
      role="dialog"
      aria-modal="true"
      aria-labelledby="games-modal-title"
    >
      <div
        className="bg-neutral-light dark:bg-neutral-darker rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()} 
      >
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-secondary dark:border-neutral-darkest">
          <h2 id="games-modal-title" className="text-xl sm:text-2xl font-semibold text-primary dark:text-primary-light flex items-center">
            <PuzzlePieceIcon className="w-7 h-7 mr-3 text-accent dark:text-accent-light" /> Mini Games Arcade
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-neutral-darker dark:text-secondary-light hover:bg-secondary dark:hover:bg-neutral-darkest transition-colors"
            aria-label="Close games modal"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-4 sm:p-6">
          {placeholderGamesUiData.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {placeholderGamesUiData.map((game) => (
                <div key={game.id} className={`bg-secondary/50 dark:bg-neutral-dark/40 p-4 rounded-lg shadow hover:shadow-md transition-shadow flex flex-col justify-between ${!game.isImplemented ? 'opacity-60' : ''}`}>
                  <div>
                    <div className="flex items-center mb-2">
                        {game.icon && <div className="mr-2 text-xl">{game.icon}</div>}
                        <h3 className="text-lg font-semibold text-neutral-darker dark:text-secondary-light">{game.title}</h3>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                      {game.description}
                    </p>
                  </div>
                  <button
                    onClick={() => handlePlayGameClick(game)}
                    className={`w-full mt-auto px-4 py-2 text-white rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-light dark:ring-offset-neutral-darker focus:ring-accent-dark ${game.isImplemented ? 'bg-accent hover:bg-accent-dark' : 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'}`}
                    disabled={!game.isImplemented}
                  >
                    {game.isImplemented ? 'Play' : 'Coming Soon'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-neutral-500 dark:text-neutral-400 py-10">
              No games available at the moment. Check back soon!
            </p>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-secondary dark:border-neutral-darkest">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-neutral-light dark:ring-offset-neutral-darker focus:ring-primary-dark transition-colors"
          >
            Close Arcade
          </button>
        </div>
      </div>
    </div>
  );
};

export default GamesModal;

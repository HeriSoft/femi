
import React from 'react';
import { XMarkIcon, CardsIcon } from '../../Icons.tsx';
import { TienLenGameModalProps } from '../../../types.ts';
import TienLenGame from './TienLenGame';

const TienLenGameModal: React.FC<TienLenGameModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-85 flex items-center justify-center z-[80] p-2 sm:p-4 transition-opacity duration-300"
      onClick={onClose} // Clicking backdrop closes modal
      role="dialog"
      aria-modal="true"
      aria-labelledby="tienlen-game-modal-title"
    >
      <div
        className="bg-green-700 dark:bg-green-800 rounded-lg shadow-xl w-full max-w-4xl xl:max-w-5xl max-h-[95vh] flex flex-col transform transition-all duration-300 scale-100 opacity-100 p-3 sm:p-4"
        onClick={(e) => e.stopPropagation()} // Prevent click inside modal from closing it
      >
        <div className="w-full flex justify-between items-center mb-2 sm:mb-3 text-white">
          <h2 id="tienlen-game-modal-title" className="text-xl sm:text-2xl font-bold flex items-center">
            <CardsIcon className="w-7 h-7 mr-2 text-red-400" />
            Tiến Lên Miền Nam
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close Tiến Lên game"
          >
            <XMarkIcon className="w-6 h-6 sm:w-7 sm:h-7" />
          </button>
        </div>

        <div className="flex-grow overflow-hidden p-1 sm:p-2 bg-green-600 dark:bg-green-700 rounded-md flex items-center justify-center">
          {/* TienLenGame component will be responsible for its own layout and responsiveness */}
          <TienLenGame />
        </div>
        
        <div className="mt-2 sm:mt-3 w-full flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
          >
            Exit Game
          </button>
        </div>
      </div>
    </div>
  );
};

export default TienLenGameModal;
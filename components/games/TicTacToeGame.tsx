
import React, { useState, useEffect } from 'react';

type Player = 'X' | 'O';
type SquareValue = Player | null;
type BoardState = SquareValue[];

const calculateWinner = (squares: BoardState): Player | 'Draw' | null => {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6],             // diagonals
  ];
  for (let i = 0; i < lines.length; i++) {
    const [a, b, c] = lines[i];
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a] as Player;
    }
  }
  if (squares.every(square => square !== null)) {
    return 'Draw';
  }
  return null;
};

interface SquareProps {
  value: SquareValue;
  onClick: () => void;
  disabled: boolean;
}

const Square: React.FC<SquareProps> = ({ value, onClick, disabled }) => (
  <button
    className={`w-20 h-20 sm:w-24 sm:h-24 border border-secondary dark:border-neutral-darkest text-4xl sm:text-5xl font-bold transition-colors duration-150
                ${value === 'X' ? 'text-primary dark:text-primary-light' : 'text-purple-600 dark:text-purple-400'}
                ${disabled ? 'cursor-not-allowed' : 'hover:bg-secondary/50 dark:hover:bg-neutral-dark/50'}`}
    onClick={onClick}
    disabled={disabled || !!value}
    aria-label={`Square ${value ? `contains ${value}` : 'empty'}`}
  >
    {value}
  </button>
);

const TicTacToeGame: React.FC = () => {
  const initialBoard = Array(9).fill(null);
  const [board, setBoard] = useState<BoardState>(initialBoard);
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);

  const handleClick = (index: number) => {
    if (winner || board[index]) {
      return;
    }
    const newBoard = board.slice();
    newBoard[index] = xIsNext ? 'X' : 'O';
    setBoard(newBoard);
    setXIsNext(!xIsNext);
  };

  useEffect(() => {
    const gameWinner = calculateWinner(board);
    if (gameWinner) {
      setWinner(gameWinner);
    }
  }, [board]);

  const handleRestart = () => {
    setBoard(initialBoard);
    setXIsNext(true);
    setWinner(null);
  };

  let status;
  if (winner) {
    status = winner === 'Draw' ? 'Game is a Draw!' : `Winner: ${winner}!`;
  } else {
    status = `Next player: ${xIsNext ? 'X' : 'O'}`;
  }

  return (
    <div className="flex flex-col items-center p-2 sm:p-4 bg-neutral-light dark:bg-neutral-darker rounded-lg">
      <div className="mb-3 sm:mb-4 text-lg font-semibold text-neutral-darker dark:text-secondary-light">
        {status}
      </div>
      <div className="grid grid-cols-3 gap-1 bg-yellow-100 dark:bg-yellow-900/30 shadow-md">
        {board.map((value, index) => (
          <Square
            key={index}
            value={value}
            onClick={() => handleClick(index)}
            disabled={!!winner}
          />
        ))}
      </div>
      <button
        onClick={handleRestart}
        className="mt-4 sm:mt-6 px-6 py-2 bg-primary hover:bg-primary-dark dark:bg-primary-light dark:hover:bg-primary text-white dark:text-neutral-darker rounded-md text-sm font-medium transition-colors"
      >
        {winner ? 'Play Again' : 'Restart Game'}
      </button>
    </div>
  );
};

export default TicTacToeGame;

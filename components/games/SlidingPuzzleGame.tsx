
import React, { useState, useEffect, useCallback } from 'react';

const GRID_SIZE = 3; // 3x3 grid
const EMPTY_TILE = 0; // Represents the empty space

type TileValue = number;
type BoardState = TileValue[];

const isSolvable = (tiles: BoardState, gridSize: number): boolean => {
  // For a 3x3 grid, any shuffled state reached by valid moves from solved state is solvable.
  // The Fisher-Yates shuffle used below doesn't guarantee solvability from a purely random array,
  // but if we ensure the empty tile ends up in the correct parity position or use enough swaps,
  // it's usually fine for this size.
  // A more robust way is to perform N random valid moves from the solved state.
  if (gridSize !== 3) return true; // Simplification for now

  let inversions = 0;
  const flatTiles = tiles.filter(t => t !== EMPTY_TILE);
  for (let i = 0; i < flatTiles.length; i++) {
    for (let j = i + 1; j < flatTiles.length; j++) {
      if (flatTiles[i] > flatTiles[j]) {
        inversions++;
      }
    }
  }

  // For a 3x3 grid (odd width), solvability depends only on inversions being even.
  return inversions % 2 === 0;
};

const shuffleBoard = (gridSize: number): BoardState => {
  const totalTiles = gridSize * gridSize;
  let newBoard = Array.from({ length: totalTiles -1 }, (_, i) => i + 1);
  newBoard.push(EMPTY_TILE); // Solved state initially [1, 2, ..., 8, 0] for 3x3

  // Perform a large number of random valid swaps from the solved state
  const shuffleMoves = 100 + Math.floor(Math.random() * 50); // Increased shuffle moves
  for (let i = 0; i < shuffleMoves; i++) {
    const emptyIndex = newBoard.indexOf(EMPTY_TILE);
    const possibleMoves: number[] = [];
    const row = Math.floor(emptyIndex / gridSize);
    const col = emptyIndex % gridSize;

    if (row > 0) possibleMoves.push(emptyIndex - gridSize); // Up
    if (row < gridSize - 1) possibleMoves.push(emptyIndex + gridSize); // Down
    if (col > 0) possibleMoves.push(emptyIndex - 1); // Left
    if (col < gridSize - 1) possibleMoves.push(emptyIndex + 1); // Right
    
    if (possibleMoves.length > 0) {
        const randomMoveIndex = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        [newBoard[emptyIndex], newBoard[randomMoveIndex]] = [newBoard[randomMoveIndex], newBoard[emptyIndex]];
    }
  }
  
  // Fallback shuffle if the above doesn't produce enough randomness or gets stuck (rare for small N)
  // This is a Fisher-Yates shuffle. Might not always be solvable without parity checks,
  // but for a game, "mostly solvable" can be okay, or the above swap method is preferred.
  if (!isSolvable(newBoard, gridSize) && gridSize === 3) { // Only enforce solvability for 3x3
      for (let i = totalTiles - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [newBoard[i], newBoard[j]] = [newBoard[j], newBoard[i]];
      }
      // If still not solvable after Fisher-Yates (for 3x3), swap two non-empty tiles if possible
      // This is a simple fix, may not be ideal for larger grids
      if (!isSolvable(newBoard, gridSize) && newBoard.length > 2) {
          let idx1 = newBoard.findIndex(t => t !== EMPTY_TILE);
          let idx2 = newBoard.findIndex((t, i) => t !== EMPTY_TILE && i > idx1);
          if (idx1 !== -1 && idx2 !== -1) {
             [newBoard[idx1], newBoard[idx2]] = [newBoard[idx2], newBoard[idx1]];
          }
      }
  }


  return newBoard;
};


const SlidingPuzzleGame: React.FC = () => {
  const [board, setBoard] = useState<BoardState>(() => shuffleBoard(GRID_SIZE));
  const [moves, setMoves] = useState<number>(0);
  const [isSolved, setIsSolved] = useState<boolean>(false);

  const checkWin = useCallback((currentBoard: BoardState) => {
    for (let i = 0; i < currentBoard.length - 1; i++) {
      if (currentBoard[i] !== i + 1) return false;
    }
    return currentBoard[currentBoard.length - 1] === EMPTY_TILE;
  }, []);

  useEffect(() => {
    if (checkWin(board)) {
      setIsSolved(true);
    }
  }, [board, checkWin]);

  const handleTileClick = (index: number) => {
    if (isSolved || board[index] === EMPTY_TILE) return;

    const emptyIndex = board.indexOf(EMPTY_TILE);
    const tileRow = Math.floor(index / GRID_SIZE);
    const tileCol = index % GRID_SIZE;
    const emptyRow = Math.floor(emptyIndex / GRID_SIZE);
    const emptyCol = emptyIndex % GRID_SIZE;

    const isAdjacent = (Math.abs(tileRow - emptyRow) === 1 && tileCol === emptyCol) ||
                       (Math.abs(tileCol - emptyCol) === 1 && tileRow === emptyRow);

    if (isAdjacent) {
      const newBoard = [...board];
      [newBoard[index], newBoard[emptyIndex]] = [newBoard[emptyIndex], newBoard[index]];
      setBoard(newBoard);
      setMoves(prevMoves => prevMoves + 1);
    }
  };

  const handleRestart = () => {
    setBoard(shuffleBoard(GRID_SIZE));
    setMoves(0);
    setIsSolved(false);
  };
  
  const getTileSizeClasses = () => {
    // GRID_SIZE is always 3, so we can directly return the classes for 3x3.
    return "w-20 h-20 sm:w-24 sm:h-24 text-3xl";
  }

  return (
    <div className="flex flex-col items-center p-2 sm:p-4 bg-neutral-light dark:bg-neutral-darker rounded-lg w-full">
      <div className="mb-3 sm:mb-4 text-lg font-semibold text-neutral-darker dark:text-secondary-light">
        {isSolved ? `🎉 You Solved It in ${moves} moves! 🎉` : `Moves: ${moves}`}
      </div>
      <div
        className={`grid gap-1 p-1 bg-primary/20 dark:bg-primary-dark/30 rounded-md shadow-md`}
        style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}
      >
        {board.map((tile, index) => (
          <button
            key={index}
            onClick={() => handleTileClick(index)}
            disabled={isSolved && tile !== EMPTY_TILE}
            className={`font-bold flex items-center justify-center 
                        ${getTileSizeClasses()}
                        ${tile === EMPTY_TILE ? 'bg-secondary/30 dark:bg-neutral-dark/50 opacity-50 cursor-default' 
                                             : 'bg-primary dark:bg-primary-light text-white hover:bg-primary-dark dark:hover:bg-primary transition-colors'}
                        rounded-sm
                        ${isSolved && tile !== EMPTY_TILE ? 'cursor-not-allowed' : ''}
                        `}
            aria-label={tile === EMPTY_TILE ? "Empty space" : `Tile ${tile}`}
          >
            {tile !== EMPTY_TILE ? tile : ''}
          </button>
        ))}
      </div>
      <button
        onClick={handleRestart}
        className="mt-4 sm:mt-6 px-6 py-2 bg-accent hover:bg-accent-dark text-white rounded-md text-sm font-medium transition-colors"
      >
        {isSolved ? 'Play Again' : 'Shuffle'}
      </button>
    </div>
  );
};

export default SlidingPuzzleGame;

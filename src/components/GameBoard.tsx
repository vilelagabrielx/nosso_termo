import React from 'react';

interface GameBoardProps {
  mode: 1 | 2 | 4;
  words: string[];
  guesses: string[];
  currentGuess: string;
  maxAttempts: number;
  shakeRowIndex: number | null;
  onCellClick?: (cellIndex: number) => void;
  focusedCellIndex?: number | null;
  revealedIndices?: Set<number>;
}

// Wordle evaluation function
export function getLetterStatuses(guess: string, target: string): ('correct' | 'present' | 'absent')[] {
  const len = target.length;
  const statuses: ('correct' | 'present' | 'absent')[] = Array(len).fill('absent');
  
  // Count letters in target for yellow calculations
  const targetLetterCounts: Record<string, number> = {};
  for (let i = 0; i < len; i++) {
    const char = target[i];
    if (!guess[i] || guess[i] !== char) {
      targetLetterCounts[char] = (targetLetterCounts[char] || 0) + 1;
    }
  }

  // First pass: mark greens
  for (let i = 0; i < len; i++) {
    if (guess[i] === target[i]) {
      statuses[i] = 'correct';
    }
  }

  // Second pass: mark yellows (present)
  for (let i = 0; i < len; i++) {
    if (guess[i] !== target[i]) {
      const char = guess[i];
      if (targetLetterCounts[char] && targetLetterCounts[char] > 0) {
        statuses[i] = 'present';
        targetLetterCounts[char]--;
      }
    }
  }

  return statuses;
}

export const GameBoard: React.FC<GameBoardProps> = ({
  mode,
  words,
  guesses,
  currentGuess,
  maxAttempts,
  shakeRowIndex,
  onCellClick,
  focusedCellIndex,
  revealedIndices,
}) => {
  // Find where each board was solved (index of first guess matching the word)
  const getSolvedIndex = (boardIndex: number): number | null => {
    const word = words[boardIndex];
    const index = guesses.findIndex(g => g.slice(0, word.length) === word);
    return index !== -1 ? index : null;
  };

  return (
    <div className={`boards-wrapper mode-${mode}`}>
      {words.map((targetWord, boardIndex) => {
        const solvedIndex = getSolvedIndex(boardIndex);
        const isSolved = solvedIndex !== null;
        const targetLen = targetWord.length;

        return (
          <div 
            key={boardIndex} 
            className={`board-card ${isSolved ? 'solved' : ''}`}
            style={{ '--cols': targetLen } as React.CSSProperties}
          >
            <div className="board-label">
              {isSolved ? `RESOLVIDO • ${targetLen} letras` : `PALAVRA ${boardIndex + 1} • ${targetLen} letras`}
            </div>

            <div className="board-grid">
              {Array.from({ length: maxAttempts }).map((_, rowIndex) => {
                const isCurrentRow = rowIndex === guesses.length;
                const hasGuess = rowIndex < guesses.length;
                const guessWord = guesses[rowIndex];

                // If board was solved, and this row is after the solving row, show empty cells
                const isAfterSolve = isSolved && rowIndex > (solvedIndex as number);
                // If board was solved, and this row is the solving row or earlier
                const showGuess = hasGuess && (!isSolved || rowIndex <= (solvedIndex as number));

                let cellsContent: string[] = Array(targetLen).fill('');
                let cellStatuses: ('correct' | 'present' | 'absent' | 'typing' | '')[] = Array(targetLen).fill('');

                if (showGuess && guessWord) {
                  cellStatuses = getLetterStatuses(guessWord, targetWord);
                  const isWordCorrect = cellStatuses.every(s => s === 'correct');
                  if (isWordCorrect) {
                    cellsContent = targetWord.split('');
                  } else {
                    cellsContent = guessWord.split('');
                  }
                } else if (isCurrentRow && !isSolved) {
                  // Typing in the active row
                  for (let i = 0; i < targetLen; i++) {
                    const char = currentGuess[i] || '';
                    cellsContent[i] = char;
                    if (char && char !== ' ') {
                      cellStatuses[i] = 'typing';
                    }
                  }
                }

                const isShaking = isCurrentRow && shakeRowIndex !== null;

                return (
                  <div 
                    key={rowIndex} 
                    className={`game-row ${isShaking ? 'shake' : ''}`}
                    style={{ '--cols': targetLen } as React.CSSProperties}
                  >
                    {Array.from({ length: targetLen }).map((_, cellIndex) => {
                      const letter = cellsContent[cellIndex] || '';
                      const status = cellStatuses[cellIndex] || '';
                      
                      // Add flip animation only when a guess was made
                      // We can base this on whether a row has a submitted guess
                      const isFlipped = showGuess && !isAfterSolve;
                      const isFocused = isCurrentRow && focusedCellIndex === cellIndex;
                      const isRevealedHint = isCurrentRow && !isSolved && revealedIndices?.has(cellIndex);

                      return (
                        <div
                          key={cellIndex}
                          className={`game-cell ${status} ${isFlipped ? 'flip' : ''} ${isFocused ? 'focused' : ''} ${isRevealedHint ? 'revealed-hint' : ''}`}
                          style={{
                            animationDelay: isFlipped ? `${cellIndex * 100}ms` : '0ms',
                            cursor: (isCurrentRow && !isSolved) ? 'pointer' : 'default'
                          }}
                          onClick={() => {
                            if (isCurrentRow && !isSolved) {
                              onCellClick?.(cellIndex);
                            }
                          }}
                        >
                          {!isAfterSolve && letter !== ' ' ? letter : ''}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

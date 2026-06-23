import React from 'react';

interface GameBoardProps {
  mode: 1 | 2 | 4;
  words: string[];
  guesses: string[];
  currentGuess: string;
  maxAttempts: number;
  shakeRowIndex: number | null;
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
}) => {
  // Find where each board was solved (index of first guess matching the word)
  const getSolvedIndex = (boardIndex: number): number | null => {
    const word = words[boardIndex];
    const index = guesses.indexOf(word);
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
          >
            <div className="board-label">
              {isSolved ? 'RESOLVIDO' : `PALAVRA ${boardIndex + 1}`}
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
                  cellsContent = guessWord.split('');
                  cellStatuses = getLetterStatuses(guessWord, targetWord);
                } else if (isCurrentRow && !isSolved) {
                  // Typing in the active row
                  cellsContent = currentGuess.split('');
                  for (let i = 0; i < targetLen; i++) {
                    if (i < currentGuess.length) {
                      cellStatuses[i] = 'typing';
                    }
                  }
                }

                const isShaking = isCurrentRow && shakeRowIndex !== null;

                return (
                  <div 
                    key={rowIndex} 
                    className={`game-row ${isShaking ? 'shake' : ''}`}
                  >
                    {Array.from({ length: targetLen }).map((_, cellIndex) => {
                      const letter = cellsContent[cellIndex] || '';
                      const status = cellStatuses[cellIndex] || '';
                      
                      // Add flip animation only when a guess was made
                      // We can base this on whether a row has a submitted guess
                      const isFlipped = showGuess && !isAfterSolve;

                      return (
                        <div
                          key={cellIndex}
                          className={`game-cell ${status} ${isFlipped ? 'flip' : ''}`}
                          style={{
                            animationDelay: isFlipped ? `${cellIndex * 100}ms` : '0ms'
                          }}
                        >
                          {!isAfterSolve ? letter : ''}
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

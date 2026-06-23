import React from 'react';

interface KeyboardProps {
  onChar: (value: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  letterStatuses: Record<string, 'correct' | 'present' | 'absent'>;
}

export const Keyboard: React.FC<KeyboardProps> = ({
  onChar,
  onDelete,
  onEnter,
  letterStatuses,
}) => {
  const rows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'BACKSPACE'],
  ];

  const getKeyClass = (key: string) => {
    let classes = 'keyboard-key';
    if (key === 'ENTER' || key === 'BACKSPACE') {
      classes += ' wide';
    }
    const status = letterStatuses[key];
    if (status) {
      classes += ` ${status}`;
    }
    return classes;
  };

  return (
    <div className="keyboard-container">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="keyboard-row">
          {row.map((key) => (
            <button
              key={key}
              className={getKeyClass(key)}
              onClick={() => {
                if (key === 'ENTER') {
                  onEnter();
                } else if (key === 'BACKSPACE') {
                  onDelete();
                } else {
                  onChar(key);
                }
              }}
            >
              {key === 'BACKSPACE' ? '⌫' : key}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
};

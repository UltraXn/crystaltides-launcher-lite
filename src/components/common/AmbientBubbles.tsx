import React, { useState } from 'react';
import { secureRandom } from '../../utils/random';
import './AmbientBubbles.css';

export interface AmbientBubblesProps {
  count?: number;
}

export const AmbientBubbles: React.FC<AmbientBubblesProps> = ({ count = 22 }) => {
  const [bubbles] = useState(() => {
    return Array.from({ length: count }).map((_, i) => {
      const duration = secureRandom() * 14 + 9; // 9s - 23s
      return {
        id: i,
        size: secureRandom() * 24 + 14, // 14px - 38px
        left: secureRandom() * 100, // 0% - 100%
        animationDuration: duration,
        // Negative delay pre-warms the animation so bubbles are already rising across the screen on load
        animationDelay: -secureRandom() * duration,
      };
    });
  });

  return (
    <div className="ambient-bubbles-container" aria-hidden="true">
      {bubbles.map((b) => (
        <div
          key={b.id}
          className="ambient-bubble"
          style={{
            width: `${b.size}px`,
            height: `${b.size}px`,
            left: `${b.left}%`,
            animationDuration: `${b.animationDuration}s`,
            animationDelay: `${b.animationDelay}s`,
          }}
        />
      ))}
    </div>
  );
};

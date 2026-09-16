import React, { useMemo } from 'react';
import './AmbientBubbles.css';

interface Bubble {
  id: number;
  size: number;
  left: number;
  duration: number;
  delay: number;
  opacity: number;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export const AmbientBubbles: React.FC<{ count?: number }> = ({ count = 25 }) => {
  const bubbles = useMemo(() => {
    const list: Bubble[] = [];
    for (let i = 0; i < count; i++) {
      list.push({
        id: i,
        size: Math.floor(pseudoRandom(i * 7 + 1) * 20) + 6,
        left: Math.floor(pseudoRandom(i * 13 + 2) * 100),
        duration: Math.floor(pseudoRandom(i * 17 + 3) * 8) + 6,
        delay: Math.floor(pseudoRandom(i * 23 + 4) * 6),
        opacity: pseudoRandom(i * 29 + 5) * 0.45 + 0.15,
      });
    }
    return list;
  }, [count]);

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
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
            opacity: b.opacity,
          }}
        />
      ))}
    </div>
  );
};

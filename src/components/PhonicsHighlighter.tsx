import React from 'react';
import { cn } from '../lib/utils';

interface PhonicsHighlighterProps {
  text: string;
  className?: string;
  onWordClick?: (word: string) => void;
}

export const PhonicsHighlighter: React.FC<PhonicsHighlighterProps> = ({ text, className, onWordClick }) => {
  // Enhanced regex to match [color]content[/color] OR single [content] tags
  const regex = /\[(\w+)\](.*?)\[\/\1\]|\[([^\]\n]+?)\]/g;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // Capture from [color]content[/color] (match[1,2]) or [content] (match[3])
    const color = match[1];
    const content = match[2] || match[3];

    const colorClasses: Record<string, string> = {
      red: 'text-black font-bold underline decoration-dotted decoration-black/50 hover:bg-black/5',
      skyblue: 'text-black font-bold underline decoration-dotted decoration-black/50 hover:bg-black/5',
      orange: 'text-black font-bold underline decoration-dotted decoration-black/50 hover:bg-black/5',
      blue: 'text-black font-bold underline decoration-dotted decoration-black/50 hover:bg-black/5',
      purple: 'text-black font-bold underline decoration-dotted decoration-black/50 hover:bg-black/5',
      green: 'text-black font-bold underline decoration-dotted decoration-black/50 hover:bg-black/5',
    };

    parts.push(
      <span 
        key={match.index} 
        onClick={() => onWordClick?.(content)}
        className={cn(
          color ? colorClasses[color] : 'text-black font-bold decoration-dotted hover:bg-black/5', 
          'cursor-help transition-colors rounded-sm px-0.5'
        )}
      >
        {content}
      </span>
    );

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return <span className={cn('whitespace-pre-wrap', className)}>{parts}</span>;
};

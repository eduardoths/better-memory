import React from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import type { ContentType } from '../types';

interface Props {
  content: string;
  type: ContentType;
  imageUrl?: string | null;
  className?: string;
}

// Parse content for $...$ inline and $$...$$ block LaTeX, returning React nodes
function renderMixed(content: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const regex = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > last) {
      // Plain text segment — preserve newlines
      nodes.push(
        <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
          {content.slice(last, match.index)}
        </span>,
      );
    }

    const isBlock = match[0].startsWith('$$');
    const latex = isBlock ? match[0].slice(2, -2).trim() : match[0].slice(1, -1).trim();

    try {
      const html = katex.renderToString(latex, {
        displayMode: isBlock,
        throwOnError: false,
        trust: false,
      });
      nodes.push(
        <span
          key={key++}
          dangerouslySetInnerHTML={{ __html: html }}
          className={isBlock ? 'block text-center my-3' : 'inline'}
        />,
      );
    } catch {
      nodes.push(
        <span key={key++} className="text-red-500 font-mono text-sm">
          {match[0]}
        </span>,
      );
    }

    last = match.index + match[0].length;
  }

  if (last < content.length) {
    nodes.push(
      <span key={key++} style={{ whiteSpace: 'pre-wrap' }}>
        {content.slice(last)}
      </span>,
    );
  }

  return nodes;
}

export function CardRenderer({ content, type, imageUrl, className = '' }: Props) {
  const textNode =
    type === 'TEXT' ? (
      <span style={{ whiteSpace: 'pre-wrap' }}>{content}</span>
    ) : (
      <>{renderMixed(content)}</>
    );

  return (
    <div className={`text-center ${className}`}>
      <div className="text-xl leading-relaxed">{textNode}</div>
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Card image"
          className="mt-4 max-h-64 max-w-full mx-auto rounded-xl object-contain shadow-sm"
        />
      )}
    </div>
  );
}

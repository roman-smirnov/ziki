import { useEffect, useRef, type RefObject } from 'react';
import type { Diagnostic, Span } from '../code/parser.ts';
import { focusCodePosition } from './Editor.tsx';
import { Icon } from './icons.tsx';

export type ProgramIssue = {
  category: Diagnostic['category'] | 'flight';
  explanation: string;
  hint?: string;
  span?: Span;
};

type Props = {
  issue?: ProgramIssue & { id: number };
  playing: boolean;
  rowRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  onDismiss: () => void;
};

const titles = {
  code: 'Code error',
  runtime: 'Runtime error',
  flight: 'Flight stopped',
  limit: 'Program limit',
};

function reveal(card: HTMLElement, row: HTMLDivElement | null, preferLine = false) {
  const gap = 8;
  const viewportBottom = document.documentElement.clientHeight - gap;
  const cardRect = card.getBoundingClientRect();
  let { top, bottom } = cardRect;
  if (row) {
    const rowRect = row.getBoundingClientRect();
    const style = getComputedStyle(card);
    const stickyBottom = parseFloat(style.top) + cardRect.height + gap;
    if (style.position === 'sticky' && stickyBottom + rowRect.height <= viewportBottom) {
      if (rowRect.bottom > viewportBottom) window.scrollBy(0, rowRect.bottom - viewportBottom);
      else if (rowRect.top < stickyBottom) window.scrollBy(0, rowRect.top - stickyBottom);
      return;
    }
    // In a short viewport, lead with the message and let Go to line reach the code.
    if (rowRect.bottom - top <= viewportBottom - gap) bottom = rowRect.bottom;
    else if (preferLine) ({ top, bottom } = rowRect);
  }
  if (top < gap || bottom - top > viewportBottom - gap) window.scrollBy(0, top - gap);
  else if (bottom > viewportBottom) window.scrollBy(0, bottom - viewportBottom);
}

export function ProgramError({ issue, playing, rowRef, inputRef, onDismiss }: Props) {
  const card = useRef<HTMLDivElement>(null);
  const revealed = useRef<number>(undefined);
  useEffect(() => {
    if (!issue || revealed.current === issue.id || !card.current) return;
    if (playing && window.matchMedia('(width < 1024px)').matches) return;
    revealed.current = issue.id;
    reveal(card.current, rowRef.current);
  }, [issue, playing, rowRef]);

  function goToLine() {
    const input = inputRef.current;
    if (!issue?.span || !input || !card.current) return;
    focusCodePosition(input, issue.span.start);
    reveal(card.current, rowRef.current, true);
  }

  function dismiss() {
    if (card.current?.contains(document.activeElement)) inputRef.current?.focus({ preventScroll: true });
    onDismiss();
  }

  const title = issue && titles[issue.category];
  const location = issue?.span && `Line ${issue.span.line}, column ${issue.span.column}`;
  return <>
    <div className="sr-only" role="alert" aria-atomic="true">
      {issue && <span key={issue.id}>{[title, location, issue.explanation, issue.hint].filter(Boolean).join(' ')}</span>}
    </div>
    {issue && <div ref={card} className="program-error" data-category={issue.category} role="region" aria-labelledby="program-error-title"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          dismiss();
        }
      }}>
      <Icon name="warning"/>
      <div className="program-error-copy">
        <div className="program-error-heading">
          <h2 id="program-error-title">{title}</h2>
          {location && <span>{location}</span>}
        </div>
        <p>{issue.explanation}</p>
        {issue.hint && <p className="program-error-hint">{issue.hint}</p>}
        {issue.span && <button type="button" className="program-error-button" onClick={goToLine}>Go to line</button>}
      </div>
      <button type="button" className="program-error-button program-error-close" aria-label="Dismiss error" onClick={dismiss}>
        <Icon name="close" size={16}/>
      </button>
    </div>}
  </>;
}

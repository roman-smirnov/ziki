import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react';
import { normalizeSource, SOURCE_LIMIT } from '../code/parser.ts';
import { Icon } from './icons.tsx';
import type { ProgramIssue } from './ProgramError.tsx';

type Props = {
  code: string;
  line?: number;
  issue?: ProgramIssue;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  issueRowRef: RefObject<HTMLDivElement | null>;
  onChange: (code: string) => void;
  onRestore: () => void;
};
const keywords = new Set(['int', 'double', 'float', 'bool', 'string', 'var', 'if', 'else', 'true', 'false']);

export function focusCodePosition(input: HTMLTextAreaElement, offset: number) {
  input.focus({ preventScroll: true });
  input.setSelectionRange(offset, offset);
  const ink = input.parentElement?.querySelector('pre');
  if (!ink) return;

  // Measure against the rendered code so tabs and fallback fonts use the same spacing.
  const walker = document.createTreeWalker(ink, NodeFilter.SHOW_TEXT);
  let text = walker.nextNode() as Text | null;
  while (text && offset >= text.length) {
    const next = walker.nextNode() as Text | null;
    if (!next) break;
    offset -= text.length;
    text = next;
  }
  if (!text) return;

  const caret = document.createRange();
  caret.setStart(text, Math.min(offset, text.length));
  const left = caret.getBoundingClientRect().left - ink.getBoundingClientRect().left;
  const rightEdge = input.scrollLeft + input.clientWidth - 8;
  if (left > rightEdge) input.scrollLeft += left - rightEdge;
  else if (left < input.scrollLeft + 8) input.scrollLeft = Math.max(0, left - 8);
}

function highlightCode(source: string) {
  // Recognize unfinished comments and strings too, so highlighting survives edits.
  const pattern = /(?<comment>\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(?<string>"(?:[^"\\\n]|\\[^\n])*"?)|(?<number>(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?[fFdD]?)|(?<call>[A-Za-z_]\w*(?=\s*\())|[A-Za-z_]\w*/g;
  const parts: ReactNode[] = [];
  let end = 0;
  for (const match of source.matchAll(pattern)) {
    const [token] = match;
    const { index, groups } = match;
    const kind = groups?.comment ? 'comment'
      : groups?.string ? 'string'
      : groups?.number ? 'number'
      : keywords.has(token) ? 'keyword'
      : groups?.call !== undefined ? 'call'
      : undefined;
    parts.push(source.slice(end, index), kind ? <span key={index} className={'syntax-'+kind}>{token}</span> : token);
    end = index + token.length;
  }
  parts.push(source.slice(end));
  return parts;
}

export function Editor({ code,line,issue,inputRef,issueRowRef,onChange,onRestore }:Props) {
  const selection=useRef<{ start:number; end:number; direction:'forward'|'backward'|'none' }>(undefined);
  const releaseTab=useRef(false);
  const [scrollLeft,setScrollLeft]=useState(0);
  const source=normalizeSource(code);
  const ink=useMemo(()=>highlightCode(source),[source]);
  const rows=source.split('\n');
  const issueLine=issue?.span?.line;
  useLayoutEffect(()=>{
    const input=inputRef.current;
    if(!input) return;
    input.scrollTop=0;
    if(selection.current) {
      const {start,end,direction}=selection.current;
      input.setSelectionRange(start,end,direction);
      selection.current=undefined;
    }
  },[inputRef,source]);
  function indent(event:KeyboardEvent<HTMLTextAreaElement>) {
    if(event.key==='Escape') { releaseTab.current=true; return; }
    if(event.key!=='Tab' || releaseTab.current || event.ctrlKey || event.metaKey || event.altKey || event.nativeEvent.isComposing) {
      releaseTab.current=false;
      return;
    }
    event.preventDefault();
    const input=event.currentTarget;
    const start=input.selectionStart, end=input.selectionEnd;
    const lineStart=start===0 ? 0 : source.lastIndexOf('\n',start-1)+1;
    const selectedEnd=end>start && source[end-1]==='\n' ? end-1 : end;
    const nextNewline=source.indexOf('\n',selectedEnd);
    const lineEnd=nextNewline===-1 ? source.length : nextNewline;
    const edits: { at:number; remove:number; insert:string }[]=[];
    if(start===end && !event.shiftKey) {
      edits.push({at:start,remove:0,insert:'    '});
    } else {
      let at=lineStart;
      for(const text of source.slice(lineStart,lineEnd).split('\n')) {
        const remove=event.shiftKey ? (text.match(/^(?:\t| {1,4})/)?.[0].length ?? 0) : 0;
        edits.push({at,remove,insert:event.shiftKey ? '' : '    '});
        at+=text.length+1;
      }
    }
    const from=edits[0].at;
    const last=edits[edits.length-1];
    const to=last.at+last.remove;
    let replacement=source.slice(from,to);
    for(const edit of edits.toReversed()) {
      const offset=edit.at-from;
      replacement=replacement.slice(0,offset)+edit.insert+replacement.slice(offset+edit.remove);
    }
    if(source.length+replacement.length-(to-from)>SOURCE_LIMIT || replacement===source.slice(from,to)) return;
    const shifted=(position:number)=>position+edits.reduce((delta,edit)=>
      delta+(edit.at<=position ? edit.insert.length-Math.min(edit.remove,position-edit.at) : 0),0);
    selection.current={start:shifted(start),end:shifted(end),direction:input.selectionDirection};
    input.setSelectionRange(from,to);
    // Native insertion keeps indentation in the textarea's undo history.
    if(!document.execCommand('insertText',false,replacement)) {
      onChange(source.slice(0,from)+replacement+source.slice(to));
    }
  }
  return <section className="editor-panel" aria-label="C# program">
    <div className="panel-heading"><span><Icon name="code"/> Program</span><button className="small-button" type="button" onClick={onRestore}>Restore starter</button></div>
    <span id="editor-keyboard-help" className="sr-only">Tab indents. Shift+Tab outdents. Press Escape then Tab to leave the editor.</span>
    <div className="editor-box" style={{minHeight:`calc(${Math.max(14,rows.length+1)} * var(--line-height) + 32px)`}}>
      <div className="code-background" aria-hidden="true">
        {rows.map((_,i)=>{
          const marked=i+1===issueLine;
          const style=marked ? (issue?.category==='flight' ? ' code-blocked' : ' code-error') : (i+1===line ? ' code-active' : '');
          return <div key={i} ref={marked ? issueRowRef : undefined} className={'code-row'+style}>
            <span>{i+1}</span>
          </div>;
        })}
      </div>
      <div className="code-ink" aria-hidden="true">
        <pre style={{translate:(-scrollLeft)+'px 0'}}>{ink}</pre>
      </div>
      <textarea ref={inputRef} aria-label="C# code" aria-describedby="editor-keyboard-help" value={source} onChange={e=>onChange(e.target.value)}
        aria-invalid={issue?.category==='code' || issue?.category==='limit'}
        maxLength={SOURCE_LIMIT} onKeyDown={indent} onBlur={()=>{releaseTab.current=false;}}
        onScroll={e=>setScrollLeft(e.currentTarget.scrollLeft)}
        spellCheck={false} autoCapitalize="off" autoCorrect="off" autoComplete="off" wrap="off"/>
    </div>
  </section>;
}

import type { ReactNode } from 'react';
const paths: Record<string, ReactNode> = {
  logo: <><path d="M4 14h16M4 10h16M7 6l3 4m7-4-3 4M7 18l3-4m7 4-3-4"/><rect x="9" y="9" width="6" height="6" rx="2"/><path d="M2 8h4m-4 8h4m12-8h4m-4 8h4"/></>,
  sad: <><path d="M7 8h.01M17 8h.01"/><path d="M7 17a5 5 0 0 1 10 0"/></>,
  surprised: <><path d="M7 7v2m10-2v2"/><circle cx="12" cy="15" r="3"/></>,
  battery:<><rect x="2" y="6" width="17" height="12" rx="3"/><path d="M22 10v4m-10-5-3 4h4l-2 2"/></>,
  crosshair:<><circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/></>,
  speaker:<><path d="M3 10v4h4l5 4V6l-5 4zm13-1a4 4 0 0 1 0 6m2-9a8 8 0 0 1 0 12"/></>,
  mute:<><path d="M3 10v4h4l5 4V6l-5 4zm13 0 5 5m0-5-5 5"/></>,
  fullscreen:<path d="M9 4H4v5m11-5h5v5m0 6v5h-5m-6 0H4v-5"/>,
  exitFullscreen:<path d="M4 9h5V4m6 0v5h5m0 6h-5v5m-6 0v-5H4"/>,
  play:<path d="m8 5 12 7-12 7z" fill="currentColor" stroke="none"/>,
  reset:<><path d="M4.9 8a8 8 0 1 1-.7 6M4 4v5h5"/></>,
  arrow:<path d="M4 12h15m-5-5 5 5-5 5"/>,
  chevron:<path d="m7 10 5 5 5-5"/>,
  code:<path d="m7 7-5 5 5 5m10-10 5 5-5 5m-3-12-4 14"/>,
  tick:<path d="m4 13 5 5L20 7"/>,
  warning:<><path d="M10.3 4.3 2.8 17A2 2 0 0 0 4.5 20h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4m0 3h.01"/></>,
  close:<path d="m6 6 12 12M18 6 6 18"/>,
  sprout:<><path d="M12 21v-8m0 1c-5 0-8-4-8-8 5 0 8 2 8 7m0 0c1-6 4-8 8-8 0 5-3 8-8 9"/></>,
  petals:<><path d="M12 22v-8m0 6 5-3"/><circle cx="12" cy="9" r="3"/><path d="M8 8a3 3 0 1 1 3-3m2 0a3 3 0 1 1 3 3m0 2a3 3 0 1 1-3 3m-2 0a3 3 0 1 1-3-3"/></>,
};
export function Icon({ name, size=18 }: { name:keyof typeof paths; size?:number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

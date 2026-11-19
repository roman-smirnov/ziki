import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/nunito/latin-600.css';
import '@fontsource/nunito/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import App from './ui/App.tsx';
import './styles.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>);

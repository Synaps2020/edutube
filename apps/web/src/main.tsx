import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider } from './ui/auth-context';
import { App } from './ui/App';
import './ui/styles.css';
import './ui/home.css';
import './ui/learning.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);

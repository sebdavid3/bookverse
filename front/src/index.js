import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Asegúrate que este es el que tiene @import url y reseteos
import App from './App';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
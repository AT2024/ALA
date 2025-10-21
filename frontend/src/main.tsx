import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App';
import './index.css';
// TODO: Re-add performance monitoring after proper npm install with web-vitals
// import { logPerformanceMetrics } from './utils/performance';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

// TODO: Enable performance monitoring in development mode
// if (import.meta.env && import.meta.env.DEV) {
//   logPerformanceMetrics();
// }

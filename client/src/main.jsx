import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// The typeface travels inside the build, so a clinic with no internet still
// draws it. Only the Latin weights are shipped; the file is about 34 KB.
import '@fontsource-variable/archivo';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

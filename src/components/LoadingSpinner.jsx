import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="loader-container">
      <div className="spinner"></div>
      <p style={{ marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading data...</p>
    </div>
  );
}

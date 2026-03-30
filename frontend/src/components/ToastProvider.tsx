'use client';

import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '14px',
          background: '#fff6e8',
          color: '#2f251d',
          border: '1px solid #ceb38d',
          boxShadow: '0 10px 24px rgba(77, 52, 33, 0.16)',
        },
        success: {
          iconTheme: { primary: '#395c3d', secondary: '#f8efe0' },
        },
        error: {
          duration: 6000,
        },
      }}
    />
  );
}

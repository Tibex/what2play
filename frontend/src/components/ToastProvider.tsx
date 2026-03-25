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
        },
        success: {
          iconTheme: { primary: '#4f46e5', secondary: '#fff' },
        },
        error: {
          duration: 6000,
        },
      }}
    />
  );
}

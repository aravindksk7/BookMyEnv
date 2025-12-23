'use client';

import * as React from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { ThemeContextProvider } from '@/contexts/ThemeContext';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>BookMyEnv - Environment Booking System</title>
        <meta name="description" content="Book and manage test environments efficiently" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </head>
      <body>
        <ThemeContextProvider>
          <AuthProvider>
            <div id="__next">{children}</div>
          </AuthProvider>
        </ThemeContextProvider>
      </body>
    </html>
  );
}

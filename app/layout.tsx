import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sortie design system',
  description: 'A locked, APCA-verified design system for shipping accessible product interfaces',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

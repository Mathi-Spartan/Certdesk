import { Inter, Inter_Tight, Geist_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const interTight = Inter_Tight({ subsets: ['latin'], variable: '--font-display' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata = {
  title: 'CertDesk Console',
  description: 'Manage the full lifecycle of your SSL/TLS certificates.'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${inter.variable} ${interTight.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

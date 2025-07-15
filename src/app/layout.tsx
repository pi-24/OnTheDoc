
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/contexts/AuthContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

// If you have the Inter font files locally, you would set it up like this:
// const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
// For Google Fonts via <link>, ensure the class name matches.
// Since the project guideline is to use <link> elements for Google Fonts,
// we will ensure the className on body uses a generic name like 'font-body'
// which is then configured in tailwind.config.ts to use 'Inter'.

export const metadata: Metadata = {
  title: 'OnTheDoc - NHS Rota Compliance & Salary Tool',
  description: 'Easily input your rota, check compliance against NHS guidelines, and estimate your salary with OnTheDoc.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased flex flex-col min-h-screen">
        <AuthProvider>
          <Header />
          <main className="flex-grow container mx-auto px-4 py-8">
            {children}
          </main>
          <Footer />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}

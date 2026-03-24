import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: 'PPO vs Human · Pong',
  description: 'Comparing PPO reinforcement learning agents vs human baseline on Atari Pong',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-white min-h-screen">
        <Navbar />
        <main className="ml-52 min-h-screen p-8 max-w-5xl">
          {children}
        </main>
      </body>
    </html>
  );
}

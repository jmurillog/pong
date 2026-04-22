'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  TrendingUp,
  BarChart2,
  Users,
  Gamepad2,
  Play,
  FileText,
} from 'lucide-react';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/training', label: 'Training', icon: TrendingUp },
  { href: '/evaluation', label: 'Evaluation', icon: BarChart2 },
  { href: '/human-baseline', label: 'Human Baseline', icon: Users },
  { href: '/play', label: 'Play Pong', icon: Gamepad2 },
  { href: '/watch-ai', label: 'Stephano AI', icon: Play },
  { href: '/report', label: 'Report', icon: FileText },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 h-screen w-52 bg-zinc-950 border-r border-zinc-800 flex flex-col z-40">
      {/* Project name */}
      <div className="px-4 py-5 border-b border-zinc-800">
        <span className="text-xs text-zinc-500 font-medium">PPO · Pong</span>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-3">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={
                active
                  ? 'flex items-center gap-3 px-4 py-2.5 text-sm text-white bg-zinc-800 border-l-2 border-blue-500'
                  : 'flex items-center gap-3 px-4 py-2.5 text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 border-l-2 border-transparent transition-colors'
              }
            >
              <Icon size={15} strokeWidth={1.75} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-zinc-800">
        <span className="text-xs text-zinc-700">IE University · 2026</span>
      </div>
    </nav>
  );
}

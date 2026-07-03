'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { LogOut, Home, FileText, Zap, DollarSign, LayoutDashboard, Edit3 } from 'lucide-react';

function NavLink({ href, icon, label, highlight }: { href: string; icon: React.ReactNode; label: string; highlight?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition text-sm font-medium ${
        isActive
          ? 'bg-blue-50 text-blue-700'
          : highlight
          ? 'text-blue-600 hover:bg-blue-50'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon}
      <span>{label}</span>
      {highlight && !isActive && (
        <span className="ml-auto bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">New</span>
      )}
    </Link>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }
    if (!isLoading && isAuthenticated && user?.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || user?.role !== 'admin') return null;

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-white shadow-sm border-r border-gray-200 flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <h1 className="text-xl font-bold text-gray-900">Vidrow</h1>
          <p className="text-xs text-gray-400 mt-0.5">Production Portal</p>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 px-3 overflow-y-auto">
          <NavLink href="/dashboard" icon={<Home className="w-4 h-4" />} label="Dashboard" />
          <NavLink href="/team-board" icon={<LayoutDashboard className="w-4 h-4" />} label="Script Assigner" highlight />

          <div className="pt-4 pb-1 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Production</div>
          <NavLink href="/scripts" icon={<FileText className="w-4 h-4" />} label="Scripts" />
          <NavLink href="/editors" icon={<Edit3 className="w-4 h-4" />} label="Editors" />

        </nav>

        <div className="p-3 border-t border-gray-100">
          <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
            <p className="text-xs text-gray-500">Logged in as</p>
            <p className="text-xs font-semibold text-gray-800 truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium py-2 px-3 rounded-lg transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}

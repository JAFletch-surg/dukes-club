'use client'
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home, Video, Play, Mic, BookOpen, FileText, Globe, Users,
  Settings, ArrowLeft, LogOut, Menu, X, Search, ShieldCheck, ExternalLink,
} from "lucide-react";

import { useAuth } from "@/lib/use-auth";

const navSections = [
  {
    label: "LEARN",
    items: [
      { title: "Dashboard", path: "/members", icon: Home, end: true },
      { title: "Video Archive", path: "/members/videos", icon: Video },
      { title: "Live Webinars", path: "/members/webinars", icon: Play },
      { title: "Podcasts", path: "/members/podcasts", icon: Mic },
    ],
  },
  {
    label: "EXAMS",
    items: [
      { title: "FRCS Resources", path: "/members/frcs", icon: BookOpen },
      { title: "Question Bank", path: "/members/questions", icon: FileText },
    ],
  },
  {
    label: "NETWORK",
    items: [
      { title: "Fellowships", path: "/members/fellowships", icon: Globe },
      { title: "Member Directory", path: "/members/directory", icon: Users },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { title: "My Profile", path: "/members/profile", icon: Settings },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { title: "CMS / Admin Panel", path: "/admin", icon: ShieldCheck, external: true },
    ],
  },
];

const MembersLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut, isAdmin } = useAuth();
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?';

  const isActive = (path: string, end?: boolean) => {
    if (end) return pathname === path;
    return pathname.startsWith(path);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-navy-foreground/10">
        <Link href="/" className="flex items-center gap-2">
          <img src="/images/logo-white.png" alt="Dukes' Club" className="h-8" />
        </Link>
        <p className="text-navy-foreground/50 text-xs mt-1 font-medium tracking-wider">MEMBERS PORTAL</p>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navSections.filter(s => s.label !== 'ADMIN' || isAdmin).map((section) => (
          <div key={section.label}>
            <p className="text-navy-foreground/40 text-[11px] font-semibold tracking-widest px-3 mb-2">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isExternal = (item as any).external;
                const active = !isExternal && isActive(item.path, (item as any).end);
                const className = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "text-gold bg-navy-foreground/5 border-l-[3px] border-gold -ml-px"
                    : "text-navy-foreground/70 hover:text-navy-foreground hover:bg-navy-foreground/5"
                }`;

                if (isExternal) {
                  return (
                    <a
                      key={item.path}
                      href={item.path}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setSidebarOpen(false)}
                      className={className}
                    >
                      <item.icon size={18} />
                      <span>{item.title}</span>
                      <ExternalLink size={12} className="ml-auto text-navy-foreground/40" />
                    </a>
                  );
                }

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={className}
                  >
                    <item.icon size={18} />
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-navy-foreground/10 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 text-sm text-navy-foreground/60 hover:text-navy-foreground transition-colors rounded-lg hover:bg-navy-foreground/5"
        >
          <ArrowLeft size={18} />
          <span>Back to Site</span>
        </Link>
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 text-sm text-navy-foreground/60 hover:text-navy-foreground transition-colors rounded-lg hover:bg-navy-foreground/5 w-full">
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[260px] bg-navy shrink-0">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-[260px] h-full bg-navy flex flex-col z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 bg-card border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden text-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={22} />
            </button>
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 w-64 h-9 bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground hidden sm:inline">
              {profile?.full_name || 'Member'}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-navy text-navy-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};

export default MembersLayout;
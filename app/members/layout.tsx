'use client'
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Home, Video, Play, Mic, BookOpen, FileText, Globe, Users,
  Settings, ArrowLeft, LogOut, Menu, X, Search, ShieldCheck, ExternalLink, Award, MessageSquare, Calendar,
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
      { title: "Messages", path: "/members/messages", icon: MessageSquare },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { title: "My Certificates", path: "/members/certificates", icon: Award },
      { title: "My Profile", path: "/members/profile", icon: Settings },
    ],
  },
  {
    label: "ADMIN",
    items: [
      { title: "CMS / Admin Panel", path: "/admin", icon: ShieldCheck },
    ],
  },
];

// Bottom nav items for mobile — the 5 most important sections
const bottomNavItems = [
  { title: "Home", path: "/members", icon: Home, end: true },
  { title: "Videos", path: "/members/videos", icon: Video },
  { title: "Questions", path: "/members/questions", icon: FileText },
  { title: "Events", path: "/events", icon: Calendar },
  { title: "Profile", path: "/members/profile", icon: Settings },
];

const MembersLayout = ({ children }: { children: React.ReactNode }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { profile, signOut, isAdmin } = useAuth();
  const initials = profile?.full_name?.split(' ').map((n: string) => n[0]).join('') || '?';

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const isActive = (path: string, end?: boolean) => {
    if (end) return pathname === path;
    return pathname.startsWith(path);
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-navy-foreground/10">
        <Link href="/" className="block">
          <img src="/images/logo-white.png" alt="Dukes' Club" className="h-10 max-w-[180px] object-contain" />
        </Link>
        <div className="flex items-center gap-2 mt-3">
          <div className="w-5 h-px bg-gold" />
          <p className="text-gold/80 text-[11px] font-semibold tracking-[0.2em]">MEMBERS PORTAL</p>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-5">
        {navSections.filter(s => s.label !== 'ADMIN' || isAdmin).map((section) => (
          <div key={section.label}>
            <p className="text-navy-foreground/30 text-[10px] font-bold tracking-[0.18em] uppercase px-3 mb-1.5">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isExternal = (item as any).external;
                const active = !isExternal && isActive(item.path, (item as any).end);
                const className = `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? "text-gold bg-gold/10 border-l-[3px] border-gold -ml-px shadow-sm"
                    : "text-navy-foreground/60 hover:text-navy-foreground hover:bg-navy-foreground/5"
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
      <div className="px-3 py-3 border-t border-navy-foreground/10 space-y-0.5">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-navy-foreground/50 hover:text-navy-foreground transition-colors rounded-lg hover:bg-navy-foreground/5"
        >
          <ArrowLeft size={16} />
          <span>Back to Site</span>
        </Link>
        <button onClick={signOut} className="flex items-center gap-3 px-3 py-2.5 text-[13px] text-navy-foreground/50 hover:text-navy-foreground transition-colors rounded-lg hover:bg-navy-foreground/5 w-full">
          <LogOut size={16} />
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

      {/* Mobile Sidebar Overlay — animated */}
      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="absolute inset-0 bg-foreground/50" onClick={() => setSidebarOpen(false)} />
        <aside
          className={`relative w-[280px] h-full bg-navy flex flex-col z-10 shadow-2xl transition-transform duration-300 ease-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-5 right-4 text-navy-foreground/40 hover:text-navy-foreground transition-colors z-20"
          >
            <X size={20} />
          </button>
          {sidebarContent}
        </aside>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header — navy branded */}
        <header className="lg:hidden bg-navy shrink-0">
          <div className="flex items-center justify-between px-4 h-14">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-navy-foreground/70 hover:text-navy-foreground transition-colors"
              >
                <Menu size={22} />
              </button>
              <Link href="/members" className="flex items-center gap-2">
                <img src="/images/logo-white.png" alt="Dukes' Club" className="h-7 object-contain" />
              </Link>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/members/profile">
                <Avatar className="h-8 w-8 ring-2 ring-navy-foreground/20">
                  <AvatarFallback className="bg-gold text-gold-foreground text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Link>
            </div>
          </div>
          {/* Gold accent line */}
          <div className="h-[2px] bg-gradient-to-r from-gold via-gold/60 to-transparent" />
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex h-14 bg-card border-b border-border items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search..."
                className="pl-9 w-64 h-9 bg-background"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-foreground">
              {profile?.full_name || 'Member'}
            </span>
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-navy text-navy-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Content — add bottom padding on mobile for bottom nav */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
          <div className="flex items-center justify-around h-16 px-2 safe-area-pb">
            {bottomNavItems.map((item) => {
              const active = isActive(item.path, item.end);
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg transition-colors min-w-0 ${
                    active
                      ? "text-gold"
                      : "text-muted-foreground"
                  }`}
                >
                  <item.icon size={20} strokeWidth={active ? 2.5 : 2} />
                  <span className={`text-[10px] font-medium truncate ${active ? "text-gold" : ""}`}>
                    {item.title}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
};

export default MembersLayout;

'use client'
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/lib/use-auth";

const navLinks = [
  { label: "Home", path: "/" },
  { label: "About", path: "/about" },
  { label: "Events & Courses", path: "/events" },
  { label: "News & Blog", path: "/news" },
  { label: "Exams & Training", path: "/exams" },
  { label: "Contact", path: "/contact" },
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const { user, loading, signOut } = useAuth();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-navy/95 backdrop-blur-md border-b border-navy-foreground/10">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <Link href="/" className="flex items-center">
          <img src="/images/logo-white.png" alt="The Dukes' Club" className="h-10" />
        </Link>

        {/* Desktop Nav */}
        <div className="hidden lg:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                pathname === link.path
                  ? "text-gold"
                  : "text-navy-foreground/80 hover:text-navy-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {!loading && user ? (
            <>
              <Link href="/members">
                <Button variant="hero" size="sm" className="ml-2">
                  Members Area
                </Button>
              </Link>
              <Button variant="gold" size="sm" onClick={signOut}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="hero" size="sm" className="ml-2">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button variant="gold" size="sm">
                  Join
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <button
          className="lg:hidden text-navy-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-navy border-t border-navy-foreground/10 px-4 pb-4">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              href={link.path}
              onClick={() => setMobileOpen(false)}
              className={`block py-2 text-sm font-medium ${
                pathname === link.path
                  ? "text-gold"
                  : "text-navy-foreground/80"
              }`}
            >
              {link.label}
            </Link>
          ))}
          {!loading && user ? (
            <>
              <Link href="/members" onClick={() => setMobileOpen(false)}>
                <Button variant="hero" size="sm" className="mt-2 w-full">
                  Members Area
                </Button>
              </Link>
              <Button variant="gold" size="sm" className="mt-2 w-full" onClick={() => { signOut(); setMobileOpen(false); }}>
                Logout
              </Button>
            </>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button variant="hero" size="sm" className="mt-2 w-full">
                  Login
                </Button>
              </Link>
              <Link href="/register" onClick={() => setMobileOpen(false)}>
                <Button variant="gold" size="sm" className="mt-2 w-full">
                  Join
                </Button>
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
'use client'
import Link from "next/link";
import { ReactNode } from "react";


import { Shield, Users, BookOpen } from "lucide-react";

const features = [
  { icon: BookOpen, text: "Exclusive educational content & FRCS resources" },
  { icon: Users, text: "Connect with the colorectal surgery community" },
  { icon: Shield, text: "Member-only events, fellowships & webinars" },
];

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex">
      {/* Left branding panel — hidden on mobile */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] bg-navy relative overflow-hidden flex-col justify-between p-10">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gold/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gold/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full border border-navy-foreground/5" />

        <div className="relative z-10">
          <Link href="/">
            <img src="/images/logo-white.png" alt="The Dukes' Club" className="h-12 mb-2" />
          </Link>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-navy-foreground leading-tight">
              The home of
              <br />
              <span className="text-gold">colorectal surgery</span>
              <br />
              excellence
            </h2>
            <p className="text-navy-foreground/60 mt-4 text-sm leading-relaxed max-w-sm">
              Join a community of surgeons dedicated to advancing training, education and research in colorectal surgery.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-shrink-0 h-9 w-9 rounded-lg bg-gold/10 flex items-center justify-center">
                  <f.icon size={18} className="text-gold" />
                </div>
                <p className="text-sm text-navy-foreground/80">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs text-navy-foreground/40">
            © {new Date().getFullYear()} The Dukes' Club. All rights reserved.
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col min-h-screen bg-background">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 bg-navy">
          <Link href="/">
            <img src="/images/logo-white.png" alt="The Dukes' Club" className="h-9" />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;

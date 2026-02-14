'use client'
import Link from "next/link";

import { Twitter, Instagram, Linkedin, Mail } from "lucide-react";



const Footer = () => {
  return (
    <footer className="relative text-navy-foreground overflow-hidden">
      {/* Abstract background image */}
      <div className="absolute inset-0">
        <img
          src="/images/footer-abstract.jpg"
          alt=""
          className="w-full h-full object-cover"
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-navy/80" />
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <img src="/images/logo-white.png" alt="The Dukes' Club" className="h-12 mb-4" />
            <p className="text-sm text-navy-foreground/60">
              The UK's leading colorectal surgery trainee society, supporting the next generation of colorectal surgeons.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-wider uppercase text-gold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-sm text-navy-foreground/70">
              <li><Link href="/about" className="hover:text-navy-foreground transition-colors">About Us</Link></li>
              <li><Link href="/events" className="hover:text-navy-foreground transition-colors">Events & Courses</Link></li>
              <li><Link href="/exams" className="hover:text-navy-foreground transition-colors">Exams & Training</Link></li>
              <li><Link href="/annual-weekend" className="hover:text-navy-foreground transition-colors">Annual Weekend</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-wider uppercase text-gold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-navy-foreground/70">
              <li><Link href="/news" className="hover:text-navy-foreground transition-colors">News & Blog</Link></li>
              <li><Link href="/contact" className="hover:text-navy-foreground transition-colors">Contact Us</Link></li>
              <li><Link href="/join" className="hover:text-navy-foreground transition-colors">Join / Login</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-wider uppercase text-gold mb-4">Connect</h4>
            <div className="flex items-center gap-4">
              <a href="#" className="text-navy-foreground/60 hover:text-gold transition-colors"><Twitter size={20} /></a>
              <a href="#" className="text-navy-foreground/60 hover:text-gold transition-colors"><Instagram size={20} /></a>
              <a href="#" className="text-navy-foreground/60 hover:text-gold transition-colors"><Linkedin size={20} /></a>
              <a href="#" className="text-navy-foreground/60 hover:text-gold transition-colors"><Mail size={20} /></a>
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-navy-foreground/10 text-center text-xs text-navy-foreground/40">
          © {new Date().getFullYear()} Dukes' Club. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;

'use client'
import Link from "next/link";
import Image from "next/image";

import { Twitter, Instagram, Linkedin, Mail } from "lucide-react";

import logoWhite from "@/public/images/logo-white.png";
import footerAbstract from "@/public/images/footer-abstract.jpg";



const Footer = () => {
  return (
    <footer className="relative text-navy-foreground overflow-hidden">
      {/* Abstract background image */}
      <div className="absolute inset-0">
        <Image
          src={footerAbstract}
          alt=""
          fill
          aria-hidden="true"
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-navy/80" />
      </div>

      <div className="relative container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Image src={logoWhite} alt="The Dukes' Club" className="h-12 w-auto mb-4" sizes="168px" />
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
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold tracking-wider uppercase text-gold mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-navy-foreground/70">
              <li><Link href="/news" className="hover:text-navy-foreground transition-colors">News & Blog</Link></li>
              <li><Link href="/contact" className="hover:text-navy-foreground transition-colors">Contact Us</Link></li>
              <li><Link href="/register" className="hover:text-navy-foreground transition-colors">Join / Login</Link></li>
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
          <p>© {new Date().getFullYear()} Dukes&apos; Club. All rights reserved.</p>
          <p className="mt-1">Designed by Jordan Fletcher</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

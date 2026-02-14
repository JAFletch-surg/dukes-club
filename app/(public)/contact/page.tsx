'use client'
import { useState } from "react";


import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, MapPin, Send, CheckCircle } from "lucide-react";
import { useScrollAnimation } from "@/hooks/use-scroll-animation";
import { cn } from "@/lib/utils";


const AnimatedSection = ({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const { ref, isVisible } = useScrollAnimation(0.1);
  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-700 ease-out",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const ContactPage = () => {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Wire up to backend
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-background">
      

      {/* Hero */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0">
          <video
            className="w-full h-full object-cover"
            src="/videos/hero-bg.mp4"
            muted
            autoPlay
            loop
            playsInline
          />
          <div className="absolute inset-0 bg-navy/70" />
          <div className="absolute inset-0 bg-gradient-to-b from-navy/40 via-transparent to-navy" />
        </div>
        <div className="relative container mx-auto px-4 py-20 md:py-28">
          <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-3 animate-fade-in">
            Get in Touch
          </p>
          <h1 className="text-4xl md:text-5xl font-sans font-bold text-navy-foreground animate-fade-in">
            Contact Us
          </h1>
          <p className="mt-4 text-navy-foreground/80 max-w-2xl text-base md:text-lg animate-fade-in">
            Have a question about membership, events, or training? We'd love to hear from you.
          </p>
        </div>
      </section>

      {/* Main Content */}
      <section className="bg-background py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-6xl mx-auto">
            {/* Left - Info */}
            <div className="lg:col-span-2">
              <AnimatedSection>
                <div className="flex justify-center mb-10">
                  <img
                    src="/images/logo-contact.png"
                    alt="Dukes' Club"
                    className="h-32"
                  />
                </div>
                <p className="text-foreground/70 leading-relaxed mb-8">
                  The Dukes' Club is the national trainee association for colorectal surgery in the United Kingdom. Whether you're a current member or considering joining, we're here to help.
                </p>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center shrink-0">
                      <Mail size={18} className="text-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Email
                      </p>
                      <a
                        href="mailto:info@dukesclub.org.uk"
                        className="text-sm text-foreground/70 hover:text-gold transition-colors"
                      >
                        info@dukesclub.org.uk
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center shrink-0">
                      <MapPin size={18} className="text-gold" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground mb-1">
                        Address
                      </p>
                      <p className="text-sm text-foreground/70">
                        c/o The Association of Coloproctology<br />
                        of Great Britain and Ireland<br />
                        35–43 Lincoln's Inn Fields<br />
                        London WC2A 3PE
                      </p>
                    </div>
                  </div>
                </div>
              </AnimatedSection>
            </div>

            {/* Right - Form */}
            <div className="lg:col-span-3">
              <AnimatedSection delay={150}>
                <div className="rounded-xl border border-border bg-card p-8 md:p-10 shadow-sm">
                  {submitted ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-6">
                        <CheckCircle size={32} className="text-gold" />
                      </div>
                      <h3 className="text-2xl font-sans font-bold text-foreground mb-3">
                        Message Sent
                      </h3>
                      <p className="text-foreground/70 max-w-md mx-auto">
                        Thank you for getting in touch. A member of our committee will respond to your enquiry as soon as possible.
                      </p>
                      <Button
                        variant="outline"
                        className="mt-8"
                        onClick={() => {
                          setSubmitted(false);
                          setName("");
                          setEmail("");
                          setSubject("");
                          setMessage("");
                        }}
                      >
                        Send another message
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h2 className="text-2xl font-sans font-bold text-foreground mb-1">
                        Send a Message
                      </h2>
                      <p className="text-sm text-foreground/60 mb-8">
                        Fill in the form below and we'll get back to you shortly.
                      </p>
                      <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                          <div className="space-y-2">
                            <Label htmlFor="name" className="text-foreground/80">
                              Full Name
                            </Label>
                            <Input
                              id="name"
                              placeholder="Your name"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                              maxLength={100}
                              className="bg-background border-border"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="email" className="text-foreground/80">
                              Email Address
                            </Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="you@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              maxLength={255}
                              className="bg-background border-border"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="subject" className="text-foreground/80">
                            Subject
                          </Label>
                          <Select value={subject} onValueChange={setSubject} required>
                            <SelectTrigger className="bg-background border-border">
                              <SelectValue placeholder="Select a topic" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="membership">Membership</SelectItem>
                              <SelectItem value="events">Events & Courses</SelectItem>
                              <SelectItem value="annual-weekend">Annual Weekend</SelectItem>
                              <SelectItem value="research">Research & Collaboration</SelectItem>
                              <SelectItem value="sponsorship">Sponsorship</SelectItem>
                              <SelectItem value="website">Website & Technical</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="message" className="text-foreground/80">
                            Message
                          </Label>
                          <Textarea
                            id="message"
                            placeholder="How can we help?"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            maxLength={2000}
                            rows={5}
                            className="bg-background border-border resize-none"
                          />
                        </div>

                        <Button
                          type="submit"
                          variant="gold"
                          size="lg"
                          className="w-full sm:w-auto"
                        >
                          Send Message <Send size={16} className="ml-2" />
                        </Button>
                      </form>
                    </>
                  )}
                </div>
              </AnimatedSection>
            </div>
          </div>
        </div>
      </section>

      
    </div>
  );
};

export default ContactPage;

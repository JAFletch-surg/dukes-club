'use client'
import Link from "next/link";
import { UserPlus, CreditCard, ShieldCheck, ArrowRight, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACPGBI_MEMBERSHIP_URL } from "@/lib/constants/links";

const steps = [
  {
    number: 1,
    icon: CreditCard,
    title: "Join ACPGBI",
    description: "Apply for ACPGBI trainee membership (£95/year). Dukes' Club access is included with your membership.",
  },
  {
    number: 2,
    icon: UserPlus,
    title: "Create your account",
    description: "Register with your NHS or academic email for instant trainee access, or any email for manual approval.",
  },
  {
    number: 3,
    icon: ShieldCheck,
    title: "Submit your ACPGBI number",
    description: "Enter your ACPGBI membership number in your profile to unlock full member access to courses, events, and resources.",
  },
];

const HowToJoinSection = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-sans font-bold text-foreground">
            How to Join
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-muted-foreground">
            The Dukes&apos; Club is the trainee network of the ACPGBI, open to all doctors with an interest in colorectal surgery.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto mb-10">
          {steps.map((step) => (
            <div key={step.number} className="relative text-center">
              <div className="mx-auto w-14 h-14 rounded-full bg-navy flex items-center justify-center mb-4">
                <step.icon className="text-white" size={24} />
              </div>
              <div className="absolute -top-2 -right-2 md:top-0 md:right-4 w-7 h-7 rounded-full bg-gold flex items-center justify-center text-sm font-bold text-gold-foreground">
                {step.number}
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>

        <div className="text-center space-y-6">
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Don&apos;t have an ACPGBI number yet? You can still register as a Trainee and access webinars, the question bank, and community features.
          </p>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-4 max-w-md sm:max-w-none mx-auto">
            <Link href="/register" className="sm:w-auto">
              <Button variant="gold" size="lg" className="w-full">
                Register Now <ArrowRight size={16} className="ml-1" />
              </Button>
            </Link>
            <a
              href={ACPGBI_MEMBERSHIP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="sm:w-auto"
            >
              <Button variant="navy" size="lg" className="w-full">
                Get an ACPGBI Membership Number
                <ExternalLink size={16} className="ml-1" />
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowToJoinSection;

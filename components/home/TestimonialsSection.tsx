'use client'
import { Quote } from "lucide-react";

const testimonials = [
  {
    quote: "Dukes' Club was instrumental in my FRCS preparation. The viva courses and question bank gave me the confidence I needed to pass first time.",
    name: "Dr Sarah Mitchell",
    role: "ST7 Colorectal Surgery, Leeds",
  },
  {
    quote: "The Annual Weekend is the highlight of my training year. The networking opportunities and hands-on workshops are unmatched in the UK.",
    name: "Mr James Okonkwo",
    role: "ST6 Colorectal Surgery, Birmingham",
  },
  {
    quote: "The fellowship directory helped me secure a robotic surgery fellowship in Australia. I wouldn't have found it without Dukes' Club.",
    name: "Dr Priya Sharma",
    role: "Post-CCT Fellow, London",
  },
];

const TestimonialsSection = () => {
  return (
    <section className="py-20 bg-card">
      <div className="container mx-auto px-4">
        <div className="text-center mb-14">
          <p className="text-gold font-semibold text-sm tracking-widest uppercase mb-2">
            What Our Members Say
          </p>
          <h2 className="text-3xl md:text-4xl font-sans font-bold text-card-foreground">
            Member Testimonials
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="group p-6 rounded-lg border border-border bg-background hover:shadow-lg transition-all duration-300 hover:-translate-y-1 relative"
            >
              <Quote size={28} className="text-gold/30 mb-4" />
              <p className="text-sm text-foreground/80 leading-relaxed mb-6 italic">
                "{t.quote}"
              </p>
              <div className="border-t border-border pt-4">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsSection;

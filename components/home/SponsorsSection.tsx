'use client'


const sponsors = [
  { name: "ACPGBI", logo: "/images/sponsors/acpgbi.png" },
  { name: "Royal College of Surgeons", logo: null },
  { name: "Medtronic", logo: null },
  { name: "Intuitive Surgical", logo: null },
  { name: "Ethicon", logo: null },
  { name: "Stryker", logo: null },
];

const SponsorsSection = () => {
  return (
    <section className="py-16 bg-background border-t border-border">
      <div className="container mx-auto px-4">
        <p className="text-center text-sm font-semibold tracking-widest uppercase text-muted-foreground mb-10">
          Our Corporate Sponsors & Partners
        </p>
        <div className="flex flex-wrap items-center justify-center gap-10 md:gap-16">
          {sponsors.map((sponsor) => (
            <div
              key={sponsor.name}
              className="flex items-center justify-center h-16 grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
            >
              {sponsor.logo ? (
                <img
                  src={sponsor.logo}
                  alt={sponsor.name}
                  className="h-14 max-w-[180px] object-contain"
                />
              ) : (
                <span className="text-muted-foreground text-lg font-semibold">
                  {sponsor.name}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SponsorsSection;

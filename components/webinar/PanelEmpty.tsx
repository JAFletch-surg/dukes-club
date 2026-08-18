export function PanelEmpty({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="h-full grid place-items-center py-10 px-6 text-center">
      <div>
        <div className="text-navy-foreground/20 flex justify-center mb-2.5">{icon}</div>
        <p className="font-serif text-lg text-navy-foreground/80 mb-1">{title}</p>
        <p className="text-[12.5px] leading-relaxed text-navy-foreground/40 max-w-[26ch] mx-auto">
          {body}
        </p>
      </div>
    </div>
  )
}

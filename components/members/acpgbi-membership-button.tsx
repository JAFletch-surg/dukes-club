'use client'

import { ExternalLink } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/button'
import { ACPGBI_MEMBERSHIP_URL } from '@/lib/constants/links'
import { cn } from '@/lib/utils'

/**
 * "Get an ACPGBI Membership Number" — the half of joining that lives off-site.
 *
 * Joining the Dukes' Club is two steps people conflate: hold an ACPGBI
 * membership number, and have it verified on your profile. The homepage and
 * the registration form already pair the two; every gate that asks a member
 * for a number needs to offer the same way of going and getting one, rather
 * than only pointing at the profile page they have nothing to type into.
 *
 * Use variant="hero" on a dark panel — navy on a dark background disappears.
 */
export function AcpgbiMembershipButton({
  variant = 'navy',
  size = 'default',
  className,
  buttonClassName,
  label = 'Get an ACPGBI Membership Number',
}: {
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
  /** Applied to the link that wraps the button — use it for width. */
  className?: string
  /** Applied to the button itself — use it to match a neighbour's height. */
  buttonClassName?: string
  label?: string
}) {
  return (
    <a
      href={ACPGBI_MEMBERSHIP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <Button type="button" variant={variant} size={size} className={cn('w-full', buttonClassName)}>
        {label}
        <ExternalLink size={15} className="ml-1.5" />
      </Button>
    </a>
  )
}

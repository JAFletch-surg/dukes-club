/**
 * Live webinar surfaces.
 *
 * A separate route group on purpose: the members layout wraps children in a
 * padded scrolling <main> with a fixed mobile bottom nav, and the admin layout
 * wraps everything in the admin chrome — neither of which a full-bleed video
 * stage can live inside. It also puts the guest-speaker route outside the
 * /members and /admin middleware gates, which is what lets a visiting speaker
 * join with no account at all.
 *
 * Each page underneath does its own auth: the attendee page checks the
 * session, the host page checks the admin role, and the speaker page is
 * gated by its magic-link token in the API route that mints its LiveKit
 * credentials.
 */
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-navy min-h-screen">{children}</div>
}

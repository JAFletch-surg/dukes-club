// Event types that stream online (Zoom / Vimeo Live), as opposed to in-person events.
export const STREAMING_EVENT_TYPES = ['Webinar', 'Online Lecture', 'Hybrid'] as const

export function isStreamingEvent(eventType: string | null | undefined): boolean {
  return !!eventType && (STREAMING_EVENT_TYPES as readonly string[]).includes(eventType)
}

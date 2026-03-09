import { Resend } from 'resend'

if (!process.env.RESEND_API_KEY) {
  throw new Error('Missing RESEND_API_KEY environment variable')
}

export const resend = new Resend(process.env.RESEND_API_KEY)

// Change this to your verified domain sender once available
// e.g. 'The Dukes\' Club <noreply@dukesclub.org.uk>'
export const FROM_EMAIL = 'The Dukes\' Club <noreply@dukesclub.org>'

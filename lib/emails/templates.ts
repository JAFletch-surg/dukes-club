// Email templates for The Dukes' Club
// Brand: Navy #0F1F3D, Gold #E5A718

const LOGO_URL = 'https://wdajcvoqpcxtqpfmzndj.supabase.co/storage/v1/object/public/media/Dukes%20club%20modern%20title%20white.png'

function layout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>The Dukes' Club</title>
</head>
<body style="margin:0;padding:0;background-color:#F5F5F0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F5F0;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

          <!-- Header -->
          <tr>
            <td align="center" style="padding:0 0 32px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;">
                <tr>
                  <td style="background-color:#0F1F3D;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
                    <img 
                      src="${LOGO_URL}" 
                      alt="The Dukes' Club" 
                      width="200" 
                      style="display:block;margin:0 auto;max-width:200px;height:auto;" 
                    />
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#FFFFFF;border-radius:0 0 12px 12px;padding:36px 40px;border:1px solid #E8E6E1;border-top:3px solid #E5A718;">
                    ${content}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:0 20px;">
              <p style="margin:0 0 8px;font-size:12px;color:#999;">
                &copy; ${new Date().getFullYear()} The Dukes' Club &mdash; ACPGBI Trainee Network
              </p>
              <p style="margin:0;font-size:11px;color:#BBB;">
                You received this email because you have an account with The Dukes' Club.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function button(text: string, url: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0;">
      <tr>
        <td style="background-color:#E5A718;border-radius:8px;">
          <a href="${url}" target="_blank" style="display:inline-block;padding:14px 32px;font-size:14px;font-weight:700;color:#0F1F3D;text-decoration:none;letter-spacing:0.3px;">
            ${text}
          </a>
        </td>
      </tr>
    </table>`
}

// ─────────────────────────────────────────
// 1. Welcome Email (on registration)
// ─────────────────────────────────────────
export function welcomeEmail(params: {
  name: string
  confirmUrl?: string
  siteUrl: string
}): { subject: string; html: string } {
  const { name, confirmUrl, siteUrl } = params
  const firstName = name.split(' ')[0] || name

  return {
    subject: 'Welcome to The Dukes\' Club',
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        Welcome aboard, ${firstName}!
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Thank you for registering with The Dukes' Club — the trainee network of the Association of Coloproctology of Great Britain and Ireland.
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Your account is being reviewed by our admin team. You'll receive a notification once it's been approved. This usually takes 1–2 working days.
      </p>
      ${confirmUrl ? `
        <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">
          First, please verify your email address:
        </p>
        ${button('Verify Email Address', confirmUrl)}
      ` : ''}
      <p style="margin:0 0 8px;font-size:15px;color:#444;line-height:1.7;">
        In the meantime, here's what you'll have access to once approved:
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 24px;">
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#444;">
            <span style="color:#E5A718;font-weight:700;margin-right:8px;">&#9656;</span> Video archive of surgical lectures and webinars
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#444;">
            <span style="color:#E5A718;font-weight:700;margin-right:8px;">&#9656;</span> FRCS question bank and revision resources
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#444;">
            <span style="color:#E5A718;font-weight:700;margin-right:8px;">&#9656;</span> Fellowship directory and networking
          </td>
        </tr>
        <tr>
          <td style="padding:6px 0;font-size:14px;color:#444;">
            <span style="color:#E5A718;font-weight:700;margin-right:8px;">&#9656;</span> Course and event booking
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:14px;color:#888;">
        If you have any questions, reply to this email or contact us at
        <a href="mailto:contact@dukesclub.org.uk" style="color:#E5A718;text-decoration:none;font-weight:600;">contact@dukesclub.org.uk</a>
      </p>
    `),
  }
}

// ─────────────────────────────────────────
// 2. Account Approval Notification
// ─────────────────────────────────────────
export function approvalEmail(params: {
  name: string
  siteUrl: string
}): { subject: string; html: string } {
  const { name, siteUrl } = params
  const firstName = name.split(' ')[0] || name

  return {
    subject: 'Your Dukes\' Club account has been approved',
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        You're in, ${firstName}!
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Great news — your Dukes' Club account has been approved. You now have full access to the members area.
      </p>
      ${button('Go to Members Area', `${siteUrl}/members`)}
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        We'd recommend completing your profile and browsing the video archive to get started. If there are any upcoming events you're interested in, you can book your place directly from the events page.
      </p>
      <p style="margin:0;font-size:14px;color:#888;">
        Welcome to the community!
      </p>
    `),
  }
}

// ─────────────────────────────────────────
// 3. Account Rejection Notification
// ─────────────────────────────────────────
export function rejectionEmail(params: {
  name: string
  reason?: string
}): { subject: string; html: string } {
  const { name, reason } = params
  const firstName = name.split(' ')[0] || name

  return {
    subject: 'Dukes\' Club account update',
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        Account Update
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Dear ${firstName},
      </p>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Thank you for your interest in The Dukes' Club. Unfortunately, we were unable to approve your account at this time.
      </p>
      ${reason ? `
        <div style="background-color:#FFF8F0;border-left:3px solid #E5A718;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0;">
          <p style="margin:0;font-size:14px;color:#666;line-height:1.6;">${reason}</p>
        </div>
      ` : ''}
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        If you believe this is an error or would like more information, please contact us at
        <a href="mailto:contact@dukesclub.org.uk" style="color:#E5A718;text-decoration:none;font-weight:600;">contact@dukesclub.org.uk</a>.
      </p>
    `),
  }
}

// ─────────────────────────────────────────
// 4. Event Booking Confirmation
// ─────────────────────────────────────────
export function bookingConfirmationEmail(params: {
  name: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  status: 'pending' | 'approved' | 'confirmed'
  siteUrl: string
}): { subject: string; html: string } {
  const { name, eventTitle, eventDate, eventLocation, status, siteUrl } = params
  const firstName = name.split(' ')[0] || name

  const statusMessages: Record<string, { heading: string; message: string }> = {
    pending: {
      heading: 'Application Received',
      message: 'Your application is being reviewed. We\'ll notify you once a decision has been made.',
    },
    approved: {
      heading: 'Booking Confirmed',
      message: 'Your place has been confirmed. We look forward to seeing you there!',
    },
    confirmed: {
      heading: 'Booking Confirmed',
      message: 'Your place has been confirmed. We look forward to seeing you there!',
    },
  }

  const { heading, message } = statusMessages[status] || statusMessages.pending

  return {
    subject: `${heading} — ${eventTitle}`,
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        ${heading}
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Hi ${firstName}, ${message}
      </p>

      <!-- Event details card -->
      <div style="background-color:#F9F8F5;border:1px solid #E8E6E1;border-radius:8px;padding:20px;margin:24px 0;">
        <h3 style="margin:0 0 12px;font-size:16px;font-weight:700;color:#0F1F3D;">
          ${eventTitle}
        </h3>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:4px 12px 4px 0;font-size:13px;color:#888;vertical-align:top;">Date</td>
            <td style="padding:4px 0;font-size:14px;color:#444;font-weight:600;">${eventDate}</td>
          </tr>
          <tr>
            <td style="padding:4px 12px 4px 0;font-size:13px;color:#888;vertical-align:top;">Location</td>
            <td style="padding:4px 0;font-size:14px;color:#444;font-weight:600;">${eventLocation}</td>
          </tr>
          <tr>
            <td style="padding:4px 12px 4px 0;font-size:13px;color:#888;vertical-align:top;">Status</td>
            <td style="padding:4px 0;font-size:14px;color:${status === 'pending' ? '#B7791F' : '#2D6A4F'};font-weight:700;text-transform:capitalize;">${status === 'pending' ? 'Under Review' : 'Confirmed'}</td>
          </tr>
        </table>
      </div>

      ${button('View My Bookings', `${siteUrl}/members/profile`)}

      <p style="margin:0;font-size:14px;color:#888;">
        Need to cancel or have questions? Visit your profile or contact us at
        <a href="mailto:contact@dukesclub.org.uk" style="color:#E5A718;text-decoration:none;font-weight:600;">contact@dukesclub.org.uk</a>
      </p>
    `),
  }
}

// ─────────────────────────────────────────
// 5. Booking Status Update
// ─────────────────────────────────────────
export function bookingStatusEmail(params: {
  name: string
  eventTitle: string
  newStatus: 'approved' | 'rejected' | 'waitlisted' | 'cancelled'
  siteUrl: string
}): { subject: string; html: string } {
  const { name, eventTitle, newStatus, siteUrl } = params
  const firstName = name.split(' ')[0] || name

  const config: Record<string, { subject: string; heading: string; message: string; color: string }> = {
    approved: {
      subject: `Booking Approved — ${eventTitle}`,
      heading: 'You\'re In!',
      message: `Your application for <strong>${eventTitle}</strong> has been approved. Your place is now confirmed.`,
      color: '#2D6A4F',
    },
    rejected: {
      subject: `Booking Update — ${eventTitle}`,
      heading: 'Application Update',
      message: `Unfortunately, your application for <strong>${eventTitle}</strong> was not successful on this occasion. If you have questions, please don't hesitate to get in touch.`,
      color: '#9B2C2C',
    },
    waitlisted: {
      subject: `Waitlisted — ${eventTitle}`,
      heading: 'You\'re on the Waitlist',
      message: `The event <strong>${eventTitle}</strong> is currently at capacity. You've been placed on the waitlist and we'll notify you if a place becomes available.`,
      color: '#6B21A8',
    },
    cancelled: {
      subject: `Booking Cancelled — ${eventTitle}`,
      heading: 'Booking Cancelled',
      message: `Your booking for <strong>${eventTitle}</strong> has been cancelled.`,
      color: '#6B7280',
    },
  }

  const c = config[newStatus] || config.cancelled

  return {
    subject: c.subject,
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        ${c.heading}
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
        Hi ${firstName},
      </p>
      <div style="background-color:#F9F8F5;border-left:4px solid ${c.color};padding:16px 20px;margin:0 0 24px;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:15px;color:#444;line-height:1.7;">
          ${c.message}
        </p>
      </div>
      ${newStatus === 'approved' ? button('View My Bookings', `${siteUrl}/members/profile`) : ''}
      <p style="margin:0;font-size:14px;color:#888;">
        Questions? Contact us at
        <a href="mailto:contact@dukesclub.org.uk" style="color:#E5A718;text-decoration:none;font-weight:600;">contact@dukesclub.org.uk</a>
      </p>
    `),
  }
}

// ─────────────────────────────────────────
// 6. Password Reset
// ─────────────────────────────────────────
export function passwordResetEmail(params: {
  name: string
  resetUrl: string
}): { subject: string; html: string } {
  const { name, resetUrl } = params
  const firstName = name.split(' ')[0] || name

  return {
    subject: 'Reset your Dukes\' Club password',
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        Password Reset
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Hi ${firstName}, we received a request to reset your password. Click the button below to choose a new one:
      </p>
      ${button('Reset Password', resetUrl)}
      <p style="margin:0 0 8px;font-size:14px;color:#888;line-height:1.6;">
        This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
      <p style="margin:0;font-size:12px;color:#BBB;line-height:1.6;">
        If the button doesn't work, copy and paste this URL into your browser:<br/>
        <a href="${resetUrl}" style="color:#E5A718;word-break:break-all;font-size:11px;">${resetUrl}</a>
      </p>
    `),
  }
}

// ─────────────────────────────────────────
// ADDITIONS TO lib/emails/templates.ts
// Add these two functions at the end of the file
// ─────────────────────────────────────────

// 7. Feedback Request
// ─────────────────────────────────────────
export function feedbackRequestEmail(params: {
  name: string
  eventTitle: string
  eventId: string
}): { subject: string; html: string } {
  const { name, eventTitle, eventId } = params
  const firstName = name.split(' ')[0] || name
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dukesclub.org'

  return {
    subject: `We'd love your feedback — ${eventTitle}`,
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        How Was the Event?
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
        Thank you for attending <strong>${eventTitle}</strong>. Your feedback helps us improve future events and ensure we&rsquo;re delivering the best educational experiences for colorectal trainees.
      </p>
      <div style="background-color:#F9F8F5;border-left:4px solid #E5A718;padding:16px 20px;margin:0 0 24px;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:14px;color:#444;line-height:1.7;">
          ⏱️ It takes less than 2 minutes to complete.<br/>
          🏆 You&rsquo;ll receive your certificate of attendance upon completion.
        </p>
      </div>
      ${button('Submit Feedback', `${siteUrl}/members/events/${eventId}/feedback`)}
      <p style="margin:0;font-size:14px;color:#888;line-height:1.6;">
        If you have any questions, contact us at
        <a href="mailto:contact@dukesclub.org.uk" style="color:#E5A718;text-decoration:none;font-weight:600;">contact@dukesclub.org.uk</a>
      </p>
    `),
  }
}

// 8. Admin Notification — New Registration Pending Review
// ─────────────────────────────────────────
export function adminNewRegistrationEmail(params: {
  userName: string
  userEmail: string
  region: string
  trainingStage: string
  siteUrl: string
}): { subject: string; html: string } {
  const { userName, userEmail, region, trainingStage, siteUrl } = params

  return {
    subject: `New registration pending review — ${userName}`,
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        New Member Registration
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
        A new user has registered with a non-NHS email and requires admin review.
      </p>

      <div style="background-color:#F9F8F5;border:1px solid #E8E6E1;border-radius:8px;padding:20px;margin:0 0 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#888;vertical-align:top;width:100px;">Name</td>
            <td style="padding:6px 0;font-size:14px;color:#444;font-weight:600;">${userName}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#888;vertical-align:top;">Email</td>
            <td style="padding:6px 0;font-size:14px;color:#444;font-weight:600;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#888;vertical-align:top;">Region</td>
            <td style="padding:6px 0;font-size:14px;color:#444;font-weight:600;">${region}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#888;vertical-align:top;">Training</td>
            <td style="padding:6px 0;font-size:14px;color:#444;font-weight:600;">${trainingStage}</td>
          </tr>
        </table>
      </div>

      ${button('Review in Admin Panel', `${siteUrl}/admin/members`)}

      <p style="margin:0;font-size:14px;color:#888;">
        You can approve or reject this account from the Members section of the admin panel.
      </p>
    `),
  }
}

// 9. Admin Notification — ACPGBI Membership Number Submitted
// ─────────────────────────────────────────
export function adminMembershipNumberEmail(params: {
  userName: string
  userEmail: string
  acpgbiNumber: string
  siteUrl: string
}): { subject: string; html: string } {
  const { userName, userEmail, acpgbiNumber, siteUrl } = params

  return {
    subject: `ACPGBI number submitted — ${userName}`,
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        Membership Number Submitted
      </h2>
      <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
        A trainee has submitted their ACPGBI membership number for verification. Please review and upgrade their role to <strong>Member</strong> if valid.
      </p>

      <div style="background-color:#F9F8F5;border:1px solid #E8E6E1;border-radius:8px;padding:20px;margin:0 0 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#888;vertical-align:top;width:120px;">Name</td>
            <td style="padding:6px 0;font-size:14px;color:#444;font-weight:600;">${userName}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#888;vertical-align:top;">Email</td>
            <td style="padding:6px 0;font-size:14px;color:#444;font-weight:600;">${userEmail}</td>
          </tr>
          <tr>
            <td style="padding:6px 12px 6px 0;font-size:13px;color:#888;vertical-align:top;">ACPGBI Number</td>
            <td style="padding:6px 0;font-size:14px;color:#0F1F3D;font-weight:700;">${acpgbiNumber}</td>
          </tr>
        </table>
      </div>

      ${button('Review in Admin Panel', `${siteUrl}/admin/members`)}

      <p style="margin:0;font-size:14px;color:#888;">
        To verify, check the number against the ACPGBI membership register, then update the member's role to "member" in the admin panel.
      </p>
    `),
  }
}

// 10. Certificate Ready
// ─────────────────────────────────────────
export function certificateReadyEmail(params: {
  name: string
  eventTitle: string
  eventId: string
  certificateId: string
  cpdPoints?: number | null
}): { subject: string; html: string } {
  const { name, eventTitle, eventId, certificateId, cpdPoints } = params
  const firstName = name.split(' ')[0] || name
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.dukesclub.org'

  return {
    subject: `Your Certificate — ${eventTitle}`,
    html: layout(`
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0F1F3D;">
        🏆 Your Certificate is Ready
      </h2>
      <p style="margin:0 0 16px;font-size:15px;color:#444;line-height:1.7;">
        Hi ${firstName},
      </p>
      <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.7;">
        Thank you for completing the feedback for <strong>${eventTitle}</strong>. Your certificate of attendance is now ready to download.
      </p>
      ${cpdPoints ? `
      <div style="background-color:#FFF8E7;border:1.5px solid #E5A718;padding:14px 20px;margin:0 0 24px;border-radius:10px;text-align:center;">
        <p style="margin:0;font-size:16px;font-weight:700;color:#92400E;">
          ✦ ${cpdPoints} CPD Points Awarded
        </p>
      </div>
      ` : ''}
      ${button('Download Certificate', `${siteUrl}/api/certificates/download?id=${certificateId}`)}
      <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
        You can also download your certificate at any time from your
        <a href="${siteUrl}/members" style="color:#E5A718;text-decoration:none;font-weight:600;">Members Dashboard</a>.
      </p>
    `),
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Use service role for reading certificates
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * GET /api/certificates/download?id=<certificate_id>
 * 
 * Generates a branded PDF certificate using SVG → PDF conversion.
 * No external dependencies needed — uses the built-in SVG approach
 * that works with Vercel serverless functions.
 * 
 * For production, consider switching to @react-pdf/renderer or 
 * puppeteer for richer PDF generation.
 */
export async function GET(request: NextRequest) {
  try {
    const certId = request.nextUrl.searchParams.get('id')
    if (!certId) {
      return NextResponse.json({ error: 'Certificate ID required' }, { status: 400 })
    }

    // Load certificate
    const { data: cert, error } = await supabase
      .from('event_certificates')
      .select('*')
      .eq('id', certId)
      .single()

    if (error || !cert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Mark as downloaded
    await supabase
      .from('event_certificates')
      .update({ downloaded_at: new Date().toISOString() })
      .eq('id', certId)

    // Generate certificate HTML
    const eventDate = new Date(cert.event_date).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const html = generateCertificateHTML({
      attendeeName: cert.attendee_name,
      eventTitle: cert.event_title,
      eventDate,
      certificateTitle: cert.certificate_title,
      cpdPoints: cert.cpd_points,
      verificationCode: cert.verification_code,
      issuedDate: new Date(cert.issued_at).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
    })

    // Return as an HTML page that the user can print to PDF
    // This approach works on Vercel without needing Puppeteer/Chromium
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    })
  } catch (err: any) {
    console.error('Certificate download error:', err)
    return NextResponse.json({ error: err.message || 'Failed to generate certificate' }, { status: 500 })
  }
}

// ── Certificate HTML Template ────────────────────────────────

function generateCertificateHTML(data: {
  attendeeName: string
  eventTitle: string
  eventDate: string
  certificateTitle: string
  cpdPoints: number | null
  verificationCode: string
  issuedDate: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${data.certificateTitle} — ${data.attendeeName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=Montserrat:wght@400;600;700&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    @page {
      size: A4 landscape;
      margin: 0;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }

    body {
      font-family: 'Montserrat', sans-serif;
      background: #f5f5f0;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }

    .print-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 12px 28px;
      background: #0F1F3D;
      color: #F5F8FC;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      font-family: 'Montserrat', sans-serif;
      cursor: pointer;
      margin-bottom: 20px;
      transition: opacity 0.15s;
    }
    .print-btn:hover { opacity: 0.85; }

    .certificate {
      width: 297mm;
      height: 210mm;
      background: #FFFFFF;
      position: relative;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.12);
    }

    /* Navy border frame */
    .border-frame {
      position: absolute;
      inset: 12mm;
      border: 3px solid #0F1F3D;
    }
    .border-frame::before {
      content: '';
      position: absolute;
      inset: 4px;
      border: 1px solid #0F1F3D;
    }

    /* Gold corner accents */
    .corner { position: absolute; width: 40px; height: 40px; }
    .corner-tl { top: 10mm; left: 10mm; border-top: 4px solid #E5A718; border-left: 4px solid #E5A718; }
    .corner-tr { top: 10mm; right: 10mm; border-top: 4px solid #E5A718; border-right: 4px solid #E5A718; }
    .corner-bl { bottom: 10mm; left: 10mm; border-bottom: 4px solid #E5A718; border-left: 4px solid #E5A718; }
    .corner-br { bottom: 10mm; right: 10mm; border-bottom: 4px solid #E5A718; border-right: 4px solid #E5A718; }

    .content {
      position: absolute;
      inset: 24mm 30mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .org-name {
      font-family: 'Montserrat', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: #0F1F3D;
      margin-bottom: 6px;
    }

    .org-sub {
      font-family: 'Montserrat', sans-serif;
      font-size: 9px;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: #888;
      margin-bottom: 28px;
    }

    .cert-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 36px;
      font-weight: 600;
      color: #0F1F3D;
      margin-bottom: 8px;
    }

    .gold-line {
      width: 80px;
      height: 3px;
      background: #E5A718;
      margin: 0 auto 24px;
    }

    .presented-to {
      font-size: 12px;
      color: #888;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .attendee-name {
      font-family: 'Cormorant Garamond', serif;
      font-size: 42px;
      font-weight: 700;
      color: #0F1F3D;
      margin-bottom: 20px;
    }

    .for-text {
      font-size: 12px;
      color: #666;
      margin-bottom: 6px;
    }

    .event-title {
      font-family: 'Montserrat', sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #0F1F3D;
      margin-bottom: 6px;
    }

    .event-date {
      font-size: 13px;
      color: #888;
      margin-bottom: 24px;
    }

    .cpd-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 18px;
      background: #FFF8E7;
      border: 1.5px solid #E5A718;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      color: #92400E;
      margin-bottom: 28px;
    }

    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      width: 100%;
      margin-top: auto;
    }

    .footer-item {
      text-align: center;
    }

    .footer-label {
      font-size: 9px;
      color: #999;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .footer-value {
      font-size: 11px;
      color: #333;
      font-weight: 600;
      margin-top: 4px;
    }

    .verification {
      font-family: 'IBM Plex Mono', monospace;
      font-size: 10px;
      color: #999;
      letter-spacing: 0.1em;
    }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">
    🖨️ Print / Save as PDF
  </button>
  <p class="no-print" style="font-size: 12px; color: #888; margin-bottom: 16px;">
    Use your browser's Print function and select "Save as PDF" for best results
  </p>

  <div class="certificate">
    <!-- Border frame -->
    <div class="border-frame"></div>

    <!-- Gold corners -->
    <div class="corner corner-tl"></div>
    <div class="corner corner-tr"></div>
    <div class="corner corner-bl"></div>
    <div class="corner corner-br"></div>

    <!-- Content -->
    <div class="content">
      <p class="org-name">The Dukes' Club</p>
      <p class="org-sub">Association of Coloproctology of Great Britain &amp; Ireland</p>

      <h1 class="cert-title">${data.certificateTitle}</h1>
      <div class="gold-line"></div>

      <p class="presented-to">This is to certify that</p>
      <p class="attendee-name">${data.attendeeName}</p>

      <p class="for-text">attended the following event:</p>
      <p class="event-title">${data.eventTitle}</p>
      <p class="event-date">${data.eventDate}</p>

      ${data.cpdPoints ? `<div class="cpd-badge">✦ ${data.cpdPoints} CPD Points Awarded</div>` : ''}

      <div class="footer-row">
        <div class="footer-item">
          <p class="footer-label">Date Issued</p>
          <p class="footer-value">${data.issuedDate}</p>
        </div>
        <div class="footer-item">
          <p class="footer-label">Verification Code</p>
          <p class="verification">${data.verificationCode}</p>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}
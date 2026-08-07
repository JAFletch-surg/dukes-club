import { NextRequest, NextResponse } from 'next/server'
import { resend, FROM_EMAIL } from '@/lib/resend'
import { weekendDepositRefundedEmail } from '@/lib/emails/templates'
import { getPaymentProvider, type PaymentRecord, type PaymentStatus } from '@/lib/payments'
import { authenticate, isAdmin, rpcErrorResponse, serviceClient, userClient, SITE_URL } from '../_shared'

const ALLOWED: PaymentStatus[] = ['pending', 'held', 'paid', 'refunded', 'failed']

/**
 * Admin deposit actions — mark paid, refund, individually or in bulk.
 *
 * Refunds are admin-triggered after the event, based on attendance, and a
 * deposit is never forfeited: cancelling at any point leaves it refundable.
 * (Open question 3, answered — revisit here if a forfeit policy is wanted.)
 *
 * The provider is asked to move the money first. Only if that succeeds does
 * the database transition, so a failed refund cannot leave a member marked
 * refunded when nothing was sent. With the manual provider both halves are
 * bookkeeping, but the ordering is what makes Stripe a config change later.
 */
export async function POST(request: NextRequest) {
  const result = await authenticate(request)
  if ('error' in result) return result.error
  const { auth } = result

  if (!(await isAdmin(auth.userId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { paymentIds?: string[]; status?: PaymentStatus; note?: string; notify?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const paymentIds = body.paymentIds || []
  if (paymentIds.length === 0) {
    return NextResponse.json({ error: 'No deposits selected' }, { status: 400 })
  }
  if (!body.status || !ALLOWED.includes(body.status)) {
    return NextResponse.json({ error: 'Invalid deposit status' }, { status: 400 })
  }

  const admin = serviceClient()

  const { data: payments } = await admin
    .from('event_payments')
    .select('*')
    .in('id', paymentIds)

  if (!payments || payments.length === 0) {
    return NextResponse.json({ error: 'No matching deposits' }, { status: 404 })
  }

  // Ask the provider to act before recording anything.
  const failures: { id: string; error: string }[] = []
  if (body.status === 'refunded') {
    const provider = getPaymentProvider()
    for (const payment of payments as PaymentRecord[]) {
      if (payment.status === 'refunded') continue
      try {
        const refund = await provider.refundDeposit(payment)
        if (refund.status !== 'refunded') {
          failures.push({ id: payment.id, error: refund.error || 'Refund was not completed' })
        }
      } catch (err) {
        failures.push({ id: payment.id, error: err instanceof Error ? err.message : 'Refund failed' })
      }
    }
  }

  const failedIds = new Set(failures.map(f => f.id))
  const toTransition = payments.filter(p => !failedIds.has(p.id)).map(p => p.id)

  let changed = 0
  if (toTransition.length > 0) {
    // Admin-only and audited inside the function, so the trail cannot be
    // skipped by writing to event_payments directly. Called with the admin's
    // own JWT so auth.uid() records who did it.
    const { data, error } = await userClient(auth.token).rpc('transition_event_payments', {
      p_payment_ids: toTransition,
      p_to_status: body.status,
      p_note: body.note ?? null,
    })
    if (error) return rpcErrorResponse(error.message)
    changed = data?.changed ?? 0
  }

  if (body.status === 'refunded' && body.notify !== false) {
    try {
      await notifyRefunds(admin, payments.filter(p => !failedIds.has(p.id) && p.status !== 'refunded'))
    } catch (err) {
      console.error('Deposit refund notifications failed:', err)
    }
  }

  return NextResponse.json({
    changed,
    failed: failures,
    // A partial success is still a success worth reporting honestly — the
    // admin needs to know which ones did not go through.
    ok: failures.length === 0,
  })
}

async function notifyRefunds(
  admin: ReturnType<typeof serviceClient>,
  payments: { id: string; user_id: string; event_id: string; amount_pence: number }[]
) {
  for (const payment of payments) {
    const { data: p } = await admin
      .from('profiles')
      .select('full_name, email')
      .eq('id', payment.user_id)
      .single()
    if (!p?.email) continue

    const { data: event } = await admin
      .from('events')
      .select('title')
      .eq('id', payment.event_id)
      .single()

    const mail = weekendDepositRefundedEmail({
      name: p.full_name || 'Member',
      eventTitle: event?.title || 'the Dukes Weekend',
      amountPence: payment.amount_pence,
      siteUrl: SITE_URL,
    })
    await resend.emails.send({ from: FROM_EMAIL, to: p.email, subject: mail.subject, html: mail.html })
  }
}

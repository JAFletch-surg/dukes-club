import type {
  PaymentProvider,
  PaymentRecord,
  PaymentResult,
  TakeDepositInput,
} from './types'

/**
 * Offline deposits — the provider the site actually runs on today.
 *
 * Nothing is charged. Taking a deposit records an obligation in `pending`,
 * which an admin then marks `paid` when the money arrives (bank transfer, on
 * the day, however Dukes collects it) and `refunded` after the weekend. Those
 * transitions happen in Admin → Event → Attendees and are written through
 * transition_event_payments(), which keeps the audit trail.
 *
 * Every method is a no-op that reports what the database should record, so
 * the booking flow is identical whether or not a real provider is switched on.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly name = 'manual' as const
  readonly isLive = true

  async takeDeposit(input: TakeDepositInput): Promise<PaymentResult> {
    // An admin confirms receipt; there is nothing to call out to.
    void input
    return { status: 'pending', providerIntentId: null, providerChargeId: null }
  }

  async refundDeposit(payment: PaymentRecord): Promise<PaymentResult> {
    // Refunding offline is an admin action plus a bank transfer; recording it
    // is the whole job here.
    void payment
    return { status: 'refunded' }
  }

  async getStatus(payment: PaymentRecord): Promise<PaymentResult> {
    // The database is the only source of truth for offline deposits.
    return { status: payment.status }
  }
}

// Payment provider abstraction.
//
// Stripe is the intended provider but is not set up yet, so the site ships
// with the manual implementation: deposits are recorded against a booking and
// an admin marks them paid or refunded. Bookings work end to end with no live
// processing.
//
// Everything the abstraction needs to become real later is already here — the
// interface, the record shape, and the columns on event_payments that carry a
// provider intent/charge reference. Switching to Stripe is a config change
// plus credentials, not a refactor.

export type PaymentStatus = 'pending' | 'held' | 'paid' | 'refunded' | 'failed'

export type PaymentProviderName = 'manual' | 'stripe'

/** A deposit as stored in the event_payments table. */
export interface PaymentRecord {
  id: string
  event_id: string
  user_id: string
  booking_id: string
  amount_pence: number
  currency: string
  status: PaymentStatus
  provider: PaymentProviderName
  provider_intent_id: string | null
  provider_charge_id: string | null
  paid_at: string | null
  refunded_at: string | null
}

export interface TakeDepositInput {
  bookingId: string
  eventId: string
  userId: string
  amountPence: number
  currency?: string
  /** Shown to the member by providers that render their own checkout. */
  description?: string
}

/**
 * What a provider hands back after touching the outside world. The caller is
 * responsible for writing the resulting status to event_payments and adding
 * the matching event_payment_events audit row — providers never write to the
 * database themselves, so there is exactly one place where a deposit's state
 * changes regardless of which provider is active.
 */
export interface PaymentResult {
  status: PaymentStatus
  providerIntentId?: string | null
  providerChargeId?: string | null
  /** Present when the provider needs the member to complete a checkout step. */
  checkoutUrl?: string | null
  /** Populated on a failed result; safe to show to an admin, not a member. */
  error?: string
}

export interface PaymentProvider {
  readonly name: PaymentProviderName

  /**
   * Whether this provider can actually process money right now. The manual
   * provider is always live; Stripe reports false until it is configured.
   */
  readonly isLive: boolean

  /** Start collecting a refundable deposit for a weekend booking. */
  takeDeposit(input: TakeDepositInput): Promise<PaymentResult>

  /** Return a deposit in full. Deposits are never partially refunded. */
  refundDeposit(payment: PaymentRecord): Promise<PaymentResult>

  /** Ask the provider what it thinks the current status is. */
  getStatus(payment: PaymentRecord): Promise<PaymentResult>
}

/** Thrown when a provider is selected but not usable. */
export class PaymentProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(`Payment provider "${provider}" is not configured`)
    this.name = 'PaymentProviderNotConfiguredError'
  }
}

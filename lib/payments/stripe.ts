import {
  PaymentProviderNotConfiguredError,
  type PaymentProvider,
  type PaymentRecord,
  type PaymentResult,
  type TakeDepositInput,
} from './types'

/**
 * Stripe — stub.
 *
 * Not live. Selecting it with PAYMENT_PROVIDER=stripe is enough to route
 * every deposit through this class, and every method then fails loudly rather
 * than silently pretending to have charged someone.
 *
 * TO SWITCH THIS ON
 *   1. Add the `stripe` package and set STRIPE_SECRET_KEY (plus
 *      STRIPE_WEBHOOK_SECRET for asynchronous confirmations).
 *   2. Fill in the three methods below. The shapes they must return are
 *      already fixed by the PaymentProvider interface, and the columns they
 *      need to populate — provider_intent_id, provider_charge_id, status —
 *      already exist on event_payments.
 *   3. Set PAYMENT_PROVIDER=stripe.
 *
 * A deposit is authorised and later returned in full, so the natural mapping
 * is a PaymentIntent with manual capture: `held` while authorised, `paid` on
 * capture, `refunded` on release. Nothing outside this file needs to change.
 */
export class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe' as const

  get isLive(): boolean {
    return Boolean(process.env.STRIPE_SECRET_KEY)
  }

  private assertConfigured(): never {
    throw new PaymentProviderNotConfiguredError('stripe')
  }

  async takeDeposit(input: TakeDepositInput): Promise<PaymentResult> {
    void input
    // TODO: stripe.paymentIntents.create({ amount, currency, capture_method:
    // 'manual', metadata: { booking_id, event_id, user_id } }) and return the
    // intent id plus its checkout URL.
    this.assertConfigured()
  }

  async refundDeposit(payment: PaymentRecord): Promise<PaymentResult> {
    void payment
    // TODO: stripe.refunds.create({ charge: payment.provider_charge_id }), or
    // cancel the intent if it was authorised but never captured.
    this.assertConfigured()
  }

  async getStatus(payment: PaymentRecord): Promise<PaymentResult> {
    void payment
    // TODO: stripe.paymentIntents.retrieve(payment.provider_intent_id) and map
    // its status onto PaymentStatus.
    this.assertConfigured()
  }
}

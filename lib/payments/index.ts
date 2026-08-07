import { ManualPaymentProvider } from './manual'
import { StripePaymentProvider } from './stripe'
import type { PaymentProvider, PaymentProviderName } from './types'

export * from './types'
export { ManualPaymentProvider } from './manual'
export { StripePaymentProvider } from './stripe'

/**
 * Which provider handles deposits, from the PAYMENT_PROVIDER environment
 * variable. Defaults to 'manual' — the only one live today — so an unset or
 * misspelled value can never quietly route real money somewhere unexpected.
 */
export function getPaymentProviderName(): PaymentProviderName {
  return process.env.PAYMENT_PROVIDER === 'stripe' ? 'stripe' : 'manual'
}

let cached: PaymentProvider | null = null

export function getPaymentProvider(): PaymentProvider {
  if (cached && cached.name === getPaymentProviderName()) return cached
  cached = getPaymentProviderName() === 'stripe'
    ? new StripePaymentProvider()
    : new ManualPaymentProvider()
  return cached
}

/** Format pence as a sterling string, matching the event pages. */
export function formatDeposit(pence: number | null | undefined): string {
  if (!pence) return 'No deposit'
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`
}

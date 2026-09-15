export const PAYSTACK_FEE_RATE = 0.0195

export function getPaystackCustomerTotal(amountGhs: number) {
  return Math.round(amountGhs * (1 + PAYSTACK_FEE_RATE) * 100) / 100
}

export function getPaystackFee(amountGhs: number) {
  return Math.round((getPaystackCustomerTotal(amountGhs) - amountGhs) * 100) / 100
}
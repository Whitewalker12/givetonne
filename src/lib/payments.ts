/**
 * Payment adapter boundary. The demo accepts any card number that passes a
 * Luhn check and declines the classic Stripe test decline card. Replacing
 * this with Stripe means creating a PaymentIntent here and confirming it
 * from a webhook instead of inline.
 */

export type CardInput = { number: string; exp: string; cvc: string; name: string };

export type ChargeResult =
  | { ok: true; paymentId: string; last4: string }
  | { ok: false; error: string };

function luhn(num: string) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl && (d *= 2) > 9) d -= 9;
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export async function charge(amountCents: number, card: CardInput): Promise<ChargeResult> {
  const number = card.number.replace(/\s+/g, "");
  if (!/^\d{13,19}$/.test(number) || !luhn(number)) {
    return { ok: false, error: "That card number doesn't look right." };
  }
  if (number === "4000000000000002") {
    return { ok: false, error: "Your card was declined." };
  }
  if (!/^\d{2}\s*\/\s*\d{2}$/.test(card.exp)) {
    return { ok: false, error: "Expiry must be MM/YY." };
  }
  if (!/^\d{3,4}$/.test(card.cvc)) {
    return { ok: false, error: "CVC must be 3 or 4 digits." };
  }
  await new Promise((r) => setTimeout(r, 500));
  return {
    ok: true,
    paymentId: `pay_mock_${Date.now().toString(36)}_${amountCents}`,
    last4: number.slice(-4),
  };
}

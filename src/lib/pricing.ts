// Client-safe: no DB or chain imports here.
export const PLATFORM_FEE_BPS = 1000; // 10% on top of the credit price

export function formatMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function quote(pricePerTonne: number, tonnes: number) {
  const credits = Math.round(pricePerTonne * tonnes);
  const fee = Math.round((credits * PLATFORM_FEE_BPS) / 10_000);
  return { credits, fee, total: credits + fee };
}

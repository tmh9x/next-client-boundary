"use client";
export async function pay() {
  const { default: Stripe } = await import("stripe");
  return new Stripe("key");
}

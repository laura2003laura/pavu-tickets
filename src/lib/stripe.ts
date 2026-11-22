import Stripe from "stripe";

// If STRIPE_SECRET_KEY is empty the site uses simulated payment (handy for demos).
export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
export const appUrl = process.env.APP_URL ?? "http://localhost:3000";

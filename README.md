# PAVU tickets

PAVU is an event ticketing platform built with Next.js 14, TypeScript, PostgreSQL, Prisma and Three.js.

## Features

- Event discovery with editorial-style image cards and responsive layouts.
- Event-specific volunteer applications (first name, last name, phone, birth date and Telegram handle).
- Assigned seating with interactive 2D maps and a generated 3D hall / view-from-seat scene for every event assigned to a hall.
- 3D sports-field preview for outdoor/general-admission sports events.
- Checkout with online or courier delivery selection and map-based delivery location.
- QR tickets are issued only after successful payment confirmation. In Stripe mode, the signed Stripe webhook is the authority; in demo mode, the test card form is validated and then the ticket is issued.
- Admin, staff scanner, event, hall and volunteer data models.

## Run locally

1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and fill in `DATABASE_URL`, `AUTH_SECRET` and `TICKET_SECRET`.
3. Run `npm install`.
4. Run `npx prisma generate`.
5. For a new database, run `npx prisma db push` and `npm run seed`. For an existing database, back it up first and use `npx prisma db push` to apply compatible schema changes. Do not run `prisma migrate reset` on a database with data you need to keep.
6. Run `npm run dev` and open http://localhost:3000.

## Payments

When `STRIPE_SECRET_KEY` is configured, checkout redirects to Stripe-hosted Checkout and QR tickets are created only after the signed webhook confirms payment. Configure `STRIPE_WEBHOOK_SECRET` and forward local webhooks to `/api/stripe/webhook`.

When Stripe is not configured, the project uses a clearly labelled demo flow. The card fields are validated but no money is charged. Use Stripe test mode for end-to-end payment testing. Never collect or store raw card details in production.

## Delivery

The customer selects a delivery point on the map and supplies an address and phone number. The delivery details are stored on the pending order. The QR ticket is created only after the payment is confirmed; it is not created merely by selecting a delivery point.

## 3D venues

Any hall created in `/admin/halls` receives a seat layout, and any event assigned to that hall gets the interactive 3D hall and seat-view scene. Sport events without a hall get a 3D field preview.

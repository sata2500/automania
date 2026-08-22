This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Etsy Live Publish Safety

Etsy live publishing is an opt-in capability and is disabled by default. To expose the live-publish button after a deliberate deployment decision, configure both `ETSY_LIVE_PUBLISH_ENABLED=true` (server-side) and `NEXT_PUBLIC_ETSY_LIVE_PUBLISH_ENABLED=true` (client-side). Restart/redeploy after changing these variables; never place Etsy access or refresh tokens in a `NEXT_PUBLIC_` variable.

The application always creates the Etsy listing as a draft first. Live publication can continue only after the authenticated user explicitly types `YAYINLA`, the required preflight checks pass, at least one image is uploaded successfully, and the inventory/media steps do not report blocking errors. Only then does the server issue Etsy’s `PATCH .../listings/{listing_id}` request with `state=active`. The draft button remains available and is the safe default.

Do not enable this flag in development or CI test environments. The repository tests use mocks and pure safety helpers only; they do not publish a real Etsy listing.

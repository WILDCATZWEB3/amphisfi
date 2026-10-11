# Amphis: Trader Reputation

Build Amphis, a premium Solana-native trader reputation platform.

This is PHASE 1 ONLY. Do not build the entire product yet.

Core idea

Amphis will eventually let a user:

Connect a Solana wallet → analyze real trading activity → calculate verified performance → create a public trader profile → compete on leaderboards → build trading reputation.

The most important product rule is:

REAL DATA ONLY.

Never generate fake PnL, fake trading volume, fake wallet balances, fake trades, fake rankings, fake charts, or fake trader statistics.

If real data is not available yet, show an honest empty state.

⸻

TECH STACK

Use:

* React
* TypeScript
* Vite
* Tailwind CSS
* Supabase
* Solana wallet integration

Keep the architecture clean and modular so we can later connect real Solana transaction indexing and market-data providers.

Do not introduce unnecessary dependencies.

⸻

BRAND

Product name:

Amphis

X:

@amphisfi

Tagline:

Your trading reputation.

The design should feel like a serious financial/crypto product.

Visual style

* Black / near-black background
* White typography
* Silver/gray secondary elements
* Very subtle lavender accent
* Clean borders
* Premium spacing
* Minimal animations
* Minimal gradients
* No stock images
* No generic AI illustrations
* No excessive glow
* No emojis

Use the Amphis logo if I upload it.

⸻

ROUTES

Create these routes:

/

/explore

/leaderboard

/trader/:walletAddress

/me

Each route must actually work.

⸻

LANDING PAGE

Create a clean premium landing page.

Navbar:

Amphis logo

Explore

Leaderboard

Connect Wallet

Hero:

Your trading reputation.

Supporting text:

Turn your real Solana trading activity into a reputation you can prove.

Primary button:

Connect Wallet

Secondary button:

Explore Traders

Below the hero, show three simple product concepts:

Track

Your verified trading performance.

Compete

Compare your performance with other traders.

Build

Create a public trader reputation.

Do not display fake numbers anywhere.

⸻

SOLANA WALLET

Implement real Solana wallet connection.

The user should be able to:

* Connect a wallet
* Disconnect
* See the connected wallet address
* Copy the full address
* Handle connection errors
* Handle wallet-not-installed states

Use the current appropriate Solana wallet integration approach.

This is READ-ONLY.

Do not:

* Send transactions
* Request token approvals
* Request swaps
* Request signatures unnecessarily
* Handle private keys

For now, simply establish a reliable wallet connection.

⸻

SUPABASE

Connect the project to Supabase.

Create the initial database structure.

profiles

Fields:

* id
* wallet_address
* username
* avatar_url
* bio
* created_at
* updated_at

wallets

Fields:

* id
* profile_id
* address
* first_seen_at
* last_synced_at
* sync_status
* created_at
* updated_at

Wallet address must be unique.

Add appropriate indexes.

Enable Row Level Security.

Never expose Supabase service-role credentials in frontend code.

Use environment variables.

⸻

IMPORTANT

Do NOT build:

PnL calculations

Trade detection

Transaction indexing

Leaderboards with real rankings

Portfolio analytics

AI analysis

Predictions

Trading

Token launch

Subscriptions

Payments

Those belong to later phases.

⸻

EXPLORE

Build the Explore page structure.

For now display an honest empty state:

Trader discovery is coming soon.

No fake trader profiles.

⸻

LEADERBOARD

Build the leaderboard page structure.

Include:

7D

30D

All Time

But do not populate fake rankings.

Display:

Verified rankings will appear once Amphis has indexed real trading data.

⸻

TRADER PROFILE

Create:

/trader/:walletAddress

Build the profile structure for:

Wallet

Trader identity

Performance

Trading activity

Risk

Reputation

Leaderboard position

For now, display:

No verified trading data yet.

Never invent values.

⸻

MY PROFILE

Create:

/me

If no wallet is connected:

Connect your wallet to create your Amphis profile.

If connected:

Show:

Connected wallet

Profile section

Username field

Bio field

But do not claim the wallet has traded.

⸻

COMPONENTS

Create reusable components for:

Navbar

WalletButton

WalletAddress

Button

Card

PageHeader

EmptyState

LoadingState

ErrorState

Do not duplicate UI code unnecessarily.

⸻

RESPONSIVE DESIGN

Mobile-first.

The application must work properly on:

iPhone

Android

Tablet

Desktop

Pay particular attention to:

Navbar

Wallet button

Cards

Tables

Leaderboard layout

Trader profile layout

⸻

QUALITY CONTROL

Before finishing:

1. Run the application.
2. Fix TypeScript errors.
3. Fix build errors.
4. Test navigation.
5. Test wallet connection.
6. Test wallet disconnect.
7. Test Supabase connection.
8. Check mobile layout.
9. Confirm there are NO fake statistics.
10. Confirm there are NO broken routes.

Do not move into Phase 2 automatically.

⸻

FINAL RESPONSE

When finished, tell me only:

1. What you built
2. What works
3. What does not work
4. What environment variables I need to add
5. Any errors remaining

Do not claim something works unless you actually tested it.

This is the foundation of a real product, not a visual prototype.

Do not fabricate data.
Do not add features outside Phase 1.
Do not waste tokens explaining things instead of building them.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://amphisfi.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6932c93c-bb56-4119-9dd3-bd222fc6d416).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

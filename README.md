# Quickupp AI Studio — AI Video Production & Lead Generation Platform

[![Live Website](https://img.shields.io/badge/Website-quickuppaistudio.com-blue?style=for-the-badge&logo=google-chrome)](https://quickuppaistudio.com)
[![GitHub Repository](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/QSPL8080/AI-STUDIO.git)
[![React 19](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TanStack Start](https://img.shields.io/badge/TanStack-Start-FF4154?style=for-the-badge&logo=tanstack)](https://tanstack.com/start)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind-CSS%20v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com)
[![Supabase](https://img.shields.io/badge/Database-Supabase%20%2F%20Postgres-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Hostinger](https://img.shields.io/badge/Host-Hostinger%20Cloud-673DE6?style=for-the-badge&logo=hostinger)](https://hostinger.com)

A premier, high-conversion marketing platform and built-in CRM Admin Lead Management Portal for **Quickupp AI Studio** — an agency producing AI UGC videos, AI avatars, cartoon animations, hyper-realistic cinematic reels, and digital twin clones for high-growth businesses, brands, and creators.

---

## 📑 Table of Contents

1. [Architecture & Tech Stack](#-architecture--tech-stack)
2. [Advanced Hero Cinema Scroll Engine](#-advanced-hero-cinema-scroll-engine)
3. [Key Website Features & Conversion Funnel](#-key-website-features--conversion-funnel)
4. [Lead Capture & Dual Database Engine](#-lead-capture--dual-database-engine)
5. [Admin CRM Portal (`/admin`)](#-admin-crm-portal-admin)
6. [Project Directory Tree](#-project-directory-tree)
7. [Environment Variables Setup](#-environment-variables-setup)
8. [Database Schema (PostgreSQL / Supabase)](#-database-schema-postgresql--supabase)
9. [Local Development Guide](#-local-development-guide)
10. [Deployment on Hostinger & Auto-Deploy CI/CD](#-deployment-on-hostinger--auto-deploy-cicd)
11. [Security, Performance & SEO Optimizations](#-security-performance--seo-optimizations)
12. [Authors & Credits](#-authors--credits)

---

## 🛠 Architecture & Tech Stack

| Layer                    | Technology                                              | Description                                                                                        |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Frontend Framework**   | [TanStack Start](https://tanstack.com/start) + React 19 | Fullstack Server-Side Rendering (SSR), instant hydration, and complete SEO metadata control.       |
| **Routing**              | TanStack Router                                         | File-based, 100% type-safe routing with automatic route tree generation and caching.               |
| **Styling & CSS Engine** | Tailwind CSS v4                                         | OKLCH modern color tokens, neon glow drops, backdrop blurs, and mobile-first responsive utilities. |
| **Production Database**  | [Supabase](https://supabase.com) (PostgreSQL)           | Managed cloud PostgreSQL accessed via reliable HTTPS REST API to bypass cloud firewall/TCP blocks. |
| **Local Database**       | PostgreSQL (`pg` pool)                                  | Direct connection pool for offline local development and quick testing.                            |
| **Hosting & Web Server** | Hostinger Cloud Hosting + Nitro                         | High-performance `node-server` engine managed automatically.                                       |
| **Icons & Media**        | Lucide React                                            | Clean, scalable feather-style icons with animated states.                                          |
| **Language & Tooling**   | TypeScript + Vite 8                                     | End-to-end type safety, modern asset bundling, and ultra-fast build times.                         |

---

## 🎬 Advanced Hero Cinema Scroll Engine

The landing page features a custom-engineered, GPU-accelerated **Cinema Scroll Showcase** inspired by world-class creative agencies:

### 1. Dynamic Navigation Height Tracking

- Integrated a `ResizeObserver` listener on the top navigation container (`#site-nav-container`).
- Dynamically measures navbar pixel height whether the announcement promo banner is open (~116px) or dismissed (~72px).
- Anchors the video showcase container precisely below the header (`style={{ top: `${headerHeight}px` }}`), preventing top clipping on any screen resolution.

### 2. High-Impact Layered Composition

- **Screen-Spanning Brand Header:** Giant "AI Studio" banner image spanning `98vw` with neon violet drop-shadows.
- **Natural Cutting Overlap:** The compact video showcase card sits at `z-20` in front of the logo (`z-10`). Its top edge overlaps and cuts cleanly across the bottom ~70px–80px of the letters "S t u d i o", creating depth and a modern editorial aesthetic.
- **Pixel-Perfect Left Alignment:** The primary headline is indented (`pl-2 sm:pl-[4vw] md:pl-[4.8vw] lg:pl-[5vw]`) so its left edge aligns with the letter "A" in the "AI Studio" logo.

### 3. Smooth Full-Screen Expansion & Cinema Hold

- **Extended Track:** Operates within a `280vh` track using a 3-phase absolute/fixed pinning engine immune to scroll-chain glitches.
- **Expansion Phase (`0% -> 65% scroll`):** The video card expands from compact resting dimensions (`width: 36%, height: 42%, borderRadius: 20px`) into **100% edge-to-edge full screen** with zero gaps and `borderRadius: 0px`.
- **Locked Cinema Hold (`65% -> 100% scroll`):** The video remains **100% locked at full screen** while the user continues scrolling, preventing the next section from cutting the viewing experience short prematurely.

### 4. Interactive Audio & Voice Controls

- Features `/images/Hero Video.mp4` with a full-fidelity AAC voice track.
- **Audio Enabled by Default:** Configured with audio enabled (`muted={false}`) by default.
- **Intelligent Autoplay Fallback:** If browser security blocks unmuted autoplay before user engagement, it seamlessly un-mutes the audio upon the first user interaction (touch, click, or scroll).
- **Interactive Audio Controls:** Includes a floating glassmorphic **"Voice Active" / "Unmute Voice"** button (`Volume2` / `VolumeX`) and click-to-toggle interaction directly on the video card.

### 5. SEO-Optimized Semantic Headline

- Wrapped in a semantic `<h1>` tag:
  ```html
  <h1>
    <span class="sr-only">Quickupp AI Studio - </span>
    a world-class, tech-enabled AI video production studio.
  </h1>
  ```
- Screen-reader accessible branding with Core Web Vitals optimizations (`fetchPriority="high"`, `loading="eager"`).

---

## 🎯 Key Website Features & Conversion Funnel

- **Hero & Value Proposition:** High-impact dark mode aesthetics with animated neon borders, sample badges, and clear call-to-actions.
- **Service Showcase:** Detailed cards for AI UGC Reels, Avatar Videos, Cartoon Animations, Hyper-Realistic Videos, and Digital Twin Clones.
- **Video Demos & Samples:** Filterable video category reels with vertical preview player.
- **Workflow & Process:** 4-step client delivery pipeline (Scripting → AI Generation → Voice & Audio → 48-Hour Delivery).
- **Transparent Pricing Tiers:** Flexible starter, growth, and agency bulk packages with feature comparisons.
- **FAQ Accordion:** Interactive, searchable questions answering delivery times, revisions, commercial licensing, and script ownership.
- **Floating WhatsApp Action:** Direct instant WhatsApp contact button present on all mobile and desktop screens.

---

## 🗄 Lead Capture & Dual Database Engine

The application captures inquiries from two primary sources and syncs them automatically:

1. **Main Contact Section Form (`#contact`):** Full inquiry form capturing Name, Phone, Email, Business, Video Type, Quantity, Budget, and Requirements.
2. **Interactive Timed Quote Modal:**
   - Automatically opens after **1.2 seconds** on every visit or page refresh.
   - Recurs automatically every **5 minutes (300,000 ms)** for ongoing sessions.
   - Form validation with instant WhatsApp redirect.

### Dual Database Synchronization

- **In Production (Hostinger):** Sends leads over Supabase HTTPS REST API (`SUPABASE_URL` + `SUPABASE_API_KEY`). This avoids PostgreSQL TCP port 5432/6543 blocks by cloud firewalls.
- **In Local Development:** Direct connection to local PostgreSQL (`postgres://postgres:8080@localhost:5432/ai_studio`).

---

## 📊 Admin CRM Portal (`/admin`)

An authenticated, mobile-responsive dashboard designed for real-time lead tracking and client management:

- **Portal URL:** `https://quickuppaistudio.com/admin` (or `http://localhost:3000/admin`)
- **Default Admin Email:** `admin@aistudio.com`
- **Default Password:** `Admin@123`

### Features:

- 📈 **Real-Time KPI Counters:** Total Leads, Contact Form count, Popup Modal count, and New Leads Today.
- 🔍 **Instant Search & Multi-Filters:** Search by client name, business, phone, or email; filter by source category or lead status.
- 🔄 **Lead Status Toggling:** Update leads to `New`, `Contacted`, `In Progress`, or `Closed` with real-time database sync.
- 💬 **1-Click WhatsApp Client Reply:** Pre-fills client name and opens WhatsApp Web/App ready to send.
- 📥 **CSV Export:** Download all leads filtered in CSV format for Excel, Google Sheets, or CRM imports.
- 🔒 **Security Auto-Logout:** Continuously listens for user activity (`mouse`, `clicks`, `scroll`, `keys`). If the admin is inactive for **5 minutes**, the session terminates automatically.

---

## 📂 Project Directory Tree

```
AI STUDIO/
├── .github/
│   └── workflows/
│       └── deploy.yml              # CI/CD deployment workflow
├── public/
│   ├── images/                     # Hero video, logos, and branding assets
│   │   ├── Hero Video.mp4          # High-definition showcase hero video with AAC audio
│   │   └── ai studio logo hero.png # High-resolution hero title logo
│   ├── favicon.png                 # Browser favicon
│   └── robots.txt                  # Search engine crawl rules
├── src/
│   ├── routes/
│   │   ├── __root.tsx              # Root HTML shell, fonts, meta tags & providers
│   │   ├── index.tsx               # Main landing page assembling all sections
│   │   ├── admin.tsx               # CRM Admin Portal with auth & auto-logout
│   │   ├── privacy-policy.tsx      # Privacy Policy page
│   │   └── terms.tsx               # Terms and conditions
│   ├── components/
│   │   └── site/
│   │       ├── data.ts             # Static content (pricing, services, FAQs, reviews)
│   │       ├── sections.tsx        # UI components (Hero, Pricing, Form, Modal, FAQ)
│   │       ├── custom-cursor.tsx   # Atmospheric glow cursor follower
│   │       └── ui.tsx              # Base design components (NeonButton, Section, Cards)
│   ├── lib/
│   │   ├── db.ts                   # Supabase REST + PostgreSQL dual database engine
│   │   ├── lead-actions.ts         # TanStack Start server functions (create, fetch, update, delete)
│   │   ├── error-capture.ts        # SSR error capture utility
│   │   ├── error-page.ts           # Fallback error diagnostics page
│   │   └── utils.ts                # Tailwind class utility (clsx + twMerge)
│   ├── styles.css                  # Global Tailwind CSS tokens, glows, and animations
│   ├── routeTree.gen.ts            # Auto-generated TanStack route tree
│   ├── router.tsx                  # QueryClient and TanStack router configuration
│   ├── server.ts                   # Nitro / Node SSR server entry wrapper
│   └── start.ts                    # Client hydration entrypoint
├── .env.example                    # Environment variable template
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
└── vite.config.ts                  # Vite + Nitro node-server configuration
```

---

## 🔑 Environment Variables Setup

Create a `.env` file in the project root:

```env
# Local PostgreSQL Connection
DATABASE_URL=postgres://postgres:8080@localhost:5432/ai_studio

# Production Supabase Credentials (Configured in Hostinger)
SUPABASE_URL=https://oxydwcusxvlsvjkwexsz.supabase.co
SUPABASE_API_KEY=sb_secret_YourSecretApiKeyHere

# Application Server Port
PORT=3000
```

> [!NOTE]
> `.env` is listed in `.gitignore` and is never committed to GitHub.

---

## 🗃 Database Schema (PostgreSQL / Supabase)

Table name: `public.leads`

```sql
CREATE TABLE IF NOT EXISTS public.leads (
    id VARCHAR(64) PRIMARY KEY,
    source VARCHAR(32) NOT NULL,        -- 'Contact Form' | 'Popup Modal'
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(64) NOT NULL,
    email VARCHAR(255),
    video_type VARCHAR(128) NOT NULL,
    business VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    industry VARCHAR(128),
    requirement TEXT,
    additional TEXT,
    status VARCHAR(32) DEFAULT 'New',   -- 'New' | 'Contacted' | 'In Progress' | 'Closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 💻 Local Development Guide

### Prerequisites

- Node.js 20+ installed
- PostgreSQL installed and running on port `5432`

### Commands

```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Build for production (Node-server preset)
npm run build

# 4. Run production build locally
npm start
```

---

## 🚀 Deployment on Hostinger & Auto-Deploy CI/CD

1. **Connect GitHub Repository:**
   - Link `https://github.com/QSPL8080/AI-STUDIO.git` to your Hostinger Cloud/Web Hosting project.
   - Branch: `main`
2. **Configure Environment Variables in Hostinger Dashboard:**
   - `SUPABASE_URL`: `https://oxydwcusxvlsvjkwexsz.supabase.co`
   - `SUPABASE_API_KEY`: Your Supabase service role / API key
   - `PORT`: `3000`
3. **Build & Start Settings:**
   - Build Command: `npm run build`
   - Start Command: `npm start`
4. **Auto-Deployment:**
   Every time you push code to GitHub (`git push origin main`), Hostinger automatically rebuilds and deploys the latest version to **`https://quickuppaistudio.com`**.

---

## 🛡 Security, Performance & SEO Optimizations

- **Zero Hardcoded Secrets:** All database credentials, tokens, and keys are isolated in environment variables.
- **Session Auto-Timeout:** Inactivity listener logs out admin sessions automatically after 5 minutes.
- **Semantic SEO Structure:** Complete semantic `<h1>`, descriptive `alt` tags, and OpenGraph/Twitter card metadata.
- **Core Web Vitals Optimized:** Hero brand assets use `fetchPriority="high"` and `loading="eager"` for sub-second Largest Contentful Paint (LCP).
- **Firewall Bypass:** Supabase HTTPS REST interface guarantees zero connection drops from cloud TCP port blocks.

---

## 👥 Authors & Credits

Developed for **Quickupp AI Studio**  
Website: [quickuppaistudio.com](https://quickuppaistudio.com)  
Support / Inquiries: [quickuppsoftech1@gmail.com](mailto:quickuppsoftech1@gmail.com)

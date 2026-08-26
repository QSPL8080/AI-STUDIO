# Quickupp AI Studio

Marketing & Lead Generation platform + CRM Admin Portal for **Quickupp AI Studio** — an AI video production agency offering AI UGC, AI Avatar, AI Cartoon Animation, Hyper-Realistic and AI Digital Twin video production for modern businesses, brands, and creators.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [TanStack Start](https://tanstack.com/start) (Fullstack SSR + React 19) |
| **Routing** | TanStack Router (file-based type-safe routing) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) (Connection Pool via `pg`) |
| **Styling & Design System** | Tailwind CSS v4 + OKLCH tokens + Custom Keyframe Animations |
| **Typography** | Space Grotesk (Sans) + Aurora (Luxury Display Serif for Highlights) |
| **Build Tool** | Vite 8 + `@lovable.dev/vite-tanstack-config` |
| **Icons** | Lucide React |
| **Package Manager** | Bun |
| **Language** | TypeScript |
| **Platform** | [Lovable](https://lovable.dev) |

---

## Project Structure

```
AI STUDIO/
├── public/
│   ├── images/
│   │   ├── Hero Image .png              # High-resolution Hero visual
│   │   ├── hero-ai-video.jpg            # Secondary format asset
│   │   └── quickupp-mark.png            # Logo mark
│   ├── favicon.png                      # App favicon
│   └── robots.txt                       # Search engine crawler rules
├── src/
│   ├── routes/
│   │   ├── __root.tsx                   # Root layout shell, SEO metadata, fonts & script injection
│   │   ├── index.tsx                    # Landing page assembling all sections in conversion flow
│   │   └── admin.tsx                    # Authenticated Admin CRM Portal for managing leads
│   ├── components/
│   │   └── site/
│   │       ├── data.ts                  # Central content repository (services, pricing, FAQs, etc.)
│   │       ├── sections.tsx             # Interactive UI sections (Hero, Samples, Services, etc.)
│   │       └── ui.tsx                   # Base UI primitives (Section, SectionHeading, NeonButton)
│   ├── assets/                          # Static assets and proxy metadata
│   ├── lib/
│   │   ├── db.ts                        # PostgreSQL connection pool, schema init & queries
│   │   ├── lead-actions.ts              # Server functions for lead submissions & CRM operations
│   │   ├── error-capture.ts             # SSR error capture utility
│   │   ├── error-page.ts                # Fallback HTML error page renderer
│   │   ├── lovable-error-reporting.ts   # Lovable platform error reporting
│   │   └── utils.ts                     # Class merging utility (clsx + twMerge)
│   ├── styles.css                       # Global styles, scrollbar removal, animations & tokens
│   ├── routeTree.gen.ts                 # Auto-generated TanStack route tree
│   ├── router.tsx                       # Router instance & QueryClient configuration
│   ├── server.ts                        # SSR server handler
│   └── start.ts                         # Client entry point
├── package.json
├── bun.lock
├── vite.config.ts
└── README.md
```

---

## Admin CRM Portal

The platform includes a dedicated CRM dashboard for reviewing and managing leads collected from both the **Contact Form** and the **Timed Pop-up Modal**.

- **URL Route:** `/admin` (`http://localhost:8080/admin`)
- **Admin Email:** `admin@aistudio.com`
- **Password:** `Admin@123`

### Key Admin Features:
- **Source Categorization:** Clear tags distinguishing whether a lead originated from the `#contact` **Contact Form** or the **Popup Modal**.
- **Real-Time KPI Summary:** Compact counts for Total Leads, Contact Form Leads, Popup Modal Leads, and New Uncontacted Leads.
- **Search & Filter:** Instant search by name, phone, business, or email, plus filter dropdowns for Source and Status.
- **Lead Status Management:** Easily toggle statuses (`New`, `Contacted`, `In Progress`, `Closed`).
- **1-Click WhatsApp Direct Chat:** Instant WhatsApp conversation trigger with pre-filled greeting.
- **CSV Data Export:** Export all filtered leads to `.csv` for Excel/Google Sheets.

---

## Database Architecture (PostgreSQL)

Configured for **PostgreSQL** in `src/lib/db.ts` with connection pooling and automated table initialization.

### Database Credentials:
- **Host:** `localhost:5432`
- **User:** `postgres`
- **Password:** `8080`
- **Database:** `ai_studio`
- **Table:** `public.leads`

### Table Schema:
```sql
CREATE TABLE public.leads (
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
    status VARCHAR(32) DEFAULT 'New',  -- 'New', 'Contacted', 'In Progress', 'Closed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## Landing Page Flow

The single-page landing flow (`/`) is structured in optimal conversion sequence:

1. **Header** — Sticky brand header with logo, navigation links, and "Get AI Video Quote" CTA.
2. **Hero** — Main value propositions, badge strip, direct quote CTA, and asset-backed hero visual with compact format pills.
3. **Trust Strip** — 4-column trust badge bar (`5+ AI Video Formats`, `48–72 Hour Delivery`, `9:16 Reel Ready`, `Script + 1 Revision Included`).
4. **Samples** — Filterable 9:16 video portfolio with integrated deliverables checklist and smooth continuous 15s rotation.
5. **Services** — 5 distinct AI video service cards with features, best-for highlights, pricing, and holographic expand animations.
6. **Why AI Video** — 6-card value proposition grid highlighting speed, cost-efficiency, and scalability.
7. **Pricing** — Staggered comparison table covering Single Reel vs 5, 10, and 15 Reel packages, plus custom volume quote button.
8. **Digital Twin** — Feature highlight for reusable AI avatar & voice clone configuration with dual-directional slide entrance.
9. **Industries** — 12 industry verticals (D2C, Real Estate, Healthcare, Coaching, etc.) with recommended video formats.
10. **Use Cases** — Interactive use-case pill tags with spring pop-in animations.
11. **Process** — 6-step streamlined production pipeline with sequential 3D domino flip cards.
12. **Why Us** — Quickupp AI Studio differentiators with 3D tilt float animations and turnaround stats.
13. **Portfolio** — Curated portfolio showcase of client campaigns across industries.
14. **FAQ** — Unified accordion panel with hover auto-expand/collapse.
15. **WhatsApp CTA** — Fast-action WhatsApp consultation banner with direct chat link.
16. **Lead Quote Form (`#contact`)** — Interactive 6-field quote request form with custom dropdown icons, CRM storage, and WhatsApp lead generation.
17. **Contact Banner** — Ambient glowing CTA card with smooth scroll lift.
18. **Footer** — Compact 4-column footer with brand logo identical to header, links, and centered copyright.
19. **Quote Pop-up Modal** — Timed lead capture modal that triggers every 10 seconds with custom dropdown arrows and WhatsApp submission.
20. **Floating WhatsApp Button** — Instant 1-click consultation floating button.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Bun](https://bun.sh/) (or `npm`)
- [PostgreSQL](https://www.postgresql.org/) (Running on port 5432)

### Installation

```bash
bun install
```

### Development Server

```bash
bun run dev
```

The application runs locally on **http://localhost:8080/** with fast HMR.

### Production Build

```bash
bun run build
```

---

## Content Customization

All text copy, pricing, features, industry list, process steps, FAQs, terms, and contact links are centralized in:

📂 **[`src/components/site/data.ts`](src/components/site/data.ts)**

Edit this file directly to update any copy or numbers across the site without changing component code.

---

## License

© 2026 Quickupp AI Studio. All rights reserved.


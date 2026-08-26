# Quickupp AI Studio

Marketing & Lead Generation platform + CRM Admin Portal for **Quickupp AI Studio** — an AI video production agency offering AI UGC, AI Avatar, AI Cartoon Animation, Hyper-Realistic and AI Digital Twin video production for modern businesses, brands, and creators.

🌐 **Live Domain:** [https://quickuppaistudio.com](https://quickuppaistudio.com)  
🐙 **GitHub Repository:** [https://github.com/QSPL8080/AI-STUDIO.git](https://github.com/QSPL8080/AI-STUDIO.git)

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend Framework** | [TanStack Start](https://tanstack.com/start) (Fullstack SSR + React 19) |
| **Routing** | TanStack Router (file-based type-safe routing) |
| **Database** | Dual Architecture: [Supabase](https://supabase.com) (Production HTTPS REST API) + PostgreSQL (Local `pg` Pool) |
| **Hosting & CI/CD** | Hostinger Cloud Hosting + Automated GitHub Push Deployments |
| **Styling & Design System** | Tailwind CSS v4 + OKLCH tokens + Custom Keyframe Animations |
| **Typography** | Space Grotesk (Sans) + Playfair Display / Cormorant Garamond (Serif Highlights) |
| **Build Tool & Server** | Vite 8 + Nitro (`node-server` runtime) |
| **Icons** | Lucide React |
| **Language** | TypeScript |

---

## Key Features

- ⚡ **High-Conversion Landing Page:** Responsive design showcasing AI video formats, pricing tiers, workflow process, video samples, client trust strips, and interactive FAQs.
- 🎯 **Lead Capture Forms:**
  - **Main Contact Section:** Full requirement capture form.
  - **Timed Quote Modal:** Appears on every refresh (1.2s delay) and recurs every 5 minutes.
- 💬 **Instant WhatsApp Integration:** One-click WhatsApp action with pre-populated lead messages.
- 📊 **Dedicated CRM Admin Portal (`/admin`):**
  - KPI counters (Total, Contact Form, Popup Modal, Today's New).
  - Search, filter by source & status, inline status updates (`New`, `Contacted`, `In Progress`, `Closed`).
  - 1-Click WhatsApp direct response & CSV Export.
  - 🔒 **Security Auto-Logout:** Automatic logout after 5 minutes of inactivity.

---

## Admin CRM Portal

- **URL Route:** `/admin` ([https://quickuppaistudio.com/admin](https://quickuppaistudio.com/admin))
- **Default Admin Email:** `admin@aistudio.com`
- **Default Password:** `Admin@123`

---

## Environment Variables Configuration

Create a `.env` file in the root directory for local development (copy from `.env.example`):

```env
# PostgreSQL Database Connection (Localhost)
DATABASE_URL=postgres://postgres:8080@localhost:5432/ai_studio

# Production Supabase Credentials (Configured in Hostinger)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your-supabase-key

# Server Port
PORT=3000
```

---

## Database Architecture & Schema

The database automatically initializes the table upon first lead submission.

### Table Schema (`leads`):
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

## Local Development & Setup

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Build for production
npm run build

# 4. Preview / Run production build locally
npm run preview
# or
npm start
```

---

## Hostinger Deployment & Continuous Delivery

1. **Auto-Deploy on Push:** Pushing commits to the `main` branch on GitHub automatically triggers a redeploy on Hostinger.
2. **Environment Variables on Hostinger:**
   - `DATABASE_URL` / `SUPABASE_URL` & `SUPABASE_API_KEY`
   - `PORT=3000`
3. **Production Entrypoint:** `node .output/server/index.mjs` (configured via `npm start`).

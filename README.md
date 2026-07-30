# Qevrix Guardian

Set up a new web app called "QEVRIX Discipline Monitor" — a premium, professional light-mode dashboard product. This is the design system for the ENTIRE app. Apply it consistently to every screen you build in this and future phases.

DESIGN SYSTEM — Light Mode (premium, Apple/Linear-inspired)

- Background: off-white #F8FAFC (page background), #F9FAF5 acceptable for secondary sections

- Cards: pure white #FFFFFF, 1px border #E5E7EB, radius 12–16px, soft layered shadow (not harsh drop shadow — subtle, diffused, like shadow-sm/shadow-md stacked)

- Primary accent: GAT green #22C55E — used for primary buttons, active states, success indicators, key highlights. Never overuse it; it should feel like an accent, not a wash.

- Text: dark navy #0F172A for headings/primary text, a muted slate gray for secondary text

- Borders/dividers: #E5E7EB, subtle and quiet

- Glassmorphism: use sparingly on nav bars, modals, and hero sections — frosted white translucent panels with backdrop-blur, not on every card

- Typography: Inter or Space Grotesk for headings, Inter for body. Confident but restrained type scale, generous line-height, no cramped spacing

- Spacing: generous whitespace, consistent 8px-based spacing scale, never crowded

- Motion: subtle micro-interactions — hover lifts on cards, smooth transitions (150–250ms), no flashy or bouncy animation

- Icons: line-style icons (Lucide), consistent stroke width, never mixed icon styles

- Overall feel: clean, trustworthy, institutional-premium — like a modern campus security product, not a generic SaaS template. Avoid neon, avoid glassmorphism overuse, avoid generic dashboard-template look.

PROJECT SETUP

- Connect Supabase as the backend

- Create these tables in Supabase (keep the schema minimal, do not over-normalize):

  1. users (id, email, role [student/teacher/admin], full_name, phone, created_at)

  2. branches (id, name, code, color_hex, color_name)

  3. students (id, user_id FK, usn, full_name, branch_id FK, semester, profile_photo_url, email, phone)

  4. teachers (id, user_id FK, full_name, branch_id FK, email, phone)

  5. detections (id, student_id FK nullable, student_name, branch_id FK nullable, image_url, id_card_found boolean, id_card_color text, expected_branch_color text, color_match boolean, detection_time timestamptz, confidence numeric, status text, notification_sent boolean)

  6. notifications (id, recipient_user_id FK, detection_id FK, type text, message text, is_read boolean, created_at)

- Set up Supabase Auth (email/password) with role-based access: student, teacher, admin

- Create a shared app shell: top nav (logo left, user menu right) for authenticated views, and a distinct public marketing layout for logged-out visitors

- Do NOT build any pages yet beyond a placeholder logged-out landing page and a working login/signup flow — that comes in the next phases

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

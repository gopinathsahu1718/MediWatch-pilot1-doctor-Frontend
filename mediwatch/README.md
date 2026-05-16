# MediWatch — Doctor Portal

A Next.js 15 doctor panel for the MediWatch patient monitoring system.

---

## Prerequisites

Before you begin, make sure you have installed:

- **Node.js** v18 or above → https://nodejs.org
- **npm** v9 or above (comes with Node.js)

To verify:
```bash
node -v
npm -v
```

---

## Setup & Run Instructions

### Step 1 — Extract the zip

Unzip the downloaded file to a folder of your choice.

```bash
unzip mediwatch.zip
cd mediwatch
```

### Step 2 — Install dependencies

```bash
npm install
```

This installs all required packages (Next.js, React, Tailwind CSS, etc.). It may take 1–2 minutes.

### Step 3 — Start the development server

```bash
npm run dev
```

### Step 4 — Open in browser

Go to: **http://localhost:3000**

The app will automatically redirect you to the login page.

---

## Demo Login

The login page accepts **any** values matching:
- Phone number: 10+ digits (e.g. `9876543210`)
- Password: 6+ characters (e.g. `doctor123`)

No real backend is connected — all data is dummy/mock.

---

## Pages & Features

| Route | Description |
|-------|-------------|
| `/login` | Login with phone + password. Includes 3-step password reset flow. |
| `/dashboard` | Active patient overview — 4 stat cards, sortable alert list, call modal, acknowledge actions. |
| `/register` | Full patient registration form — basic details, medical details, dynamic medicines. |
| `/patients` | Full patient registry — 4 stat cards, searchable, filterable by status. |
| `/patients/[id]` | Individual patient detail — personal info, medical info, medicines, monitoring history. |
| `/profile` | Doctor profile view with change-password form. |

---

## Project Structure

```
mediwatch/
├── app/
│   ├── globals.css          # Global styles + custom classes
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Redirects → /login
│   ├── login/page.tsx       # Login + password reset flow
│   ├── dashboard/page.tsx   # Doctor dashboard
│   ├── register/page.tsx    # Patient registration form
│   ├── patients/
│   │   ├── page.tsx         # Patient list
│   │   └── [id]/page.tsx    # Individual patient detail
│   └── profile/page.tsx     # Doctor profile
├── components/
│   └── Sidebar.tsx          # Sidebar navigation
├── lib/
│   └── dummyData.ts         # All dummy data (patients, doctor)
├── package.json
└── README.md
```

---

## Build for Production

```bash
npm run build
npm start
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm install` fails | Make sure Node.js 18+ is installed |
| Port 3000 in use | Run `npm run dev -- -p 3001` to use port 3001 |
| Page not found | Make sure you're in the `mediwatch/` folder |
| Styles not loading | Hard refresh the browser (Ctrl+Shift+R) |

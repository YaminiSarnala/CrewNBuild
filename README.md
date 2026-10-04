# OctaBuild Mobile — Android & iOS (Expo)

Mobile client for the existing OctaBuild platform.

**Your backend, web frontend and database are untouched.** This app is a new,
separate client that talks to your existing FastAPI server over the same REST
endpoints the web app already uses. Nothing here requires you to modify
`backend/`, `frontend 7/`, or the Postgres database.

---

## 1. File structure

```
octabuild-mobile/
│
├── package.json              Dependencies + npm scripts
├── app.json                  Expo config: app name, icons, bundle IDs, permissions
├── babel.config.js           NativeWind + Reanimated plugins (order matters)
├── metro.config.js           Wires global.css into NativeWind
├── tailwind.config.js        ⭐ COPIED FROM YOUR WEB APP — identical color tokens
├── global.css                Tailwind directives
├── index.js                  Entry point → registers App
├── App.js                    Loads Manrope + Inter fonts, mounts all providers
├── eas.json                  Cloud build profiles (this is how you get an iOS build on Windows)
├── .env.example              Copy to .env and set your PC's LAN IP
├── .gitignore
│
├── assets/                   Taken from your web public/ folder
│   ├── logo.png                  your octopus-logo.png
│   ├── hero-background.jpg       your hero photo
│   ├── auth-architecture-bg.png  your auth background
│   ├── login-background.png      your login background
│   ├── icon.png                  GENERATED from your logo on #134127
│   ├── adaptive-icon.png         GENERATED (Android)
│   ├── splash.png                GENERATED
│   └── favicon.png               GENERATED
│
└── src/
    │
    ├── api/                  ── API LAYER (ported 1:1 from web src/services/) ──
    │   ├── client.js             axios instance, SecureStore tokens, imageUrl(), websocketUrl()
    │   ├── auth.js               /auth/login, /auth/signup, /auth/complete-profile
    │   ├── projects.js           /owners/projects, /projects/*, /timelines/*
    │   ├── engineers.js          /engineers/*, project assign/unassign
    │   ├── costTool.js           /cost-tool/* (all 7 ledgers) + /materials, /labour
    │   ├── requests.js           /project-requests/*
    │   ├── messages.js           /messages/*
    │   ├── notifications.js      /notifications/*
    │   ├── profiles.js           /contractors/{id}/profile, /suppliers/{id}/profile
    │   ├── estimates.js          /estimates/calculate, /estimates
    │   ├── location.js           /locations/pincode/{pincode}
    │   ├── materialRequests.js   /material-requests/*, /supplier/material-requests/*
    │   ├── supplierProducts.js   /supplier-products/*
    │   ├── upload.js             /files/upload — adapted for expo-image-picker
    │   └── oauth.js              Google/Microsoft — see "Known limitation" below
    │
    ├── store/                ── REDUX ──
    │   ├── index.js              configureStore
    │   └── authSlice.js          Ported from web authSlice; async SecureStore rehydration
    │
    ├── i18n/                 ── LANGUAGES ──
    │   ├── translations.js       ⭐ COPIED BYTE-FOR-BYTE — all 7 languages
    │   └── LanguageContext.jsx   RN port: AsyncStorage + RTL via I18nManager
    │
    ├── theme/                ── DESIGN SYSTEM ──
    │   ├── tokens.js             Shadows + all 8 of your keyframes as Moti configs
    │   └── ThemeContext.jsx      Light/dark, ported from web ThemeContext
    │
    ├── components/           ── SHARED UI ──
    │   ├── ui.jsx                Reveal, Container, Eyebrow, SectionHeading,
    │   │                         SmartImage, Stars, PrimaryButton, GhostButton,
    │   │                         Pill, GlassCard, StatCard, EmptyState
    │   ├── Field.jsx             Field, ErrorBanner, RoleCard
    │   ├── Navbar.jsx            Floating top bar: logo, language, sign in
    │   ├── LanguageSheet.jsx     Bottom-sheet picker for all 7 languages
    │   ├── BlurWrap.jsx          Frosted-glass helper
    │   └── DashboardShell.jsx    Shared dashboard chrome + useAsyncData hook
    │
    ├── site/                 ── LANDING PAGE ──
    │   ├── data.js               ⭐ COPIED FROM WEB (one line added for native image)
    │   ├── Hero.jsx              Port of web Hero.jsx, same staggered animation
    │   └── sections.jsx          TrustBar, Services, Stats, Projects, WhyUs,
    │                             Process, Testimonials, Faq, CTA, Footer
    │
    ├── screens/              ── SCREENS ──
    │   ├── LandingScreen.jsx     First screen. Same section order as web Home.jsx
    │   ├── EstimateScreen.jsx    Public cost calculator
    │   ├── auth/
    │   │   ├── LoginScreen.jsx
    │   │   ├── SignupScreen.jsx          4 roles, pincode auto-lookup
    │   │   └── CompleteProfileScreen.jsx Role-specific required fields
    │   ├── owner/OwnerDashboard.jsx
    │   ├── contractor/ContractorDashboard.jsx
    │   ├── supplier/SupplierDashboard.jsx
    │   ├── engineer/EngineerDashboard.jsx
    │   └── shared/NotificationsScreen.jsx
    │
    └── navigation/
        └── RootNavigator.jsx     Port of web AppRouter.jsx, same 3 guard rules
```

---

## 2. Setup on Windows — step by step

### Step 1 — Install Node.js
Install the **LTS** build from nodejs.org. Verify:
```
node -v
npm -v
```

### Step 2 — Create the folders and files
Recreate the tree above. Then install:
```
cd octabuild-mobile
npm install
```

### Step 3 — Find your PC's IP address
This is the step people most often get wrong. On your phone, `localhost` means
*the phone*, not your PC. Open Command Prompt:
```
ipconfig
```
Look for **IPv4 Address** under your active adapter — something like
`192.168.1.7`.

### Step 4 — Point the app at your backend
Copy `.env.example` to `.env` and set your IP:
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.7:8000
```

### Step 5 — Start your existing backend so the phone can reach it
Your FastAPI server must listen on all interfaces, not just localhost. Start it
with:
```
uvicorn app.main:app --host 0.0.0.0 --port 8000
```
This is a **command-line flag only** — no code change. Without `--host 0.0.0.0`
the server only accepts connections from the PC itself and your phone will time
out.

Then check Windows Firewall allows inbound port 8000 on Private networks. This
is the second most common cause of "Network Error" on the phone.

### Step 6 — Run the app
```
npx expo start
```
A QR code appears.

- **Android:** install **Expo Go** from the Play Store, open it, scan the QR code.
- **iPhone:** install **Expo Go** from the App Store, scan the QR with the Camera app.

Your PC and phone must be on the same Wi-Fi. If the QR doesn't connect, try:
```
npx expo start --tunnel
```

At this point you can develop for **both** Android and iOS from Windows.

### Step 7 — Store builds (when you're ready to ship)
```
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview   → installable APK
eas build --platform ios --profile preview       → needs Apple Developer account
```
EAS compiles the iOS binary on Expo's cloud Macs. This is how you ship to the
App Store without owning a Mac.

Accounts required: **Apple Developer $99/year**, **Google Play $25 one-time**.

---

## 3. What is complete vs. what still needs building

### Complete and wired to your API
- Landing page (all 10 sections) — first screen a user sees
- All 7 languages with live switching
- Login, signup (4 roles), complete-profile
- Session persistence in encrypted storage
- All four role dashboards fetching live data
- Notifications, public cost estimator
- All 15 API modules covering your endpoint surface

### Not yet built (screens only — the API calls already exist)
- Daily cost tool (7 ledgers) — `src/api/costTool.js` is ready
- Timeline updates with photo upload — `src/api/projects.js` + `upload.js` ready
- Real-time chat — `websocketUrl()` in `client.js` ready
- Engineer invite / team management — `src/api/engineers.js` ready
- Supplier catalogue add/edit — `src/api/supplierProducts.js` ready

Your web frontend is ~23,500 lines across 56 pages; this is ~8,200 lines. The
foundation is complete, so the remaining screens are additive work, not
rework.

---

## 4. Known limitation: Google / Microsoft sign-in is disabled

Your OAuth callback redirects to `FRONTEND_ORIGIN` (`http://localhost:5173`),
which a phone cannot open. Enabling it requires a backend change, and you asked
that the backend stay untouched — so those two buttons are hidden rather than
shipped broken. `SHOW_OAUTH = false` at the top of `src/screens/auth/LoginScreen.jsx`.

**Email and password login works fully with no backend change.**

If you ever do decide to change it: have the callback accept a `redirect_uri`
and send users to `octabuild://oauth?access_token=...`. Then set `SHOW_OAUTH = true`.
`src/api/oauth.js` is already written for that flow.

---

## 5. One security note

The `backend.zip` you shared contained the real `.env` with a live
`JWT_SECRET_KEY`, database password and SMTP credentials. Rotating those is
worth doing before launch — it isn't a code change, just new values in your
`.env`. Rotating the JWT secret signs out existing sessions, which is harmless
before launch.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "Network Error" on login | Phone can't reach backend | Use LAN IP not localhost; start uvicorn with `--host 0.0.0.0`; allow port 8000 in Firewall |
| QR code won't connect | Different networks / VPN | Same Wi-Fi, disable VPN, or `npx expo start --tunnel` |
| Fonts look wrong | Fonts still loading | App.js returns null until loaded — wait a moment on first launch |
| Colors look off | Tailwind not picking up files | Check `content` paths in tailwind.config.js |
| Reanimated error on start | Plugin order | `react-native-reanimated/plugin` must be **last** in babel.config.js |
| Images don't load | Backend unreachable | `imageUrl()` builds absolute URLs from your API base — same fix as row 1 |
| Blank screen after login | Profile incomplete redirect | Expected — RootNavigator sends you to CompleteProfile |

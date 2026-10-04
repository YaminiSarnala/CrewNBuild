# OctaBuild Mobile — End-to-End Setup Guide (Windows)

From opening VS Code to a running app on **both Android and iPhone**.
Follow in order. Do not skip Part 1.

Your backend, web frontend and database are **not modified** by anything here.

---

# PART 1 — Install the tools (once)

### 1.1 Node.js
Go to **nodejs.org** → download the **LTS** version → run the installer →
accept all defaults.

Open **Command Prompt** (press `Win`, type `cmd`, Enter) and check:
```
node -v
npm -v
```
You should see version numbers. If you get "not recognized", restart your PC.

### 1.2 VS Code
Download from **code.visualstudio.com** and install.

### 1.3 VS Code extensions
Open VS Code → click the **Extensions** icon in the left bar (four squares) →
search and install each:
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **Prettier — Code formatter**

### 1.4 Expo Go on your phone
- **Android:** Play Store → "Expo Go" → Install
- **iPhone:** App Store → "Expo Go" → Install

> This is the key to your Windows problem: Expo Go runs your app on a real
> iPhone without you ever needing a Mac.

---

# PART 2 — Create the project folder

### 2.1 Make the folder
Open Command Prompt:
```
cd %USERPROFILE%\Desktop
mkdir octabuild-mobile
cd octabuild-mobile
```

### 2.2 Open it in VS Code
```
code .
```
VS Code opens with an empty project. Everything from here happens inside it.

### 2.3 Open the built-in terminal
In VS Code press **Ctrl + `** (backtick, above Tab). A terminal opens at the
bottom, already inside your project folder. **Use this terminal for all
commands below.**

---

# PART 3 — Create the folder structure

In the VS Code terminal, paste this **one block** and press Enter. It creates
every folder at once:

```
mkdir src\api src\store src\i18n src\theme src\components src\site src\navigation src\hooks assets
mkdir src\screens\auth src\screens\owner src\screens\contractor src\screens\supplier src\screens\engineer src\screens\shared
```

Your Explorer panel (left side) should now show:

```
octabuild-mobile/
├── assets/
└── src/
    ├── api/  components/  hooks/  i18n/  navigation/
    ├── screens/
    │   └── auth/ owner/ contractor/ supplier/ engineer/ shared/
    ├── site/  store/  theme/
```

### How to create a file in VS Code
1. In the **Explorer** panel, hover the folder you want.
2. Click the **New File** icon (page with a `+`).
3. Type the exact filename **including the extension** (`.js` or `.jsx`).
4. Press Enter, paste the contents, press **Ctrl + S**.

> `.js` vs `.jsx` matters. Files containing JSX markup use `.jsx`. Copy the
> exact names from the table below.

---

# PART 4 — Where every file goes

## 4.1 Root files (12) — directly inside `octabuild-mobile/`

| File | Purpose |
|---|---|
| `package.json` | Dependency list. **Create this one first.** |
| `app.json` | App name, icons, bundle IDs, permissions, rotation |
| `babel.config.js` | NativeWind + Reanimated. Plugin order matters |
| `metro.config.js` | Connects `global.css` to NativeWind |
| `tailwind.config.js` | **Your web colours, copied exactly** |
| `global.css` | Three Tailwind directives |
| `index.js` | Entry point |
| `App.js` | Loads fonts, mounts providers |
| `eas.json` | Cloud build profiles (how you get iOS builds) |
| `.env.example` | Template — you copy this to `.env` |
| `.gitignore` | Keeps secrets and `node_modules` out of git |
| `README.md` | Reference |

## 4.2 `assets/` (8 files)
Download the image files and place all 8 here:
`logo.png`, `hero-background.jpg`, `auth-architecture-bg.png`,
`login-background.png`, `icon.png`, `adaptive-icon.png`, `splash.png`,
`favicon.png`

> Four are your real web assets; four were generated from your Octopus logo.
> **All 8 must exist** — `App.js` and `app.json` reference them by name and
> Metro fails on a missing `require()`.

## 4.3 `src/api/` (15 files)
`client.js`, `auth.js`, `projects.js`, `engineers.js`, `costTool.js`,
`requests.js`, `messages.js`, `notifications.js`, `profiles.js`,
`estimates.js`, `location.js`, `materialRequests.js`, `supplierProducts.js`,
`upload.js`, `oauth.js`

## 4.4 `src/store/` (2)
`index.js`, `authSlice.js`

## 4.5 `src/i18n/` (2)
`translations.js` (large — all 7 languages), `LanguageContext.jsx`

## 4.6 `src/theme/` (2)
`tokens.js`, `ThemeContext.jsx`

## 4.7 `src/hooks/` (1)
`useResponsive.js`

## 4.8 `src/components/` (7)
`ui.jsx`, `Field.jsx`, `Navbar.jsx`, `LanguageSheet.jsx`, `BlurWrap.jsx`,
`DashboardShell.jsx`, `Responsive.jsx`

## 4.9 `src/site/` (3)
`data.js`, `Hero.jsx`, `sections.jsx`

## 4.10 `src/screens/` (9)
- `src/screens/` → `LandingScreen.jsx`, `EstimateScreen.jsx`
- `src/screens/auth/` → `LoginScreen.jsx`, `SignupScreen.jsx`, `CompleteProfileScreen.jsx`
- `src/screens/owner/` → `OwnerDashboard.jsx`
- `src/screens/contractor/` → `ContractorDashboard.jsx`
- `src/screens/supplier/` → `SupplierDashboard.jsx`
- `src/screens/engineer/` → `EngineerDashboard.jsx`
- `src/screens/shared/` → `NotificationsScreen.jsx`

## 4.11 `src/navigation/` (1)
`RootNavigator.jsx`

**Total: 61 files.**

### Recommended creation order
Create in this order so you never have a file importing something missing:

```
1. package.json          6. src/store/
2. config files          7. src/components/
3. assets/               8. src/site/
4. src/theme/ + hooks/   9. src/screens/
5. src/i18n/ + api/     10. src/navigation/ → App.js → index.js
```

---

# PART 5 — Install dependencies

Once `package.json` exists, in the VS Code terminal:
```
npm install
```
Takes 3–8 minutes. A `node_modules` folder appears — never edit it, never
commit it.

If it fails, run `npm cache clean --force` then `npm install` again.

---

# PART 6 — Connect the app to your backend

**This is the step that trips up almost everyone.** On your phone,
`localhost` means *the phone itself*, not your laptop.

### 6.1 Find your laptop's IP
In Command Prompt:
```
ipconfig
```
Find **IPv4 Address** under your active adapter (Wi-Fi or Ethernet).
Example: `192.168.1.7`

### 6.2 Create `.env`
In VS Code create a file named exactly `.env` in the project root:
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.7:8000
```
Use **your** IP, not the example.

### 6.3 Start your existing backend so the phone can reach it
In a **separate** Command Prompt, in your backend folder:
```
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

> `--host 0.0.0.0` is a **command-line flag, not a code change**. Your backend
> files stay untouched. Without it, uvicorn only accepts connections from the
> laptop itself and your phone will time out.

### 6.4 Allow port 8000 through Windows Firewall
Windows Search → "Windows Defender Firewall with Advanced Security" →
**Inbound Rules** → **New Rule** → Port → TCP, Specific local ports: `8000`
→ Allow the connection → tick **Private** → name it "OctaBuild API".

### 6.5 Verify before going further
On your **phone's browser**, visit:
```
http://192.168.1.7:8000/health
```
You should see `{"status":"ok"}`. **If this does not work, the app will not
work either** — fix it here first. It is always one of: wrong IP, missing
`--host 0.0.0.0`, firewall, or phone on a different network.

---

# PART 7 — Run the app

In the VS Code terminal:
```
npx expo start
```
A QR code appears.

### Android
Open **Expo Go** → **Scan QR code** → scan.

### iPhone
Open the built-in **Camera** app → point at the QR → tap the banner.

First load takes 30–60 seconds. You should land on the **OctaBuild landing
page**.

### If the QR won't connect
```
npx expo start --tunnel
```
Slower, but works across networks and around firewalls.

### Useful keys while running
| Key | Does |
|---|---|
| `r` | Reload the app |
| `m` | Toggle the dev menu |
| `Ctrl + C` | Stop the server |

Saving a file in VS Code reloads the phone automatically.

---

# PART 8 — Responsive behaviour (phones + tablets)

`src/hooks/useResponsive.js` is the engine. It classifies by **shortest
screen side**, so a phone in landscape stays a phone.

| Device | Shortest side | Columns | Type scale | Max content width |
|---|---|---|---|---|
| Phone | < 600 dp | 1 | 1.0× | full width |
| Tablet | 600–899 dp | 2 | 1.1× | 720 dp |
| Large tablet (portrait) | ≥ 900 dp | 2 | 1.18× | 900 dp |
| Large tablet (landscape) | ≥ 900 dp | 3 | 1.18× | 900 dp |

What changes automatically:
- **Cards reflow** — services, projects, why-us and testimonials go 1 → 2 → 3 columns
- **Content centres** and stops stretching, so text lines stay readable
- **Hero splits** — on tablets the copy sits in a left column with a
  left-to-right gradient, matching the web's `lg:` layout
- **Buttons go side-by-side** on tablets instead of stacked
- **Padding grows** — 20 → 24 → 32 dp
- **Rotation is live** — `useWindowDimensions` re-renders on rotate and on
  Android/iPad split-screen resize

`app.json` sets `"orientation": "default"` so tablets can rotate.

### Testing responsiveness without a tablet
- Rotate your phone — layout should adapt smoothly
- Android split-screen — resize the window and watch it reflow
- Settings → Display → largest font size — layout must not break
  (`fontScale` is respected)

---

# PART 9 — Building for the App Store and Play Store

Expo Go is for development. For real installable builds:

```
npm install -g eas-cli
eas login
eas build:configure
```

### Android APK (test on any Android phone)
```
eas build --platform android --profile preview
```

### iOS
```
eas build --platform ios --profile preview
```
EAS compiles this on **Expo's cloud Mac machines**. You never need your own Mac.

### Production
```
eas build --platform all --profile production
eas submit --platform android
eas submit --platform ios
```

**Accounts required:** Apple Developer **$99/year**, Google Play **$25 one-time**.

---

# PART 10 — Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| "Network Error" on login | Phone can't reach backend | Redo Part 6, especially 6.5 |
| QR won't connect | Different networks / VPN | Same Wi-Fi, VPN off, or `--tunnel` |
| `Unable to resolve module ...` | File missing or misnamed | Check `.js` vs `.jsx` and the exact folder |
| Reanimated error on startup | Plugin order | `react-native-reanimated/plugin` must be **last** in `babel.config.js` |
| Colours all wrong / no styling | Tailwind not scanning | Check `content` paths in `tailwind.config.js`; restart with `npx expo start -c` |
| Fonts look like system default | Still loading | `App.js` returns null until ready — wait a moment |
| `Unable to resolve asset` | Missing image in `assets/` | All 8 asset files must exist |
| Images from server don't load | Backend unreachable | Same fix as row 1 |
| Blank screen after login | Profile incomplete | Expected — you're on CompleteProfile |
| Changes not appearing | Stale cache | `npx expo start -c` |

---

# PART 11 — What's built vs. what isn't

### Working now
Landing page (10 sections) · 7 languages with live switching · login · signup
(4 roles) · complete-profile · encrypted session persistence · all four role
dashboards on live data · notifications · cost estimator · full responsive
phone + tablet layout

### Not built yet (API modules already written)
Daily cost tool (7 ledgers) · timeline photo upload · real-time chat ·
engineer team management · supplier catalogue editor

Your web frontend is ~23,500 lines across 56 pages; this is ~8,600 lines. The
foundation is complete, so these are additive screens rather than rework.

### Google / Microsoft sign-in is disabled
Your OAuth callback redirects to `localhost:5173`, which a phone cannot open.
Enabling it needs a backend change, and you asked that the backend stay
untouched — so those buttons are hidden rather than shipped broken
(`SHOW_OAUTH = false` in `LoginScreen.jsx`). **Email and password login works
fully.** `src/api/oauth.js` is ready if you ever change your mind.

---

# PART 12 — One security note

The `backend.zip` you shared contained the real `.env` with a live
`JWT_SECRET_KEY`, database password and SMTP credentials. Rotating those before
launch is worth doing — it's new values in your `.env`, not a code change.
Rotating the JWT secret signs out existing sessions, which is harmless now.

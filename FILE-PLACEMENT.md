# Getting the files into VS Code — exact steps

You have 65 files to place into 16 folders. There are two ways to do it.
**Method A takes about 3 minutes.** Method B is fully manual.

---

# METHOD A — Download + run the organiser script (recommended)

### Step A1 — Download every file into ONE folder
Click each file card and save it. Let them all land in your **Downloads**
folder. Do not try to sort them yet.

> **Two files are both called `index.js`.** Windows will save the second as
> `index (1).js`. That is fine — the script tells them apart by reading their
> contents, so download order does not matter.

### Step A2 — Put the script with them
Download **`organize.ps1`** into that same Downloads folder.

### Step A3 — Run it
Right-click `organize.ps1` → **Run with PowerShell**.

If Windows blocks it:
1. Press `Win`, type **PowerShell**, open it
2. Paste and run:
   ```
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   cd $env:USERPROFILE\Downloads
   .\organize.ps1
   ```

### Step A4 — Answer one question
It asks where to create the project. Press **Enter** for
`Desktop\octabuild-mobile`.

The script creates all 16 folders, copies all 65 files into the right places,
sorts the two `index.js` files by content, and prints a summary.

### Step A5 — Open in VS Code
```
cd %USERPROFILE%\Desktop\octabuild-mobile
code .
npm install
```

Then continue at **Part 6** of `SETUP-GUIDE.md`.

---

# METHOD B — Fully manual in VS Code

### Step B1 — Create and open the project
Open Command Prompt:
```
cd %USERPROFILE%\Desktop
mkdir octabuild-mobile
cd octabuild-mobile
code .
```

### Step B2 — Open the VS Code terminal
Press **Ctrl + `** (the backtick key, above Tab).

### Step B3 — Create all folders with one paste
Paste this into the VS Code terminal and press Enter:
```
mkdir src\api src\store src\i18n src\theme src\components src\site src\navigation src\hooks assets
mkdir src\screens\auth src\screens\owner src\screens\contractor src\screens\supplier src\screens\engineer src\screens\shared
```

### Step B4 — How to create each file
1. In the **Explorer** panel on the left, **click the folder** you want the
   file in (this matters — new files are created inside the selected folder)
2. Click the **New File** icon at the top of the Explorer panel (a page with `+`)
3. Type the **exact filename including extension**
4. Press Enter
5. Paste the contents
6. Press **Ctrl + S**

> If a file lands in the wrong folder, just drag it in the Explorer panel.

### Step B5 — Work through the table below
Create them **in the order shown**. That order means no file ever imports
something that does not exist yet, so VS Code will not show red squiggles as
you go.

---

# The complete placement table

## Group 1 — Root config (create these first)

| # | File | Put it in |
|---|---|---|
| 1 | `package.json` | project root |
| 2 | `app.json` | project root |
| 3 | `babel.config.js` | project root |
| 4 | `metro.config.js` | project root |
| 5 | `tailwind.config.js` | project root |
| 6 | `global.css` | project root |
| 7 | `eas.json` | project root |
| 8 | `.gitignore` | project root |
| 9 | `.env.example` | project root |

> **After file 1, run `npm install` in the terminal.** It takes 3–8 minutes and
> can download in the background while you create the rest.

## Group 2 — Assets (8 image files)

| # | File | Put it in |
|---|---|---|
| 10 | `logo.png` | `assets/` |
| 11 | `hero-background.jpg` | `assets/` |
| 12 | `auth-architecture-bg.png` | `assets/` |
| 13 | `login-background.png` | `assets/` |
| 14 | `icon.png` | `assets/` |
| 15 | `adaptive-icon.png` | `assets/` |
| 16 | `splash.png` | `assets/` |
| 17 | `favicon.png` | `assets/` |

> Images cannot be typed — you must download these. Drag them from File
> Explorer straight into the `assets` folder in VS Code's Explorer panel.
> **All 8 must be present** or the bundler fails on a missing `require()`.

## Group 3 — Theme and hooks (no dependencies)

| # | File | Put it in |
|---|---|---|
| 18 | `tokens.js` | `src/theme/` |
| 19 | `ThemeContext.jsx` | `src/theme/` |
| 20 | `useResponsive.js` | `src/hooks/` |

## Group 4 — Languages

| # | File | Put it in |
|---|---|---|
| 21 | `translations.js` | `src/i18n/` |
| 22 | `LanguageContext.jsx` | `src/i18n/` |

> `translations.js` is 346 KB — the biggest file by far. **Download it, do not
> retype it.** It holds all 7 languages.

## Group 5 — API layer (15 files, all in `src/api/`)

| # | File | Put it in |
|---|---|---|
| 23 | `client.js` | `src/api/` |
| 24 | `auth.js` | `src/api/` |
| 25 | `projects.js` | `src/api/` |
| 26 | `engineers.js` | `src/api/` |
| 27 | `costTool.js` | `src/api/` |
| 28 | `requests.js` | `src/api/` |
| 29 | `messages.js` | `src/api/` |
| 30 | `notifications.js` | `src/api/` |
| 31 | `profiles.js` | `src/api/` |
| 32 | `estimates.js` | `src/api/` |
| 33 | `location.js` | `src/api/` |
| 34 | `materialRequests.js` | `src/api/` |
| 35 | `supplierProducts.js` | `src/api/` |
| 36 | `upload.js` | `src/api/` |
| 37 | `oauth.js` | `src/api/` |

> Create `client.js` first — the other 14 all import from it.

## Group 6 — Redux store

| # | File | Put it in |
|---|---|---|
| 38 | `authSlice.js` | `src/store/` |
| 39 | `index.js` ⚠️ | `src/store/` |

> ⚠️ **This is one of the two `index.js` files.** The one that goes here
> contains `configureStore`. If you downloaded it as `index (1).js`, rename it
> to `index.js` after moving it.

## Group 7 — Shared components (7 files, all in `src/components/`)

| # | File | Put it in |
|---|---|---|
| 40 | `Responsive.jsx` | `src/components/` |
| 41 | `ui.jsx` | `src/components/` |
| 42 | `Field.jsx` | `src/components/` |
| 43 | `BlurWrap.jsx` | `src/components/` |
| 44 | `Navbar.jsx` | `src/components/` |
| 45 | `LanguageSheet.jsx` | `src/components/` |
| 46 | `DashboardShell.jsx` | `src/components/` |

> Order matters slightly: `Navbar.jsx` imports `BlurWrap.jsx`, and `ui.jsx`
> is imported by nearly everything.

## Group 8 — Landing page

| # | File | Put it in |
|---|---|---|
| 47 | `data.js` | `src/site/` |
| 48 | `Hero.jsx` | `src/site/` |
| 49 | `sections.jsx` | `src/site/` |

## Group 9 — Screens (10 files, note the sub-folders)

| # | File | Put it in |
|---|---|---|
| 50 | `LandingScreen.jsx` | `src/screens/` |
| 51 | `EstimateScreen.jsx` | `src/screens/` |
| 52 | `LoginScreen.jsx` | `src/screens/auth/` |
| 53 | `SignupScreen.jsx` | `src/screens/auth/` |
| 54 | `CompleteProfileScreen.jsx` | `src/screens/auth/` |
| 55 | `OwnerDashboard.jsx` | `src/screens/owner/` |
| 56 | `ContractorDashboard.jsx` | `src/screens/contractor/` |
| 57 | `SupplierDashboard.jsx` | `src/screens/supplier/` |
| 58 | `EngineerDashboard.jsx` | `src/screens/engineer/` |
| 59 | `NotificationsScreen.jsx` | `src/screens/shared/` |

> Each dashboard goes in **its own** sub-folder. `OwnerDashboard.jsx` does NOT
> go in `src/screens/` — it goes in `src/screens/owner/`. Getting this wrong is
> the most common mistake, and it shows up as
> `Unable to resolve module ../screens/owner/OwnerDashboard`.

## Group 10 — Navigation and entry point (last)

| # | File | Put it in |
|---|---|---|
| 60 | `RootNavigator.jsx` | `src/navigation/` |
| 61 | `App.js` | project root |
| 62 | `index.js` ⚠️ | project root |

> ⚠️ **The other `index.js`.** This one contains `registerRootComponent`.

## Group 11 — Documentation (optional but useful)

| # | File | Put it in |
|---|---|---|
| 63 | `SETUP-GUIDE.md` | project root |
| 64 | `README.md` | project root |
| 65 | `FILE-PLACEMENT.md` | project root |

---

# Telling the two `index.js` files apart

Open each and look at the first few lines:

**Project root `index.js`** — 4 lines:
```js
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
```

**`src/store/index.js`** — starts with:
```js
import { configureStore } from '@reduxjs/toolkit'
import authReducer from './authSlice'
```

If you see `registerRootComponent` → project root.
If you see `configureStore` → `src/store/`.

---

# Checking you got it right

In the VS Code terminal:
```
dir /s /b *.js *.jsx *.json *.css | find /c /v ""
```
You should get **52** (all code files, excluding the 8 images and 3 .md guides).

Then the real test:
```
npm install
npx expo start
```
If a file is missing or misplaced, Metro tells you exactly which one:
```
Unable to resolve module ./src/components/ui from ...
```
Read the path in the error — that is precisely where the file should be.

---

# Two files that download awkwardly

`.env.example` and `.gitignore` start with a dot, and browsers sometimes strip
or rename them. Both are tiny, so if they arrive with the wrong name just
create them by hand in VS Code.

**`.env.example`** (then copy it to `.env` and put your real IP in):
```
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.7:8000
```

**`.gitignore`**:
```
node_modules/
.expo/
dist/
*.jks
*.p8
*.p12
*.key
*.mobileprovision
.env
.DS_Store
```

> To create a dot-file in VS Code, use New File and type the name starting with
> the dot — `.env` — then Enter. VS Code handles it fine.

---

# After all 65 files are in place

```
npm install
```
then follow **Part 6** of `SETUP-GUIDE.md` to point the app at your backend,
then **Part 7** to run it on your phone.

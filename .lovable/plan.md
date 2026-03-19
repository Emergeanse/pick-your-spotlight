

## Plan: Reorganize Navigation — Together vs Amis

### Summary

Restructure the bottom navigation so that:
- **"Together"** tab = dedicated to creating cinema sessions (no friend management)
- **Friend management** moves into the **Profile** page as a sub-section
- Friends page gets a QR code feature for sharing friend code

### Changes

#### 1. Bottom Tab Bar (`src/components/pick/BottomTabBar.tsx`)
- Rename "Amis" tab back to **"Together"** with `Users` icon, pointing to `/app/pick-together`
- Remove the `/app/friends` route from the tab bar

#### 2. Pick Together page (`src/pages/PickTogether.tsx`)
- Remove any friend management UI (add friend, friend code display)
- Keep it purely as a session creation flow: select friends/guests → mood → results
- Friends are listed for selection but not managed here

#### 3. Profile page (`src/pages/Profile.tsx`)
- Add a **"Mes amis"** section with:
  - Display friend code + copy button
  - Add friend by code input
  - Friend list with ability to tap and view cinematic profile (reuse existing drawer logic from Friends.tsx)
  - **QR Code** generated from the user's friend code
    - The QR encodes a URL like `https://pick-your-spotlight.lovable.app/auth?invite=PICK-XXXX`
    - When scanned: if user has an account → auto-add friend; if not → sign up then auto-add
    - Use a lightweight QR library (`qrcode.react` or generate via canvas)
  - Link to view friend profiles (cinematic profile drawer)

#### 4. Auth page (`src/pages/Auth.tsx`)
- Read `?invite=PICK-XXXX` query param
- After successful signup/login, automatically send a friend request to the owner of that code

#### 5. Friends page (`src/pages/Friends.tsx`)
- Keep the file but refactor it into a reusable component/section that Profile imports
- Or inline the friend management logic directly into Profile

#### 6. App routes (`src/App.tsx`)
- Keep `/app/friends` route working (for deep links) but it can redirect to profile
- Or remove it entirely and redirect to `/app/profile`

### Technical Details

- **QR Code**: Install `qrcode.react` package (or generate a QR as SVG/canvas). The QR encodes the published URL with an `invite` query parameter containing the friend code.
- **Invite flow**: On Auth page, after authentication, check for `invite` param in URL, look up the profile with that friend code, and insert a friendship row.
- **No new database tables needed** — uses existing `profiles.friend_code` and `friendships` table.


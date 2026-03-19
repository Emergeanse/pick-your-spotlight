

## Problem

After a new inscription, the Platform Tour (2 spotlight steps) works, but the Activation Flow (5 missions to unlock the free trial) never appears. This is because the activation flow only triggers when `fromOnboarding` is true — a flag that only exists immediately after completing onboarding. If the user refreshes or the tour completes in a way that loses this flag, the activation never starts.

Additionally, when an existing user reconnects who already completed the activation, it should never show. The current fix was too aggressive — it blocks activation for everyone unless they just came from onboarding.

## Root Cause

In `src/pages/Index.tsx` (lines 121-130):
- The tour requires `fromOnboarding` — correct, prevents old users from seeing it.
- The activation also requires `fromOnboarding` — incorrect, new users who completed the tour but refresh lose access to activation permanently.

## Plan

### 1. Fix activation trigger logic in `src/pages/Index.tsx`

Change the conditions so that:
- **Tour**: still requires `fromOnboarding` (only shows right after onboarding)
- **Activation**: shows for ANY user where `activation_completed === false`, regardless of `fromOnboarding`. This is safe because the activation is the guided mission system, not a blocking overlay — it has a progress bar and mission cards.
- **Existing users who had accounts before activation existed**: add a migration or a check — if a user has sufficient interactions (e.g., 20+ ratings), auto-mark them as `activation_completed = true` so they skip it.

Specifically, replace lines 121-130:
```typescript
if (!tourDone && fromOnboarding) {
  setShowActivation(false);
  setShowTour(true);
  sessionStorage.removeItem("pick_force_tour");
} else if (!activationDone) {
  // Show activation for any user who hasn't completed it
  setShowTour(false);
  setShowActivation(true);
}
```

### 2. Auto-complete activation for existing mature users

In the same profile loading effect, before setting `showActivation`, check if the user has enough data to skip (e.g., 20+ interactions). If so, auto-mark `activation_completed = true` in the DB and skip.

```typescript
// If user has lots of interactions already, auto-complete activation
const { count } = await supabase.from("user_interactions")
  .select("id", { count: "exact", head: true })
  .eq("user_id", user.id);
if (count && count >= 20) {
  await supabase.from("profiles").update({ activation_completed: true }).eq("id", user.id);
  // Don't show activation
} else {
  setShowActivation(true);
}
```

This ensures:
- New users after onboarding see tour then activation
- New users who refresh mid-activation resume the activation
- Existing users with 20+ interactions auto-skip
- Fully completed users see nothing

### Technical Details

- **File changed**: `src/pages/Index.tsx` — profile loading effect (lines 98-136)
- The interaction count check adds one extra lightweight query but only runs once on mount


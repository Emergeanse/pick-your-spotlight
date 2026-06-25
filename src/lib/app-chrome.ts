/** Mount point id for fullscreen overlays rendered below the tab bar (z-50 vs z-51). */
export const APP_OVERLAY_PORTAL_ID = "app-overlay-portal";

/** Visible height of BottomTabBar excluding safe-area (FAB extends above but bar row is 60px). */
export const BOTTOM_TAB_BAR_HEIGHT_PX = 60;

/** CSS length: reserve space above the fixed tab bar for overlay CTAs. */
export const bottomTabBarClearance = `calc(${BOTTOM_TAB_BAR_HEIGHT_PX}px + env(safe-area-inset-bottom))`;

export function getAppOverlayPortalElement(): HTMLElement {
  return document.getElementById(APP_OVERLAY_PORTAL_ID) ?? document.body;
}

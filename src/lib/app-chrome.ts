/** Mount point id for fullscreen overlays rendered below the tab bar (z-50 vs z-51). */
export const APP_OVERLAY_PORTAL_ID = "app-overlay-portal";

/** Visible height of BottomTabBar excluding safe-area (FAB extends above but bar row is 60px). */
export const BOTTOM_TAB_BAR_HEIGHT_PX = 60;

/**
 * ResultScreen fixed footer (CTA + suggestion nav + actions + MovieActionBar xs + padding),
 * excluding tab bar clearance.
 */
export const RESULT_FIXED_FOOTER_HEIGHT_PX = 172;

/** CSS length: reserve space above the fixed tab bar for overlay CTAs. */
export const bottomTabBarClearance = `calc(${BOTTOM_TAB_BAR_HEIGHT_PX}px + env(safe-area-inset-bottom))`;

/** Scroll padding for ResultScreen content above the fixed footer + tab bar. */
export const resultScreenScrollPaddingBottom = `calc(${RESULT_FIXED_FOOTER_HEIGHT_PX}px + ${BOTTOM_TAB_BAR_HEIGHT_PX}px + env(safe-area-inset-bottom))`;

/** Scroll padding for fullscreen detail overlays (FlipCardDetail) above the tab bar. */
export const overlayDetailScrollPaddingBottom = `calc(${BOTTOM_TAB_BAR_HEIGHT_PX}px + 1.5rem + env(safe-area-inset-bottom))`;

export function getAppOverlayPortalElement(): HTMLElement {
  return document.getElementById(APP_OVERLAY_PORTAL_ID) ?? document.body;
}

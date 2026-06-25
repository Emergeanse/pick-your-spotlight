type TabBarListener = (hidden: boolean) => void;

const hideReasons = new Set<string>();
const tabBarListeners = new Set<TabBarListener>();

function emitTabBarHidden() {
  const hidden = hideReasons.size > 0;
  tabBarListeners.forEach((listener) => listener(hidden));
}

/** Masque la BottomTabBar tant qu'au moins une raison fullscreen est active. */
export function setAppChromeTabBarHidden(reason: string, hidden: boolean) {
  if (hidden) hideReasons.add(reason);
  else hideReasons.delete(reason);
  emitTabBarHidden();
}

export function subscribeAppChromeTabBar(listener: TabBarListener): () => void {
  tabBarListeners.add(listener);
  listener(hideReasons.size > 0);
  return () => {
    tabBarListeners.delete(listener);
  };
}

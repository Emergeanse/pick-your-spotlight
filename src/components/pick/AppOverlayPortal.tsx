import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getAppOverlayPortalElement } from "@/lib/app-chrome";

/** Renders children into the AppLayout overlay mount (z-50, below BottomTabBar z-51). */
const AppOverlayPortal = ({ children }: { children: React.ReactNode }) => {
  const [mount, setMount] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMount(getAppOverlayPortalElement());
  }, []);

  if (!mount) return null;
  return createPortal(children, mount);
};

export default AppOverlayPortal;

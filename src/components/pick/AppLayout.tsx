import BottomTabBar from "@/components/pick/BottomTabBar";

/**
 * Mobile-first layout. On md+ we frame the app as a centered phone-shaped
 * surface so the mobile UI no longer stretches across desktop viewports.
 * BottomTabBar stays `fixed` but is constrained to the frame via CSS on md+.
 */
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="md:fixed md:inset-0 md:flex md:items-center md:justify-center md:bg-background">
      {/* `md:transform-gpu` creates a new containing block on desktop so that
          every `fixed inset-0` page container (Index, Watchlist, MyCinema, etc.)
          stays inside this 420px phone frame instead of spanning the viewport. */}
      <div className="md:relative md:transform-gpu md:w-[420px] md:h-[min(900px,calc(100dvh-2rem))] md:rounded-[2.25rem] md:overflow-hidden md:border md:border-border/20 md:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] md:bg-background">
        {children}
        <BottomTabBar />
      </div>
    </div>

  );
};

export default AppLayout;

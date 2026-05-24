import BottomTabBar from "@/components/pick/BottomTabBar";

/**
 * Mobile-first layout. On md+ we frame the app as a centered phone-shaped
 * surface so the mobile UI no longer stretches across desktop viewports.
 * BottomTabBar stays `fixed` but is constrained to the frame via CSS on md+.
 */
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="md:fixed md:inset-0 md:flex md:items-center md:justify-center md:bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%),radial-gradient(ellipse_at_bottom,hsl(var(--primary)/0.05),transparent_60%)] md:bg-background">
      <div className="md:relative md:w-[420px] md:h-[min(900px,calc(100dvh-2rem))] md:rounded-[2.25rem] md:overflow-hidden md:border md:border-border/20 md:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6),0_0_0_1px_hsl(var(--primary)/0.08)] md:bg-background">
        {children}
        <BottomTabBar />
      </div>
    </div>
  );
};

export default AppLayout;

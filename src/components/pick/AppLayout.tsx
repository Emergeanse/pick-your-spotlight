import BottomTabBar from "@/components/pick/BottomTabBar";

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      {children}
      <BottomTabBar />
    </>
  );
};

export default AppLayout;

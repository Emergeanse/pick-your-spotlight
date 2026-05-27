import { Library } from "lucide-react";

const MyCinema = () => {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4 pb-16">
      <Library className="w-10 h-10 text-foreground/10" />
      <p className="text-foreground/25 text-sm font-sans">Bientôt disponible</p>
    </div>
  );
};

export default MyCinema;

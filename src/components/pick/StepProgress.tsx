import { motion } from "framer-motion";

interface StepProgressProps {
  current: number;
  total: number;
}

const StepProgress = ({ current, total }: StepProgressProps) => {
  const progress = (current / total) * 100;

  return (
    <div className="absolute top-0 left-0 right-0 z-20 px-6 pt-5">
      <div className="max-w-md mx-auto">
        <div className="h-1 w-full rounded-full bg-muted/30 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              boxShadow: "0 0 12px hsl(var(--primary) / 0.6), 0 0 24px hsl(var(--primary) / 0.3)",
            }}
          />
        </div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-muted-foreground/40 text-xs font-sans mt-2 text-center"
        >
          Étape {current} sur {total}
        </motion.p>
      </div>
    </div>
  );
};

export default StepProgress;

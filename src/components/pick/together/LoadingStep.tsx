import { motion } from "framer-motion";
import PickCharacter from "@/components/pick/PickCharacter";
import type { Friend } from "./WhoStep";

interface LoadingStepProps {
  message: string;
  selectedFriends: Friend[];
}

const LoadingStep = ({ message, selectedFriends }: LoadingStepProps) => (
  <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className="h-full flex flex-col items-center justify-center px-6"
  >
    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}
      className="flex flex-col items-center text-center max-w-sm"
    >
      <PickCharacter mood="think" size="md" animate />
      <motion.p
        key={message}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-foreground/60 text-sm font-sans mt-6 italic"
      >
        {message}
      </motion.p>

      <div className="flex -space-x-3 mt-8">
        {[{ name: "Toi" }, ...selectedFriends].map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.15, type: "spring" }}
            className="w-10 h-10 rounded-full bg-card border-2 border-background flex items-center justify-center"
          >
            <span className="text-[10px] font-bold text-foreground/50">
              {"displayName" in p ? (p as Friend).displayName[0] : p.name[0]}
            </span>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: "100%" }}
        transition={{ duration: 8, ease: "linear" }}
        className="h-0.5 bg-primary/30 rounded-full mt-6 max-w-[200px]"
      />
    </motion.div>
  </motion.div>
);

export default LoadingStep;

import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PickCharacter from "@/components/pick/PickCharacter";

interface LandingStepProps {
  onCreateSoiree: () => void;
  creating: boolean;
}

const LandingStep = ({ onCreateSoiree, creating }: LandingStepProps) => (
  <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -40 }}
    className="h-full flex flex-col items-center justify-center px-6"
  >
    <PickCharacter mood="wave" size="md" animate />

    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="text-center mt-6 mb-10 max-w-sm"
    >
      <h1 className="text-3xl md:text-4xl font-serif mb-3">Together</h1>
      <p className="text-foreground/50 text-sm font-sans leading-relaxed">
        Trouvez le film parfait à plusieurs.<br />
        Amis, invités, QR code — tout le monde participe.
      </p>
    </motion.div>

    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="w-full max-w-sm"
    >
      <Button
        onClick={onCreateSoiree}
        disabled={creating}
        variant="hero"
        size="xl"
        className="w-full gap-2 font-sans text-base"
      >
        {creating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        Créer une soirée ciné
      </Button>
    </motion.div>
  </motion.div>
);

export default LandingStep;

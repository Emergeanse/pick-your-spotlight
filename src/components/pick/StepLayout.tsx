import { motion } from "framer-motion";
import StepProgress from "./StepProgress";

interface StepLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
}

const particles = [
  { x: "15%", y: "20%", size: 4, duration: 8, delay: 0 },
  { x: "80%", y: "35%", size: 3, duration: 10, delay: 2 },
  { x: "45%", y: "75%", size: 5, duration: 7, delay: 1 },
  { x: "70%", y: "85%", size: 3, duration: 9, delay: 3 },
];

const StepLayout = ({ children, currentStep, totalSteps }: StepLayoutProps) => {
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Ambient gradient background */}
      <div className="absolute inset-0">
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 40%, hsl(var(--primary) / 0.08) 0%, transparent 70%)",
          }}
        />
        <motion.div
          className="absolute inset-0"
          animate={{ opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          style={{
            background:
              "radial-gradient(ellipse 40% 40% at 70% 60%, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Floating particles */}
      {particles.map((p, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-primary/20"
          style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
          animate={{
            y: [-10, 10, -10],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: p.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
        />
      ))}

      <StepProgress current={currentStep} total={totalSteps} />

      <div className="relative z-10 h-full pt-12 md:pt-14 overflow-y-auto">{children}</div>
    </div>
  );
};

export default StepLayout;

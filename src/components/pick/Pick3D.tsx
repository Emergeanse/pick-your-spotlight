import { createElement, useEffect } from "react";
import { cn } from "@/lib/utils";

interface Pick3DProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  animate?: boolean;
}

const SIZE_MAP = {
  sm: "w-24 h-24",
  md: "w-40 h-40",
  lg: "w-56 h-56",
};

const Pick3D = ({ size = "md", className = "", animate = true }: Pick3DProps) => {
  useEffect(() => {
    void import("@google/model-viewer");
  }, []);

  return (
    <div className={cn("relative overflow-hidden", SIZE_MAP[size], className)}>
      {createElement("model-viewer", {
        src: "/models/pick-character.glb",
        alt: "Pick en 3D",
        style: { width: "100%", height: "100%", backgroundColor: "transparent" },
        "camera-controls": true,
        "interaction-prompt": "none",
        "shadow-intensity": "0.6",
        "exposure": "1",
        "auto-rotate": animate,
        "auto-rotate-delay": "0",
        "rotation-per-second": "18deg",
        "disable-pan": true,
      })}
    </div>
  );
};

export default Pick3D;

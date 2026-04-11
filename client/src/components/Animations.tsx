import { motion, type Variants } from "framer-motion";
import React, { type ReactNode } from "react";
import CountUp from "react-countup";

// ========== Page Transition ==========
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

// ========== Fade In ==========
export function FadeIn({
  children,
  delay = 0,
  duration = 0.6,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ========== Stagger Container + Item ==========
const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

const staggerItem: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

export function StaggerList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={staggerItem} className={className}>
      {children}
    </motion.div>
  );
}

// ========== Animated Card with Lift Effect ==========
export function AnimatedCard({
  children,
  className = "",
  onClick,
  style,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      whileHover={{
        y: -2,
        boxShadow:
          "0 8px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -5px rgba(0,0,0,0.05)",
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={className}
      onClick={onClick}
      style={style}
    >
      {children}
    </motion.div>
  );
}

// ========== Scale In (para modais, popups) ==========
export function ScaleIn({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ========== Animated Counter (números que contam de 0 até valor) ==========
export function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  className = "",
  duration = 1.2,
  decimals,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
  decimals?: number;
}) {
  const isMonetary = prefix.includes("R$") || prefix.includes("$");
  const decimalPlaces = decimals ?? (isMonetary ? 2 : 0);

  return (
    <span className={className}>
      {prefix && !isMonetary && prefix}
      <CountUp
        end={value}
        duration={duration}
        decimals={decimalPlaces}
        decimal=","
        separator="."
        prefix={isMonetary ? prefix : ""}
        suffix={suffix}
        preserveValue
        useEasing
      />
      {!isMonetary && suffix}
    </span>
  );
}

// ========== Shimmer Text (para o logo) ==========
export function ShimmerText({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.span
      className={`relative inline-block ${className}`}
      style={{
        backgroundImage:
          "linear-gradient(90deg, currentColor 0%, #f0c060 25%, #ffd700 50%, #f0c060 75%, currentColor 100%)",
        backgroundSize: "200% 100%",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}
      animate={{
        backgroundPosition: ["200% 0%", "-200% 0%"],
      }}
      transition={{
        duration: 4,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {children}
    </motion.span>
  );
}

// ========== Pulse Star (estrela animada do logo) ==========
export function PulseStar({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={className}
      animate={{
        rotate: [0, 5, -5, 0],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </motion.div>
  );
}

// ========== Skeleton Loading (substitui "Carregando..." e "...") ==========
export function SkeletonPulse({
  className = "",
  width,
  height = "1.2em",
}: {
  className?: string;
  width?: string;
  height?: string;
}) {
  return (
    <span
      className={`inline-block animate-pulse rounded-md bg-[var(--secondary)] ${className}`}
      style={{ width: width ?? "100%", height, verticalAlign: "middle" }}
    />
  );
}

// ========== Skeleton Card (para cards inteiros) ==========
export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-2xl p-4 shadow-xl border border-[var(--border)] bg-[var(--card)] animate-pulse ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--secondary)]" />
        <div className="h-3 w-20 rounded bg-[var(--secondary)]" />
      </div>
      <div className="h-6 w-24 rounded bg-[var(--secondary)]" />
    </div>
  );
}

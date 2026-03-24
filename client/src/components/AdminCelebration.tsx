import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Configuração ─────────────────────────────────────────────────────────────
const TOTAL_STARS = 80;
const TOTAL_SPARKLES = 40;
const TOTAL_CONFETTI = 60;
const FIREWORK_COLORS = [
  "#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE",
  "#FF69B4", "#00CED1", "#FF4500", "#7B68EE", "#00FA9A",
];

function randomBetween(a: number, b: number) {
  return Math.random() * (b - a) + a;
}

// ─── Estrela animada ──────────────────────────────────────────────────────────
function Star({ delay, index }: { delay: number; index: number }) {
  const size = randomBetween(4, 16);
  const x = randomBetween(0, 100);
  const y = randomBetween(0, 100);
  const color = FIREWORK_COLORS[index % FIREWORK_COLORS.length];
  const duration = randomBetween(0.5, 1.5);

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
      }}
      initial={{ opacity: 0, scale: 0, rotate: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0, 1.5, 1, 0],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        repeatDelay: randomBetween(0.5, 3),
      }}
    >
      <svg viewBox="0 0 24 24" fill={color}>
        <polygon points="12,0 15,9 24,9 17,14.5 19.5,24 12,18 4.5,24 7,14.5 0,9 9,9" />
      </svg>
    </motion.div>
  );
}

// ─── Sparkle (brilho circular) ────────────────────────────────────────────────
function Sparkle({ delay, index }: { delay: number; index: number }) {
  const size = randomBetween(3, 8);
  const x = randomBetween(5, 95);
  const y = randomBetween(5, 95);
  const color = FIREWORK_COLORS[(index * 3) % FIREWORK_COLORS.length];

  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        background: color,
        boxShadow: `0 0 ${size * 3}px ${color}, 0 0 ${size * 6}px ${color}`,
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 0],
        scale: [0, 2, 0],
      }}
      transition={{
        duration: randomBetween(0.8, 2),
        delay,
        repeat: Infinity,
        repeatDelay: randomBetween(1, 4),
      }}
    />
  );
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function Confetti({ delay, index }: { delay: number; index: number }) {
  const x = randomBetween(0, 100);
  const color = FIREWORK_COLORS[index % FIREWORK_COLORS.length];
  const w = randomBetween(6, 14);
  const h = randomBetween(4, 10);

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${x}%`,
        top: "-5%",
        width: w,
        height: h,
        background: color,
        borderRadius: randomBetween(0, 1) > 0.5 ? "50%" : "2px",
      }}
      initial={{ y: 0, opacity: 1, rotate: 0 }}
      animate={{
        y: ["0vh", "110vh"],
        opacity: [1, 1, 0.5],
        rotate: [0, randomBetween(-720, 720)],
        x: [0, randomBetween(-100, 100)],
      }}
      transition={{
        duration: randomBetween(3, 6),
        delay,
        repeat: Infinity,
        ease: "linear",
      }}
    />
  );
}

// ─── Firework burst ───────────────────────────────────────────────────────────
function FireworkBurst({ x, y, delay }: { x: number; y: number; delay: number }) {
  const particles = 12;
  const color = FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];

  return (
    <>
      {Array.from({ length: particles }).map((_, i) => {
        const angle = (360 / particles) * i;
        const distance = randomBetween(60, 150);
        const rad = (angle * Math.PI) / 180;
        const dx = Math.cos(rad) * distance;
        const dy = Math.sin(rad) * distance;

        return (
          <motion.div
            key={i}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: 6,
              height: 6,
              background: color,
              boxShadow: `0 0 10px ${color}, 0 0 20px ${color}`,
            }}
            initial={{ opacity: 0, scale: 0, x: 0, y: 0 }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, 1.5, 0.5, 0],
              x: [0, dx],
              y: [0, dy],
            }}
            transition={{
              duration: 1.5,
              delay: delay,
              repeat: Infinity,
              repeatDelay: randomBetween(3, 6),
            }}
          />
        );
      })}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function AdminCelebration() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Verificar se já foi mostrado nesta sessão
    const shown = sessionStorage.getItem("admin-celebration-shown");
    if (!shown) {
      setVisible(true);
      sessionStorage.setItem("admin-celebration-shown", "1");
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    setTimeout(() => setVisible(false), 800);
  }, []);

  // Auto-dismiss após 15 segundos
  useEffect(() => {
    if (visible && !dismissed) {
      const timer = setTimeout(dismiss, 15000);
      return () => clearTimeout(timer);
    }
  }, [visible, dismissed, dismiss]);

  if (!visible) return null;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
          onClick={dismiss}
          style={{ cursor: "pointer" }}
        >
          {/* Backdrop escuro */}
          <motion.div
            className="absolute inset-0"
            style={{
              background: "radial-gradient(ellipse at center, rgba(10,5,30,0.92) 0%, rgba(0,0,0,0.97) 100%)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Estrelas */}
          {Array.from({ length: TOTAL_STARS }).map((_, i) => (
            <Star key={`star-${i}`} delay={randomBetween(0, 2)} index={i} />
          ))}

          {/* Sparkles */}
          {Array.from({ length: TOTAL_SPARKLES }).map((_, i) => (
            <Sparkle key={`sparkle-${i}`} delay={randomBetween(0, 3)} index={i} />
          ))}

          {/* Confetti caindo */}
          {Array.from({ length: TOTAL_CONFETTI }).map((_, i) => (
            <Confetti key={`confetti-${i}`} delay={randomBetween(0, 4)} index={i} />
          ))}

          {/* Firework bursts */}
          <FireworkBurst x={15} y={20} delay={0.5} />
          <FireworkBurst x={85} y={15} delay={1.2} />
          <FireworkBurst x={50} y={10} delay={2.0} />
          <FireworkBurst x={25} y={75} delay={2.8} />
          <FireworkBurst x={75} y={80} delay={3.5} />
          <FireworkBurst x={10} y={50} delay={4.0} />
          <FireworkBurst x={90} y={45} delay={4.5} />

          {/* Texto principal */}
          <div className="relative z-10 text-center px-6 max-w-2xl">
            {/* Emoji gigante animado */}
            <motion.div
              className="text-7xl md:text-8xl mb-6"
              animate={{
                scale: [1, 1.2, 1],
                rotate: [0, -10, 10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              🎉
            </motion.div>

            {/* Título principal */}
            <motion.h1
              className="text-4xl md:text-6xl font-black mb-6 leading-tight"
              style={{
                fontFamily: "'Playfair Display', serif",
                background: "linear-gradient(135deg, #FFD700 0%, #FF6B6B 25%, #4ECDC4 50%, #45B7D1 75%, #FFD700 100%)",
                backgroundSize: "300% 300%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 30px rgba(255,215,0,0.5))",
              }}
              animate={{
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "linear",
              }}
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
            >
              TÁ TUDO PRONTO PAPIS!
            </motion.h1>

            {/* Subtítulo */}
            <motion.p
              className="text-xl md:text-2xl font-bold text-white mb-4"
              style={{
                textShadow: "0 0 20px rgba(255,215,0,0.6), 0 0 40px rgba(255,107,107,0.4)",
              }}
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
            >
              O SITE ESTÁ FUNCIONANDO, PARABÉNS!
            </motion.p>

            {/* Frase final */}
            <motion.p
              className="text-2xl md:text-3xl font-black mb-8"
              style={{
                background: "linear-gradient(90deg, #FF6B6B, #FFD700, #4ECDC4, #FF69B4)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 20px rgba(255,107,107,0.5))",
              }}
              animate={{
                backgroundPosition: ["200% 0%", "-200% 0%"],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "linear",
              }}
              initial={{ y: 30, opacity: 0, scale: 0.8 }}
              whileInView={{ y: 0, opacity: 1, scale: 1 }}
            >
              AGORA É COM VOCÊ!
            </motion.p>

            <motion.p
              className="text-lg md:text-xl font-bold italic"
              style={{
                color: "#FF69B4",
                textShadow: "0 0 15px rgba(255,105,180,0.6)",
              }}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            >
              ESSA PICA NÃO É MAIS MINHA! 🔥
            </motion.p>

            {/* Emojis flutuantes */}
            <div className="flex justify-center gap-4 mt-6">
              {["🚀", "⭐", "💎", "🏆", "🎆", "✨", "🎊"].map((emoji, i) => (
                <motion.span
                  key={i}
                  className="text-3xl md:text-4xl"
                  animate={{
                    y: [0, -20, 0],
                    rotate: [0, 15, -15, 0],
                  }}
                  transition={{
                    duration: 2,
                    delay: i * 0.2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  {emoji}
                </motion.span>
              ))}
            </div>

            {/* Instrução para fechar */}
            <motion.p
              className="text-xs text-white/40 mt-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3 }}
            >
              clique em qualquer lugar para fechar
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

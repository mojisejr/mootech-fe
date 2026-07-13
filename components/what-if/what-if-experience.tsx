import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  WHATIF_CARD_FILENAME,
  WHATIF_SHARE_URL,
  WhatIfGender,
  WhatIfResponse,
  clearWhatIfPlayedState,
  getWhatIfCardBlob,
  hasWhatIfPlayedCookie,
  loadWhatIfResult,
  markWhatIfPlayed,
  saveWhatIfCardBlob,
  saveWhatIfResult,
} from "@/lib/what-if/storage";

type Stage = "portal" | "loading" | "result" | "reality";
type RitualState = "active" | "complete";
type RitualPortionKey = "coordinate" | "identity" | "seal";
type PortalCanvasMode = "intro" | "filling" | "ready";
type PortalCanvasPhase = "intro" | "title" | "travel" | "hold" | "ready";
type PortalParticle = {
  x: number;
  y: number;
  z: number;
  size: number;
  speed: number;
  drift: number;
  tint: "gold" | "teal" | "violet";
};
type PortalCloud = {
  x: number;
  y: number;
  z: number;
  radius: number;
  speed: number;
  tint: "gold" | "teal" | "violet";
  phase: number;
};

const API_URL = process.env.NEXT_PUBLIC_WHATIF_API_URL || "/api/what-if/generate";
const MUMATE_APP_URL = "/";
const MIN_LOADING_MS = 4200;

const THAI_MONTHS = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const JOB_SUGGESTIONS = [
  "พนักงานบัญชี",
  "วิศวกร",
  "ครู/อาจารย์",
  "พยาบาล",
  "ฟรีแลนซ์",
  "นักการตลาด",
  "โปรแกรมเมอร์",
  "ข้าราชการ",
  "พนักงานขาย",
  "เจ้าของธุรกิจ",
  "กราฟิกดีไซเนอร์",
  "พนักงานธนาคาร",
];

const LOADING_MESSAGES = [
  "กำลังสแกนเส้นทางชีวิต...",
  "ค้นหาอาชีพที่ซ่อนอยู่ในดวงชะตาของคุณ...",
  "กำลังเชื่อมต่อกับจักรวาลคู่ขนาน...",
  "สร้างภาพตัวตนของคุณในอีกมิติ...",
];

const ELEMENT_EMOJI: Record<string, string> = {
  ไม้: "🌳",
  ไฟ: "🔥",
  ดิน: "⛰️",
  ทอง: "✨",
  น้ำ: "🌊",
};

const RITUAL_PORTION_VARIANTS = {
  hidden: {
    opacity: 0,
    x: 34,
    y: 54,
    z: -760,
    scale: 0.5,
    rotateX: -10,
    rotateY: 7,
    filter: "blur(5px)",
  },
  active: {
    opacity: 1,
    x: 0,
    y: 0,
    z: 0,
    scale: 1,
    rotateX: 0,
    rotateY: 0,
    filter: "blur(0px)",
  },
  complete: {
    opacity: 0.86,
    y: -6,
    scale: 0.985,
    rotateX: 1.5,
  },
  exit: {
    opacity: 0,
    x: -48,
    y: -28,
    z: 610,
    scale: 1.58,
    rotateX: 8,
    rotateY: -9,
    filter: "blur(8px)",
  },
};

const PORTAL_STAGE_VARIANTS = {
  hidden: { opacity: 0, y: 28, scale: 0.975 },
  show: { opacity: 1, y: 0, scale: 1 },
};

const RITUAL_STACK_VARIANTS = {
  active: { opacity: 1, y: 0, scale: 1 },
  locked: { opacity: 0, y: -34, scale: 0.94 },
};

const PORTAL_CANVAS_TINTS: Record<PortalParticle["tint"], string> = {
  gold: "255, 209, 102",
  teal: "27, 154, 175",
  violet: "180, 107, 255",
};
const PORTAL_BLACKOUT_END = 0.18;
const PORTAL_INTRO_MS = 1780;
const SPLASH_HIDE_MS = 1280;
const SPLASH_PORTAL_START_MS = 1500;
const TITLE_CHECKPOINT_MS = 3950;
const TITLE_CHECKPOINT_REDUCED_MS = 1150;
const CHECKPOINT_TRAVEL_MS = 1320;
const CTA_FOCUS_DELAY_MS = 620;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const x = clamp01((value - edge0) / (edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function mix(from: number, to: number, amount: number) {
  return from + (to - from) * amount;
}

function storyChapters(result: WhatIfResponse) {
  return [
    { key: "shift", no: 1, title: "จุดเปลี่ยน", text: result.story.shift },
    { key: "peak", no: 2, title: "จุดพีค", text: result.story.peak },
    { key: "future", no: 3, title: "อีก 10 ปีข้างหน้า", text: result.story.future },
  ].filter((chapter) => chapter.text);
}

function RitualPortion({
  children,
  innerRef,
  isFocused = false,
  state,
  step,
  title,
  className = "",
}: {
  children: ReactNode;
  innerRef?: React.RefObject<HTMLDivElement>;
  isFocused?: boolean;
  state: RitualState;
  step: string;
  title: string;
  className?: string;
}) {
  return (
    <motion.div
      ref={innerRef}
      layout
      className={`whatif__portion whatif__portion--${state} ${isFocused ? "is-focused" : ""} ${className}`}
      variants={RITUAL_PORTION_VARIANTS}
      initial="hidden"
      animate={state}
      exit="exit"
      transition={{ type: "spring", stiffness: 92, damping: 19, mass: 1.18 }}
    >
      <div className="whatif__portion-header" aria-hidden="true">
        <span className="whatif__portion-step">{step}</span>
        <span className="whatif__portion-title">{title}</span>
      </div>
      <div className="whatif__portion-rift" aria-hidden="true" />
      <div className="whatif__portion-fields">{children}</div>
    </motion.div>
  );
}

function WhatIfPortalCanvas({ active, mode, phase }: { active: boolean; mode: PortalCanvasMode; phase: PortalCanvasPhase }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activeRef = useRef(active);
  const modeRef = useRef(mode);
  const phaseRef = useRef(phase);
  const phaseStartedAtRef = useRef(0);
  const particlesRef = useRef<PortalParticle[]>([]);
  const cloudsRef = useRef<PortalCloud[]>([]);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    phaseRef.current = phase;
    phaseStartedAtRef.current = performance.now();
  }, [phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const canvasElement = canvas;
    const context = ctx;

    let raf = 0;
    let startedAt: number | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;

    function resetParticle(index: number, count: number): PortalParticle {
      const angle = (index / count) * Math.PI * 2 + Math.random() * 0.9;
      const edgeBias = 0.56 + Math.random() * 0.48;
      return {
        x: Math.cos(angle) * edgeBias,
        y: Math.sin(angle) * edgeBias * 0.82 + (Math.random() - 0.5) * 0.18,
        z: 0.55 + Math.random() * 0.72,
        size: 0.7 + Math.random() * 2.5,
        speed: 0.34 + Math.random() * 0.78,
        drift: (Math.random() - 0.5) * 0.18,
        tint: index % 7 === 0 ? "teal" : index % 3 === 0 ? "violet" : "gold",
      };
    }

    function buildWorld() {
      const particleCount = Math.min(104, Math.max(56, Math.round((width * height) / 11000)));
      particlesRef.current = Array.from({ length: particleCount }, (_, index) => resetParticle(index, particleCount));
      cloudsRef.current = Array.from({ length: 9 }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        return {
          x: side * (0.46 + Math.random() * 0.46),
          y: -0.64 + index * 0.16 + (Math.random() - 0.5) * 0.16,
          z: 0.2 + Math.random() * 0.9,
          radius: 0.18 + Math.random() * 0.22,
          speed: 0.04 + Math.random() * 0.08,
          tint: index % 5 === 0 ? "teal" : index % 3 === 0 ? "gold" : "violet",
          phase: Math.random() * Math.PI * 2,
        };
      });
    }

    function resize() {
      const ctx = context;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(1.75, Math.max(1, window.devicePixelRatio || 1));
      canvasElement.width = Math.round(width * dpr);
      canvasElement.height = Math.round(height * dpr);
      canvasElement.style.width = `${width}px`;
      canvasElement.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildWorld();
    }

    function fillRadial(
      x: number,
      y: number,
      radius: number,
      stops: Array<[number, string]>,
      scaleY = 1,
      rotation = 0,
    ) {
      const ctx = context;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(1, scaleY);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      for (const [stop, color] of stops) {
        gradient.addColorStop(stop, color);
      }
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawBase(t: number, ready: boolean, filling: boolean, intro: number) {
      const ctx = context;
      const cx = width / 2;
      const cy = height / 2;
      const maxRadius = Math.max(width, height);

      const base = ctx.createLinearGradient(0, 0, width, height);
      base.addColorStop(0, "#05020f");
      base.addColorStop(0.42, ready ? "#150934" : "#0c0524");
      base.addColorStop(1, "#05020f");
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, width, height);

      const ambient = ctx.createRadialGradient(cx, cy, maxRadius * 0.08, cx, cy, maxRadius * 0.78);
      ambient.addColorStop(0, ready ? "rgba(255, 209, 102, 0.12)" : "rgba(124, 58, 237, 0.09)");
      ambient.addColorStop(0.38, filling ? "rgba(27, 154, 175, 0.08)" : "rgba(180, 107, 255, 0.08)");
      ambient.addColorStop(1, "rgba(5, 2, 15, 0)");
      ctx.fillStyle = ambient;
      ctx.fillRect(0, 0, width, height);

      const breathe = shouldReduceMotion ? 0 : Math.sin(t * 0.28) * 0.04;
      fillRadial(
        cx,
        cy,
        maxRadius * (0.46 + breathe),
        [
          [0, ready ? "rgba(255, 209, 102, 0.1)" : "rgba(244, 236, 255, 0.035)"],
          [0.42, "rgba(27, 154, 175, 0.045)"],
          [1, "rgba(11, 7, 35, 0)"],
        ],
        0.72,
      );

      if (intro < 0.86) {
        ctx.fillStyle = `rgba(2, 1, 6, ${1 - smoothstep(0.08, 0.72, intro)})`;
        ctx.fillRect(0, 0, width, height);
      }
    }

    function drawClouds(t: number, velocity: number, centerCalm: number, ready: boolean, reveal: number, impulse: number) {
      if (reveal <= 0.01) return;
      const ctx = context;
      const cx = width / 2;
      const cy = height / 2;
      const scaleBase = Math.max(width, height);

      ctx.globalCompositeOperation = "lighter";
      cloudsRef.current.forEach((cloud, index) => {
        if (!shouldReduceMotion) {
          cloud.z -= cloud.speed * velocity * 0.0022;
          cloud.y += Math.sin(t * 0.18 + cloud.phase) * 0.0008;
          cloud.x += Math.cos(t * 0.11 + cloud.phase) * 0.0007;
          if (cloud.z < 0.06) {
            cloud.z = 1.12;
            cloud.x = (index % 2 === 0 ? -1 : 1) * (0.48 + Math.random() * 0.44);
            cloud.y = -0.58 + Math.random() * 1.16;
          }
        }

        const perspective = 1 / (0.42 + cloud.z * 0.92);
        const x = cx + cloud.x * width * 0.56 * perspective;
        const y = cy + cloud.y * height * 0.52 * perspective;
        const radius = scaleBase * cloud.radius * perspective;
        const dx = (x - cx) / (width / 2);
        const dy = (y - cy) / (height / 2);
        const centerDistance = Math.sqrt(dx * dx + dy * dy);
        const edgeAlpha = smoothstep(centerCalm, 0.95, centerDistance);
        const tint = PORTAL_CANVAS_TINTS[cloud.tint];
        const alpha = (ready ? 0.2 : 0.16) * edgeAlpha * (1.1 - cloud.z * 0.34) * reveal * (1 + impulse * 0.28);

        fillRadial(
          x,
          y,
          radius,
          [
            [0, `rgba(${tint}, ${alpha})`],
            [0.48, `rgba(${tint}, ${alpha * 0.34})`],
            [1, `rgba(${tint}, 0)`],
          ],
          0.58 + Math.sin(cloud.phase) * 0.14,
          cloud.phase,
        );
      });
      ctx.globalCompositeOperation = "source-over";
    }

    function drawParticles(t: number, velocity: number, centerCalm: number, ready: boolean, reveal: number, impulse: number) {
      if (reveal <= 0.01) return;
      const ctx = context;
      const cx = width / 2;
      const cy = height / 2;

      ctx.globalCompositeOperation = "lighter";
      particlesRef.current.forEach((particle, index) => {
        if (!shouldReduceMotion) {
          particle.z -= particle.speed * velocity * 0.0048;
          particle.x += Math.sin(t * 0.23 + index) * particle.drift * 0.002;
          particle.y += Math.cos(t * 0.2 + index) * particle.drift * 0.0016;
          if (particle.z < 0.08) {
            particlesRef.current[index] = resetParticle(index, particlesRef.current.length);
            return;
          }
        }

        const perspective = 1 / (0.2 + particle.z * 1.18);
        const x = cx + particle.x * width * 0.5 * perspective;
        const y = cy + particle.y * height * 0.5 * perspective;
        const dx = (x - cx) / (width / 2);
        const dy = (y - cy) / (height / 2);
        const centerDistance = Math.sqrt(dx * dx + dy * dy);
        const edgeAlpha = smoothstep(centerCalm, 1.05, centerDistance);
        if (edgeAlpha <= 0.02) return;

        const depth = 1 - particle.z;
        const tint = PORTAL_CANVAS_TINTS[particle.tint];
        const size = particle.size * (0.7 + depth * 2.2) * (ready ? 1.08 : 1) * (1 + impulse * 0.16);
        const alpha = Math.min(0.88, (0.18 + depth * 0.52) * edgeAlpha * (1 + impulse * 0.4)) * reveal;

        fillRadial(
          x,
          y,
          size * 4.2,
          [
            [0, `rgba(${tint}, ${alpha})`],
            [0.36, `rgba(${tint}, ${alpha * 0.34})`],
            [1, `rgba(${tint}, 0)`],
          ],
          1,
        );
      });
      ctx.globalCompositeOperation = "source-over";
    }

    function draw(time: number) {
      const ctx = context;
      if (!activeRef.current && !shouldReduceMotion) {
        startedAt = null;
        ctx.fillStyle = "#020106";
        ctx.fillRect(0, 0, width, height);
        raf = window.requestAnimationFrame(draw);
        return;
      }
      if (startedAt === null) startedAt = time;
      const elapsed = shouldReduceMotion ? 0 : (time - startedAt) / 1000;
      const t = shouldReduceMotion ? 0 : elapsed;
      const modeNow = modeRef.current;
      const phaseNow = phaseRef.current;
      const ready = modeNow === "ready";
      const filling = modeNow === "filling";
      const phaseElapsed = shouldReduceMotion ? 2 : Math.max(0, (time - phaseStartedAtRef.current) / 1000);
      const intro = shouldReduceMotion ? 1 : clamp01(t / 2.2);
      const reveal = shouldReduceMotion ? 1 : smoothstep(0.3, 0.74, intro);
      const pull = smoothstep(0.38, 0.68, intro) * (1 - smoothstep(0.78, 1, intro));
      const settle = smoothstep(0.72, 1, intro);
      const transitionImpulse = phaseNow === "travel" ? 1 - smoothstep(0.28, 1.42, phaseElapsed) : 0;
      const titleIn = phaseNow === "title" ? 1 - smoothstep(0.72, 1.42, phaseElapsed) : 0;
      const titleOut = phaseNow === "title" ? smoothstep(2.7, 3.68, phaseElapsed) : 0;
      const titleImpulse = Math.max(titleIn, titleOut);
      const impulse = shouldReduceMotion ? 0 : Math.max(transitionImpulse, titleImpulse);
      const focusCalm = filling ? 0.42 : ready ? 0.34 : 0.38;
      const holdCalm = phaseNow === "hold" || phaseNow === "ready" ? focusCalm + 0.04 : focusCalm;
      const centerCalm = mix(0.16, holdCalm, settle) - impulse * 0.04;
      const velocity = shouldReduceMotion
        ? 0
        : mix(0.56, filling ? 0.24 : 0.32, settle) + pull * 3.4 + (ready ? 0.18 : 0) + impulse * 2.35;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";
      if (!shouldReduceMotion && intro < PORTAL_BLACKOUT_END) {
        ctx.fillStyle = "#020106";
        ctx.fillRect(0, 0, width, height);
        raf = window.requestAnimationFrame(draw);
        return;
      }
      drawBase(t, ready, filling, intro);
      drawClouds(t, velocity, centerCalm, ready, reveal, impulse);
      drawParticles(t, velocity, centerCalm, ready, reveal, impulse);

      ctx.globalCompositeOperation = "source-over";
      raf = window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [shouldReduceMotion]);

  return <canvas ref={canvasRef} className="whatif__portal-canvas" aria-hidden="true" />;
}

export default function WhatIfExperience() {
  const [stage, setStage] = useState<Stage>("portal");
  const shouldReduceMotion = useReducedMotion();
  const [splashVisible, setSplashVisible] = useState(true);
  const [portalIntroStarted, setPortalIntroStarted] = useState(false);
  const [portalIntroSettled, setPortalIntroSettled] = useState(false);
  const [titleCheckpointDone, setTitleCheckpointDone] = useState(false);
  const [checkpointPhase, setCheckpointPhase] = useState<"travel" | "hold">("travel");
  const [birthDay, setBirthDay] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYearBe, setBirthYearBe] = useState("");
  const [birthTime, setBirthTime] = useState("12:00");
  const [birthTimeTouched, setBirthTimeTouched] = useState(false);
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [gender, setGender] = useState<WhatIfGender | "">("");
  const [focusedPortion, setFocusedPortion] = useState<RitualPortionKey | null>(null);
  const [currentJob, setCurrentJob] = useState("");
  const [withImage, setWithImage] = useState(true);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<WhatIfResponse | null>(null);
  const [savedMode, setSavedMode] = useState(false);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [slideIdx, setSlideIdx] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const cardBlobRef = useRef<Blob | null>(null);
  const coordinateRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);
  const portalLockRef = useRef<HTMLDivElement>(null);
  const portalButtonRef = useRef<HTMLButtonElement>(null);
  const jobInputRef = useRef<HTMLInputElement>(null);

  const yearOptions = useMemo(() => {
    const nowBe = new Date().getFullYear() + 543;
    const years: number[] = [];
    for (let y = nowBe - 15; y >= nowBe - 80; y -= 1) years.push(y);
    return years;
  }, []);

  const birthDateCe = useMemo(() => {
    if (!birthDay || !birthMonth || !birthYearBe) return null;
    const y = Number(birthYearBe) - 543;
    const m = Number(birthMonth);
    const d = Number(birthDay);
    const probe = new Date(Date.UTC(y, m - 1, d));
    if (probe.getUTCFullYear() !== y || probe.getUTCMonth() !== m - 1 || probe.getUTCDate() !== d) {
      return null;
    }
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }, [birthDay, birthMonth, birthYearBe]);

  const coordinateComplete = Boolean(birthDateCe) && (timeUnknown || birthTimeTouched);
  const identityComplete = Boolean(gender) && currentJob.trim().length >= 2;
  const formReady = coordinateComplete && Boolean(gender) && currentJob.trim().length >= 2 && consent;
  const portalCheckpointReady = titleCheckpointDone || formReady;
  const canvasMode: PortalCanvasMode = formReady ? "ready" : coordinateComplete ? "filling" : "intro";
  const activeCheckpoint: RitualPortionKey | "cta" = formReady
    ? "cta"
    : !coordinateComplete
      ? "coordinate"
      : !identityComplete
        ? "identity"
        : "seal";
  const canvasPhase: PortalCanvasPhase = !portalIntroStarted
    ? "intro"
    : !portalIntroSettled
      ? "intro"
      : !portalCheckpointReady
        ? "title"
        : formReady
          ? checkpointPhase === "travel" ? "travel" : "ready"
          : checkpointPhase;
  const chapters = result ? storyChapters(result) : [];

  function guideTo(element: HTMLElement | null, focusTarget?: HTMLElement | null) {
    if (!element || stage !== "portal") return;
    const rect = element.getBoundingClientRect();
    const inView = rect.top >= 96 && rect.bottom <= window.innerHeight - 96;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!inView) {
      element.scrollIntoView({ block: "center", behavior: prefersReduced ? "auto" : "smooth" });
    }
    if (!focusTarget) return;
    window.setTimeout(() => {
      const active = document.activeElement;
      const userIsTyping = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
      if (!userIsTyping) focusTarget.focus({ preventScroll: true });
    }, prefersReduced ? 0 : 420);
  }

  function markFocus(portion: RitualPortionKey) {
    setFocusedPortion(portion);
  }

  function clearFocus() {
    setFocusedPortion(null);
  }

  useEffect(() => {
    const stored = loadWhatIfResult();
    if (!stored) return;
    setSplashVisible(false);
    setPortalIntroStarted(true);
    setResult(stored);
    setSavedMode(hasWhatIfPlayedCookie());
    setStage("result");
    void getWhatIfCardBlob().then((blob) => {
      if (!blob) return;
      cardBlobRef.current = blob;
      setCardUrl(URL.createObjectURL(blob));
    });
  }, []);

  useEffect(() => {
    if (stage !== "portal") {
      setSplashVisible(false);
      setPortalIntroStarted(true);
      return;
    }
    setSplashVisible(true);
    setPortalIntroStarted(false);
    const hideTimer = window.setTimeout(() => setSplashVisible(false), shouldReduceMotion ? 720 : SPLASH_HIDE_MS);
    const startTimer = window.setTimeout(() => setPortalIntroStarted(true), shouldReduceMotion ? 780 : SPLASH_PORTAL_START_MS);
    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(startTimer);
    };
  }, [stage, shouldReduceMotion]);

  useEffect(() => {
    if (stage !== "loading") return;
    const timer = window.setInterval(
      () => setLoadingMsgIdx((idx) => (idx + 1) % LOADING_MESSAGES.length),
      1900,
    );
    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    if (stage === "result" || stage === "reality") window.scrollTo({ top: 0, behavior: "auto" });
  }, [stage]);

  useEffect(() => {
    if (stage !== "portal" || shouldReduceMotion) {
      setPortalIntroSettled(true);
      return;
    }
    if (!portalIntroStarted) {
      setPortalIntroSettled(false);
      return;
    }
    setPortalIntroSettled(false);
    const timer = window.setTimeout(() => setPortalIntroSettled(true), PORTAL_INTRO_MS);
    return () => window.clearTimeout(timer);
  }, [stage, shouldReduceMotion, portalIntroStarted]);

  useEffect(() => {
    if (stage !== "portal") {
      setTitleCheckpointDone(true);
      return;
    }
    if (formReady) {
      setTitleCheckpointDone(true);
      return;
    }
    if (!portalIntroSettled) {
      setTitleCheckpointDone(false);
      return;
    }
    setTitleCheckpointDone(false);
    const timer = window.setTimeout(
      () => setTitleCheckpointDone(true),
      shouldReduceMotion ? TITLE_CHECKPOINT_REDUCED_MS : TITLE_CHECKPOINT_MS,
    );
    return () => window.clearTimeout(timer);
  }, [stage, portalIntroSettled, shouldReduceMotion, formReady]);

  useEffect(() => {
    if (stage !== "portal" || !portalCheckpointReady) {
      setCheckpointPhase("travel");
      return;
    }
    setCheckpointPhase("travel");
    const timer = window.setTimeout(() => setCheckpointPhase("hold"), shouldReduceMotion ? 0 : CHECKPOINT_TRAVEL_MS);
    return () => window.clearTimeout(timer);
  }, [activeCheckpoint, portalCheckpointReady, shouldReduceMotion, stage]);

  useEffect(() => {
    if (!coordinateComplete || identityComplete) return;
    guideTo(identityRef.current);
  }, [coordinateComplete, identityComplete]);

  useEffect(() => {
    if (!gender || currentJob.trim().length >= 2) return;
    guideTo(identityRef.current, jobInputRef.current);
  }, [gender, currentJob]);

  useEffect(() => {
    if (!identityComplete || formReady) return;
    guideTo(sealRef.current);
  }, [identityComplete, formReady]);

  useEffect(() => {
    if (!formReady || stage !== "portal") return;
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => {
      portalLockRef.current?.scrollIntoView({ block: "center", behavior: prefersReduced ? "auto" : "smooth" });
      portalButtonRef.current?.focus({ preventScroll: true });
    }, prefersReduced ? 0 : CTA_FOCUS_DELAY_MS);
  }, [formReady, stage]);

  useEffect(() => {
    if (!result) return;
    let cancelled = false;
    void buildShareCard(result)
      .then(async (blob) => {
        if (cancelled) return;
        cardBlobRef.current = blob;
        await saveWhatIfCardBlob(blob);
        setCardUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [result]);

  useEffect(() => {
    return () => {
      if (cardUrl) URL.revokeObjectURL(cardUrl);
    };
  }, [cardUrl]);

  async function onOpenPortal() {
    if (!formReady || !birthDateCe || !gender) return;
    setError(null);
    setSavedMode(false);
    setStage("loading");
    setLoadingMsgIdx(0);
    const startedAt = Date.now();

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          birthDate: birthDateCe,
          ...(timeUnknown || !birthTime ? {} : { birthTime }),
          gender,
          currentJob: currentJob.trim(),
          withImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "เชื่อมต่อจักรวาลคู่ขนานไม่สำเร็จ");
      const wait = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
      await new Promise((resolve) => window.setTimeout(resolve, wait));
      const nextResult = data as WhatIfResponse;
      setResult(nextResult);
      saveWhatIfResult(nextResult);
      markWhatIfPlayed();
      setStage("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "เชื่อมต่อจักรวาลคู่ขนานไม่สำเร็จ");
      setStage("portal");
    }
  }

  async function onResetForTeam() {
    setResult(null);
    setSavedMode(false);
    setBirthTimeTouched(false);
    setFocusedPortion(null);
    setShareNote(null);
    cardBlobRef.current = null;
    if (cardUrl) URL.revokeObjectURL(cardUrl);
    setCardUrl(null);
    await clearWhatIfPlayedState();
    setStage("portal");
  }

  async function getCardBlob() {
    if (cardBlobRef.current) return cardBlobRef.current;
    if (!result) return null;
    const blob = await buildShareCard(result);
    cardBlobRef.current = blob;
    await saveWhatIfCardBlob(blob);
    return blob;
  }

  async function saveCardToDevice() {
    const blob = await getCardBlob();
    if (!blob) {
      setShareNote("สร้างการ์ดไม่สำเร็จ ลองอีกครั้ง");
      return false;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = WHATIF_CARD_FILENAME;
    anchor.click();
    URL.revokeObjectURL(url);
    return true;
  }

  async function onShare() {
    if (!result || sharing) return;
    setSharing(true);
    setShareNote(null);
    try {
      const blob = await getCardBlob();
      if (!blob) throw new Error("card failed");
      const file = new File([blob], WHATIF_CARD_FILENAME, { type: "image/png" });
      const text = `ในจักรวาลคู่ขนาน ฉันคือ ${result.destiny.destinedCareer} ลองเปิดโลกคู่ขนานของคุณ`;
      if (typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "What If...? โลกคู่ขนานของฉัน", text, url: WHATIF_SHARE_URL });
      } else {
        await saveCardToDevice();
        setShareNote("บันทึกการ์ดแล้ว เลือกช่องทางที่คุณใช้แล้ววางลิงก์ชวนเพื่อนได้เลย");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setShareNote("แชร์ไม่สำเร็จ ลองบันทึกการ์ดแทน");
      }
    } finally {
      setSharing(false);
    }
  }

  async function onCopyLink() {
    const text = result
      ? `ในจักรวาลคู่ขนาน ฉันคือ ${result.destiny.destinedCareer} ${WHATIF_SHARE_URL}`
      : WHATIF_SHARE_URL;
    try {
      await navigator.clipboard.writeText(text);
      setShareNote("คัดลอกลิงก์แล้ว");
    } catch {
      setShareNote(WHATIF_SHARE_URL);
    }
  }

  return (
    <main className={`whatif-shell whatif-shell--${stage} ${stage === "portal" && formReady ? "whatif-shell--portal-ready" : ""}`}>
      {stage === "portal" ? (
        <WhatIfPortalCanvas active={portalIntroStarted} mode={canvasMode} phase={canvasPhase} />
      ) : (
        <>
          <div className="whatif__stars" aria-hidden="true" />
          <div className="whatif__aurora" aria-hidden="true">
            <span className="whatif__orb whatif__orb--violet" />
            <span className="whatif__orb whatif__orb--gold" />
            <span className="whatif__orb whatif__orb--teal" />
            <span className="whatif__orb whatif__orb--deep" />
          </div>
        </>
      )}
      <AnimatePresence>
        {stage === "portal" && splashVisible && (
          <motion.div
            className="whatif__splash"
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <motion.img
              className="whatif__splash-logo"
              src="/images/mumate/ic_logo.svg"
              alt=""
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0.18 : 0.36, ease: [0.2, 0.8, 0.2, 1] }}
            />
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait">
        {stage === "portal" && (
          <StageShell
            key="portal"
            className={[
              "whatif",
              "whatif--portal",
              formReady ? "whatif--lock" : "",
              portalIntroSettled ? "whatif--intro-settled" : "whatif--intro-pending",
              portalCheckpointReady ? "whatif--checkpoint-ready" : "whatif--title-checkpoint",
            ].filter(Boolean).join(" ")}
          >
            {portalCheckpointReady && !formReady && (
              <motion.div
                className="whatif__brand"
                aria-label="MuMate"
                variants={PORTAL_STAGE_VARIANTS}
                initial="hidden"
                animate="show"
                transition={{ duration: 0.58, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <img src="/images/mumate/ic_logo.svg" alt="" />
                <span>MuMate</span>
              </motion.div>
            )}

            <header className="whatif__hero">
              <h1 className="whatif__title">
                WHAT <span>IF</span>...?
              </h1>
              <p className="whatif__tagline">ONE QUESTION CHANGES EVERYTHING</p>
              <p className="whatif__sub">
                ถ้าวันนั้นคุณเลือกเดินตามดวงชะตา...
                <br />
                วันนี้ชีวิตคุณจะเป็นอย่างไรในจักรวาลคู่ขนาน?
              </p>
            </header>

            {portalCheckpointReady && (
              <section className="whatif__form" aria-label="ข้อมูลเปิดโลกคู่ขนาน">
                <div className="whatif__ritual">
                  <AnimatePresence initial={false}>
                    {!formReady && (
                    <motion.div
                      key="ritual-stack"
                      className="whatif__ritual-stack"
                      variants={RITUAL_STACK_VARIANTS}
                      initial="active"
                      animate="active"
                      exit="locked"
                      transition={{ duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
                    >
                      <AnimatePresence initial={false}>
                        {!coordinateComplete && (
                          <RitualPortion
                            innerRef={coordinateRef}
                            isFocused={focusedPortion === "coordinate"}
                            key="coordinate-axis"
                            step="01"
                            title="พิกัดกำเนิด"
                            state="active"
                            className="whatif__portion--coordinate"
                          >
                            <label className="whatif__field">
                              <span className="whatif__label">วัน/เดือน/ปีเกิด (พ.ศ.)</span>
                              <div className="whatif__row whatif__row--dob">
                                <select className="whatif__input" aria-label="วันเกิด" value={birthDay} onFocus={() => markFocus("coordinate")} onBlur={clearFocus} onChange={(e) => setBirthDay(e.target.value)}>
                                  <option value="">วันที่</option>
                                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                    <option key={day} value={day}>{day}</option>
                                  ))}
                                </select>
                                <select className="whatif__input" aria-label="เดือนเกิด" value={birthMonth} onFocus={() => markFocus("coordinate")} onBlur={clearFocus} onChange={(e) => setBirthMonth(e.target.value)}>
                                  <option value="">เดือน</option>
                                  {THAI_MONTHS.map((month, index) => (
                                    <option key={month} value={index + 1}>{month}</option>
                                  ))}
                                </select>
                                <select className="whatif__input" aria-label="ปีเกิด พ.ศ." value={birthYearBe} onFocus={() => markFocus("coordinate")} onBlur={clearFocus} onChange={(e) => setBirthYearBe(e.target.value)}>
                                  <option value="">ปี พ.ศ.</option>
                                  {yearOptions.map((year) => (
                                    <option key={year} value={year}>{year}</option>
                                  ))}
                                </select>
                              </div>
                              {birthDay && birthMonth && birthYearBe && !birthDateCe && (
                                <span className="whatif__hint whatif__hint--warn">วันที่นี้ไม่มีจริง ลองตรวจอีกครั้ง</span>
                              )}
                              {birthDateCe && !timeUnknown && !birthTimeTouched && (
                                <span className="whatif__hint">เลือกเวลาเกิด หรือกดไม่ทราบ เพื่อเปิดชั้นถัดไป</span>
                              )}
                            </label>

                            <div className="whatif__field">
                              <span className="whatif__label">เวลาเกิด</span>
                              <div className="whatif__row whatif__row--time">
                                <input
                                  className="whatif__input"
                                  type="time"
                                  aria-label="เวลาเกิด"
                                  value={birthTime}
                                  disabled={timeUnknown}
                                  onFocus={() => markFocus("coordinate")}
                                  onBlur={clearFocus}
                                  onChange={(e) => {
                                    setBirthTime(e.target.value);
                                    setBirthTimeTouched(Boolean(e.target.value));
                                  }}
                                />
                                <label className="whatif__checkbox whatif__checkbox--compact">
                                  <input
                                    type="checkbox"
                                    checked={timeUnknown}
                                    onFocus={() => markFocus("coordinate")}
                                    onBlur={clearFocus}
                                    onChange={(e) => {
                                      setTimeUnknown(e.target.checked);
                                      if (e.target.checked) setBirthTimeTouched(false);
                                    }}
                                  />
                                  <span>ไม่ทราบ</span>
                                </label>
                              </div>
                            </div>
                          </RitualPortion>
                        )}

                        {coordinateComplete && !identityComplete && (
                          <RitualPortion
                            innerRef={identityRef}
                            isFocused={focusedPortion === "identity"}
                            key="identity-axis"
                            step="02"
                            title="ตัวตนในโลกจริง"
                            state="active"
                            className="whatif__portion--identity"
                          >
                            <div className="whatif__field">
                              <span className="whatif__label">เพศ</span>
                              <div className="whatif__segmented" role="group" aria-label="เพศ">
                                <button
                                  type="button"
                                  className={gender === "male" ? "whatif__segment is-active" : "whatif__segment"}
                                  onFocus={() => markFocus("identity")}
                                  onBlur={clearFocus}
                                  onClick={() => setGender("male")}
                                >
                                  ชาย
                                </button>
                                <button
                                  type="button"
                                  className={gender === "female" ? "whatif__segment is-active" : "whatif__segment"}
                                  onFocus={() => markFocus("identity")}
                                  onBlur={clearFocus}
                                  onClick={() => setGender("female")}
                                >
                                  หญิง
                                </button>
                              </div>
                            </div>

                            <label className="whatif__field">
                              <span className="whatif__label">อาชีพปัจจุบัน</span>
                              <input
                                ref={jobInputRef}
                                className="whatif__input"
                                list="whatif-jobs"
                                placeholder="เช่น พนักงานบัญชี, วิศวกร, ฟรีแลนซ์"
                                maxLength={80}
                                value={currentJob}
                                onFocus={() => markFocus("identity")}
                                onBlur={clearFocus}
                                onChange={(e) => setCurrentJob(e.target.value)}
                              />
                              <datalist id="whatif-jobs">
                                {JOB_SUGGESTIONS.map((job) => (
                                  <option key={job} value={job} />
                                ))}
                              </datalist>
                            </label>
                          </RitualPortion>
                        )}

                        {identityComplete && !formReady && (
                          <RitualPortion
                            innerRef={sealRef}
                            isFocused={focusedPortion === "seal"}
                            key="simulation-seal"
                            step="03"
                            title="ตราประทับก่อนเปิดประตู"
                            state="active"
                            className="whatif__portion--seal"
                          >
                            <label className="whatif__switch">
                              <input type="checkbox" checked={withImage} onFocus={() => markFocus("seal")} onBlur={clearFocus} onChange={(e) => setWithImage(e.target.checked)} />
                              <span className="whatif__switch-track" aria-hidden="true" />
                              <span>
                                สร้างภาพ AI
                                <small>ปิดได้ถ้าอยากเปิดผลแบบประหยัด</small>
                              </span>
                            </label>

                            <label className="whatif__checkbox">
                              <input type="checkbox" checked={consent} onFocus={() => markFocus("seal")} onBlur={clearFocus} onChange={(e) => setConsent(e.target.checked)} />
                              <span>
                                ข้าพเจ้าเข้าใจว่านี่คือเรื่องราวจำลองในจักรวาลคู่ขนาน
                                เพื่อความบันเทิงเท่านั้น
                              </span>
                            </label>
                          </RitualPortion>
                        )}
                      </AnimatePresence>
                    </motion.div>
                    )}
                  </AnimatePresence>

                  {error && <p className="whatif__error">{error}</p>}

                  <AnimatePresence initial={false}>
                    {formReady && (
                    <motion.div
                      key="portal-summon"
                      ref={portalLockRef}
                      className="whatif__summon is-ready"
                      initial={{ opacity: 0, y: 34, z: -760, scale: 0.56, filter: "blur(0px)" }}
                      animate={{ opacity: 1, y: 0, z: 0, scale: 1, filter: "blur(0px)" }}
                      exit={{ opacity: 0, y: 18, z: 260, scale: 1.18, filter: "blur(0px)" }}
                      transition={{ type: "spring", stiffness: 96, damping: 18, mass: 1.16 }}
                      style={{ transformPerspective: 1100 }}
                    >
                      <span className="whatif__summon-rift" aria-hidden="true" />
                      <button ref={portalButtonRef} className="whatif__cta whatif__cta--summon" type="button" onClick={onOpenPortal}>
                        เปิดโลกคู่ขนาน
                      </button>
                    </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </section>
            )}
          </StageShell>
        )}

        {stage === "loading" && (
          <StageShell key="loading" className="whatif whatif--loading">
            <section className="whatif__loading" aria-live="polite">
              <h1 className="whatif__sr-only">กำลังคำนวณโลกคู่ขนานของคุณ</h1>
              <div className="whatif__rift" aria-hidden="true">
                <span className="whatif__rift-glow" />
                <span className="whatif__rift-line" />
                <span className="whatif__rift-flare whatif__rift-flare--one" />
                <span className="whatif__rift-flare whatif__rift-flare--two" />
                <span className="whatif__rift-flare whatif__rift-flare--three" />
              </div>
              <p key={loadingMsgIdx} className="whatif__loading-text">{LOADING_MESSAGES[loadingMsgIdx]}</p>
            </section>
          </StageShell>
        )}

        {stage === "result" && result && (
          <StageShell key="result" className="whatif whatif--result">
            <section className="whatif__result">
              {savedMode && (
                <p className="whatif__saved-banner">การ์ดที่บันทึกไว้ · เล่นได้ครั้งเดียวในช่วงแคมเปญนี้</p>
              )}

              <header className="whatif__truth">
                <p className="whatif__chart-badge">{result.destiny.ganzhiLabel}</p>
                <h1 className="whatif__stage-title">โลกคู่ขนานของคุณ</h1>
                <p className="whatif__truth-lead">
                  ในโลกใบนี้ อาชีพของคุณคือ <strong>{result.input.currentJob}</strong>...
                </p>
                <p className="whatif__truth-reveal">แต่อาชีพที่ฟ้าลิขิตมาให้คุณคือ</p>
                <p className="whatif__destined">{result.destiny.destinedCareer}</p>
                <p className="whatif__reason">
                  {ELEMENT_EMOJI[result.destiny.element] ?? "✨"} {result.destiny.careerReason}
                </p>
              </header>

              <div className="whatif__frame">
                <span className="whatif__frame-rune" aria-hidden="true" />
                {result.imageUrl ? (
                  <img
                    className="whatif__image"
                    src={result.imageUrl}
                    alt={`ภาพจำลองคุณในโลกคู่ขนาน อาชีพ ${result.destiny.destinedCareer}`}
                  />
                ) : (
                  <div className="whatif__avatar-fallback">
                    <span>{ELEMENT_EMOJI[result.destiny.element] ?? "✨"}</span>
                    <strong>ตัวคุณในอีกมิติ</strong>
                  </div>
                )}
              </div>

              <section className="whatif__story" aria-labelledby="whatif-story-heading">
                <h2 id="whatif-story-heading" className="whatif__section-title">เศษเสี้ยวไทม์ไลน์</h2>
                <div className="whatif__story-tabs" aria-label="บทของโลกคู่ขนาน">
                  {chapters.map((chapter, index) => (
                    <button
                      key={chapter.key}
                      id={`whatif-tab-${chapter.key}`}
                      type="button"
                      aria-pressed={slideIdx === index}
                      aria-controls={`whatif-panel-${chapter.key}`}
                      className={slideIdx === index ? "whatif__story-tab is-active" : "whatif__story-tab"}
                      onClick={() => setSlideIdx(index)}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowRight") setSlideIdx((slideIdx + 1) % chapters.length);
                        if (e.key === "ArrowLeft") setSlideIdx((slideIdx - 1 + chapters.length) % chapters.length);
                      }}
                    >
                      บท {chapter.no}
                    </button>
                  ))}
                </div>
                {chapters.map((chapter, index) => (
                  <article
                    key={chapter.key}
                    id={`whatif-panel-${chapter.key}`}
                    aria-labelledby={`whatif-tab-${chapter.key}`}
                    hidden={slideIdx !== index}
                    className="whatif__story-panel"
                  >
                    <p className="whatif__chapter-kicker">บทที่ {chapter.no}</p>
                    <h3>{chapter.title}</h3>
                    <p>{chapter.text}</p>
                  </article>
                ))}
              </section>

              {result.bookCareers.length > 0 && (
                <section className="whatif__book" aria-labelledby="whatif-book-heading">
                  <h2 id="whatif-book-heading" className="whatif__section-title">อาชีพที่ถูกโฉลกตามตำรา</h2>
                  <div className="whatif__chips">
                    {result.bookCareers.map((career) => (
                      <span key={career} className="whatif__chip">{career}</span>
                    ))}
                  </div>
                </section>
              )}

              <section className="whatif__share" aria-labelledby="whatif-share-heading">
                <h2 id="whatif-share-heading" className="whatif__section-title">การ์ดโลกคู่ขนานของฉัน</h2>
                {cardUrl ? (
                  <img className="whatif__card-img" src={cardUrl} alt="การ์ดโลกคู่ขนานสำหรับแชร์" />
                ) : (
                  <div className="whatif__card-skeleton" aria-label="กำลังสร้างการ์ด" />
                )}
                <div className="whatif__share-grid">
                  <button className="whatif__share-btn" type="button" disabled={sharing} onClick={onShare}>
                    {sharing ? "กำลังเตรียมการ์ด" : "แชร์การ์ด"}
                  </button>
                  <button className="whatif__share-btn" type="button" onClick={saveCardToDevice}>บันทึกรูป</button>
                  <button className="whatif__share-btn" type="button" onClick={onCopyLink}>คัดลอกลิงก์</button>
                </div>
                {shareNote && <p className="whatif__share-note">{shareNote}</p>}
              </section>

              <button className="whatif__cta whatif__cta--exit" type="button" onClick={() => setStage("reality")}>
                เดินทางกลับสู่โลกปัจจุบัน
              </button>
            </section>
          </StageShell>
        )}

        {stage === "reality" && result && (
          <StageShell key="reality" className="whatif whatif--reality">
            <section className="whatif__back">
              <div className="whatif__warp" aria-hidden="true">
                <span className="whatif__warp-ring" />
                <span className="whatif__warp-core">Mu</span>
              </div>
              <p className="whatif__eyebrow">กลับสู่โลกจริง</p>
              <h1 className="whatif__stage-title">กลับสู่โลกปัจจุบัน</h1>
              <p className="whatif__back-copy">
                คุณอาจย้อนเวลากลับไปจักรวาลคู่ขนานไม่ได้...
                แต่คุณสามารถกำหนด <strong>&ldquo;จังหวะชีวิต&rdquo;</strong>{" "}
                ในโลกความเป็นจริงให้ดีที่สุดได้ตั้งแต่วินาทีนี้
              </p>
              <div className="whatif__disclaimer">
                คำเตือน: เรื่องราวข้างต้นเป็นเพียงความเป็นไปได้หนึ่งเพื่อเป็นแรงบันดาลใจ
                โปรดอย่าตัดสินใจลาออกหรือเปลี่ยนแปลงชีวิตกะทันหัน
                การเปลี่ยนแปลงที่ยั่งยืนต้องมาจากการวางแผนที่รัดกุม
              </div>
              <a className="whatif__cta whatif__cta--final" href={MUMATE_APP_URL}>
                เช็คพื้นดวงและวางแผนชีวิตจริง
              </a>
              <button className="whatif__again" type="button" onClick={() => setStage("result")}>
                กลับไปดูการ์ดโลกคู่ขนาน
              </button>
            </section>
          </StageShell>
        )}
      </AnimatePresence>

      {!(stage === "portal" && formReady) && (
        <footer className="whatif__test-footer">
          <button type="button" onClick={onResetForTeam}>↺ reset (ทีมเทส)</button>
        </footer>
      )}
    </main>
  );
}

function StageShell({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.99 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function thaiWords(text: string): string[] {
  const Segmenter = (Intl as unknown as { Segmenter?: new (locale: string, opts: { granularity: "word" }) => IntlSegmenter }).Segmenter;
  if (Segmenter) {
    const seg = new Segmenter("th", { granularity: "word" });
    return Array.from(seg.segment(text), (part) => part.segment);
  }
  return Array.from(text);
}

type IntlSegmenter = {
  segment(text: string): Iterable<{ segment: string }>;
};

function wrapThai(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of thaiWords(text)) {
    if (ctx.measureText(line + word).width > maxWidth && line) {
      lines.push(line.trimEnd());
      line = word.trimStart();
    } else {
      line += word;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

function fitThaiText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  for (const size of [58, 50, 44, 38, 32]) {
    ctx.font = `800 ${size}px Prompt, "IBM Plex Sans Thai", sans-serif`;
    const lines = wrapThai(ctx, text, maxWidth);
    if (lines.length <= 2) return { lines, size };
  }
  ctx.font = '800 32px Prompt, "IBM Plex Sans Thai", sans-serif';
  return { lines: wrapThai(ctx, text, maxWidth).slice(0, 2), size: 32 };
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

async function buildShareCard(result: WhatIfResponse): Promise<Blob> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas is unavailable");

  try {
    await document.fonts.ready;
  } catch {
    // Continue with browser fallback fonts.
  }

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#120833");
  bg.addColorStop(0.48, "#2c1262");
  bg.addColorStop(1, "#0b0723");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 120; i += 1) {
    const x = (Math.abs(Math.sin(i * 12.9898)) * 43758.5453) % 1;
    const y = (Math.abs(Math.sin(i * 78.233)) * 12543.271) % 1;
    ctx.globalAlpha = 0.25 + ((i * 13) % 10) / 14;
    ctx.fillStyle = i % 7 === 0 ? "#ffd166" : "#f4ecff";
    ctx.beginPath();
    ctx.arc(x * size, y * size, 1.2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.fillStyle = "#f4ecff";
  ctx.font = '800 92px Prompt, "IBM Plex Sans Thai", sans-serif';
  ctx.fillText("WHAT IF...?", size / 2, 128);
  ctx.fillStyle = "#cdbcf5";
  ctx.font = '500 30px Prompt, "IBM Plex Sans Thai", sans-serif';
  ctx.fillText("ในจักรวาลคู่ขนาน ฉันคือ...", size / 2, 184);

  const cx = size / 2;
  const cy = 462;
  const radius = 230;
  const ring = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ring.addColorStop(0, "#ffd166");
  ring.addColorStop(0.5, "#ff8c1a");
  ring.addColorStop(1, "#1b9aaf");
  ctx.save();
  ctx.strokeStyle = ring;
  ctx.lineWidth = 16;
  ctx.shadowColor = "rgba(255, 209, 102, 0.72)";
  ctx.shadowBlur = 48;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 14, 0, Math.PI * 2);
  ctx.clip();
  if (result.imageUrl) {
    try {
      const img = await loadImage(result.imageUrl);
      const diameter = (radius - 14) * 2;
      const scale = Math.max(diameter / img.width, diameter / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
    } catch {
      drawFallbackAvatar(ctx, result, cx, cy, radius);
    }
  } else {
    drawFallbackAvatar(ctx, result, cx, cy, radius);
  }
  ctx.restore();

  const gold = ctx.createLinearGradient(0, 742, 0, 900);
  gold.addColorStop(0, "#fff3ca");
  gold.addColorStop(1, "#ffb23e");
  ctx.fillStyle = gold;
  const fitted = fitThaiText(ctx, result.destiny.destinedCareer, 900);
  const lineGap = fitted.size + 16;
  const firstY = 792 - ((fitted.lines.length - 1) * lineGap) / 2;
  fitted.lines.forEach((line, index) => ctx.fillText(line, size / 2, firstY + index * lineGap));

  ctx.textAlign = "left";
  ctx.fillStyle = "#f4ecff";
  ctx.font = '800 44px Prompt, "IBM Plex Sans Thai", sans-serif';
  ctx.fillText("MuMate", 72, size - 104);
  ctx.fillStyle = "#b9eff6";
  ctx.font = '500 28px Prompt, "IBM Plex Sans Thai", sans-serif';
  ctx.fillText("bazichart.mumate.co/what-if", 72, size - 60);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd166";
  ctx.font = '600 26px Prompt, "IBM Plex Sans Thai", sans-serif';
  ctx.fillText("เปิดโลกคู่ขนานของคุณ", size - 72, size - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/png");
  });
}

function drawFallbackAvatar(
  ctx: CanvasRenderingContext2D,
  result: WhatIfResponse,
  cx: number,
  cy: number,
  radius: number,
) {
  const inner = ctx.createRadialGradient(cx, cy, 20, cx, cy, radius);
  inner.addColorStop(0, "#7c3aed");
  inner.addColorStop(1, "#140a30");
  ctx.fillStyle = inner;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.textAlign = "center";
  ctx.font = "170px serif";
  ctx.fillText(ELEMENT_EMOJI[result.destiny.element] ?? "✨", cx, cy + 58);
}

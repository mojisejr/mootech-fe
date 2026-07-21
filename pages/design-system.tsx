import type { GetServerSideProps } from "next";
import type { ReactNode } from "react";
import { useState } from "react";
import Head from "next/head";
import Image from "next/image";

import SkeletonRow from "@/components/ui/skeleton-row";
import { Button } from "@/components/ui/button";
import { TextLink } from "@/components/ui/link";
import { Field, Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { PillTabs } from "@/components/ui/pill-tabs";
import { ZODIAC_TABLE, buildMascotPaths } from "@/lib/personalization";
import { cn } from "@/lib/utils/cn";

type TokenSpec = {
  name: string;
  value: string;
  className: string;
  textClassName?: string;
  testId: string;
  role: string;
};

const colorTokens: TokenSpec[] = [
  {
    name: "moumate_blue",
    value: "#1B9AAF",
    className: "bg-moumate_blue",
    textClassName: "text-white",
    testId: "design-token-moumate-blue",
    role: "Primary brand teal",
  },
  {
    name: "moumate_blue_dark",
    value: "#4B96E5",
    className: "bg-moumate_blue_dark",
    textClassName: "text-white",
    testId: "design-token-moumate-blue-dark",
    role: "Secondary blue emphasis",
  },
  {
    name: "moumate_blue_light",
    value: "#EEFDFD",
    className: "bg-moumate_blue_light",
    testId: "design-token-moumate-blue-light",
    role: "Soft selected background",
  },
  {
    name: "moumate_gray",
    value: "#888888",
    className: "bg-white",
    textClassName: "text-moumate_gray",
    testId: "design-token-moumate-gray",
    role: "Secondary copy",
  },
  {
    name: "moumate_black",
    value: "#101828",
    className: "bg-white",
    textClassName: "text-moumate_black",
    testId: "design-token-moumate-black",
    role: "Primary readable copy",
  },
  {
    name: "moumate_white",
    value: "#FFFFFF",
    className: "bg-moumate_white",
    testId: "design-token-moumate-white",
    role: "Fields and cards",
  },
  {
    name: "moumate_red",
    value: "#CB2C2A",
    className: "bg-white",
    textClassName: "text-moumate_red",
    testId: "design-token-moumate-red",
    role: "Errors and required marks",
  },
  {
    name: "bg_gray",
    value: "#E9EAEB",
    className: "bg-bg_gray",
    testId: "design-token-bg-gray",
    role: "Skeleton fill",
  },
  {
    name: "border_gray",
    value: "#D5D7DA",
    className: "bg-white border-border_gray",
    testId: "design-token-border-gray",
    role: "Low-emphasis border",
  },
  {
    name: "chat_surface",
    value: "#44588B",
    className: "bg-chat_surface",
    textClassName: "text-white",
    testId: "design-token-chat-surface",
    role: "Chat body surface",
  },
  {
    name: "chat_header_to",
    value: "#3A78A9",
    className: "bg-chat_header_to",
    textClassName: "text-white",
    testId: "design-token-chat-header-to",
    role: "Chat header end",
  },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
      <h2 className="font-prompt text-[22px] font-semibold text-moumate_black">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function TokenSwatch({ token }: { token: TokenSpec }) {
  return (
    <div className="rounded-[16px] border border-border_gray bg-white p-3 shadow-custom">
      <div
        data-testid={token.testId}
        className={`flex min-h-[112px] flex-col justify-between rounded-[12px] border border-border_gray p-4 ${token.className} ${
          token.textClassName ?? "text-moumate_black"
        }`}
      >
        <span className="font-prompt text-[14px] font-semibold">
          {token.name}
        </span>
        <span className="font-ibm text-[13px]">{token.value}</span>
      </div>
      <p className="mt-3 font-ibm text-[13px] text-moumate_gray">
        {token.role}
      </p>
    </div>
  );
}

function PrimaryCTA({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="min-h-[48px] w-full rounded-[16px] bg-moumate_blue px-5 font-prompt text-[16px] font-semibold text-white shadow-custom transition hover:bg-moumate_blue_dark"
      type="button"
    >
      {children}
    </button>
  );
}

function PillCTA({ children }: { children: React.ReactNode }) {
  return (
    <button
      className="min-h-[40px] rounded-full border border-moumate_blue bg-moumate_blue_light px-5 font-prompt text-[14px] font-medium text-moumate_blue"
      type="button"
    >
      {children}
    </button>
  );
}

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] bg-white/45 p-5 shadow-custom backdrop-blur-sm">
      {children}
    </div>
  );
}

function FieldSample() {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-2 font-ibm text-[14px] text-moumate_black">
        ชื่อที่ใช้ใน MuMate
        <input
          className="h-[42px] rounded-[10px] border border-border_gray bg-moumate_white px-3 font-ibm text-[14px] text-moumate_black outline-none focus:border-moumate_blue"
          defaultValue="คุณนนท์"
        />
      </label>
      <label className="grid gap-2 font-ibm text-[14px] text-moumate_black">
        โหมดตัวอย่าง
        <select
          className="h-[42px] rounded-[10px] border border-border_gray bg-moumate_white px-3 font-ibm text-[14px] text-moumate_black outline-none focus:border-moumate_blue"
          defaultValue="soft"
        >
          <option value="soft">Soft card</option>
          <option value="chat">Chat surface</option>
        </select>
      </label>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 Component Library — primitive gallery + personalization demo.
// Rendered on a ghost-white surface so the flat white primitives read against it
// (DESIGN §4: depth = ghost-white ↔ white contrast, not shadow).
// ---------------------------------------------------------------------------

// Group heading — Chonburi display accent (DESIGN §3), section gap 32 (§5).
function V3Group({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="pt-8">
      <h3 className="font-chonburi text-[24px] leading-8 text-v3-navy">
        {title}
      </h3>
      {subtitle && (
        <p className="mt-1 font-ibm text-[14px] leading-[22px] text-v3-text-muted">
          {subtitle}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

// Single specimen — a caption above the live primitive (label ↔ field gap 8, §5).
function Specimen({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-ibm text-[12px] leading-[18px] text-v3-text-muted">
        {label}
      </span>
      <div>{children}</div>
    </div>
  );
}

function ButtonShowcase() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <Specimen label="Primary · full (sapphire + lime, UPPER)">
        <Button>เริ่มดูดวงกับ MuMate</Button>
      </Specimen>
      <Specimen label="Primary · hover → พื้น #10427F">
        <Button>เริ่มดูดวงกับ MuMate</Button>
      </Specimen>
      <Specimen label="Secondary (lime fill + sapphire label)">
        <Button variant="secondary">ลงทะเบียนด้วย LINE</Button>
      </Specimen>
      <Specimen label="Tertiary (outline + sapphire)">
        <Button variant="tertiary">ลงทะเบียนด้วย Google</Button>
      </Specimen>
      <Specimen label="CTA · cyan (white label + soft shadow, h56)">
        <Button variant="cta-cyan">บันทึกเป็น PDF</Button>
      </Specimen>
      <Specimen label="CTA · sapphire (white label + soft shadow, h56)">
        <Button variant="cta-sapphire">แชร์ผลดวงสมพงศ์</Button>
      </Specimen>
      <Specimen label="Primary · disabled">
        <Button disabled>เริ่มดูดวงกับ MuMate</Button>
      </Specimen>
      <Specimen label="Primary · loading">
        <Button loading>กำลังทำนาย</Button>
      </Specimen>
      <Specimen label="Small · default / disabled">
        <div className="flex flex-wrap gap-3">
          <Button size="small">ดูเพิ่มเติม</Button>
          <Button size="small" disabled>
            ดูเพิ่มเติม
          </Button>
        </div>
      </Specimen>
      <Specimen label="Link (subtle med / small · legal small)">
        <div className="flex flex-wrap items-center gap-4">
          <TextLink href="#">เข้าสู่ระบบ</TextLink>
          <TextLink href="#" size="small">
            ลืมรหัสผ่าน
          </TextLink>
          <TextLink href="#" type="legal" size="small">
            ข้อกำหนดความเป็นส่วนตัว
          </TextLink>
        </div>
      </Specimen>
    </div>
  );
}

function InputShowcase() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Specimen label="Field · default">
        <Field
          label="ชื่อเล่น"
          placeholder="พิมพ์ชื่อของคุณ"
          helper="ใช้เรียกคุณระหว่างบทสนทนา"
        />
      </Specimen>
      <Specimen label="Field · focus → เส้น 2px #3475E2 (คลิกที่ช่องเพื่อดู)">
        <Field label="อีเมล" placeholder="you@example.com" />
      </Specimen>
      <Specimen label="Field · filled">
        <Field label="วันเกิด" defaultValue="14 กรกฎาคม 2536" />
      </Specimen>
      <Specimen label="Field · error">
        <Field
          label="เบอร์โทรศัพท์"
          defaultValue="08"
          error
          helper="กรุณากรอกเบอร์ให้ครบ 10 หลัก"
        />
      </Specimen>
      <Specimen label="Input · bare (ไม่มี label)">
        <Input placeholder="ค้นหาคำทำนาย" />
      </Specimen>
    </div>
  );
}

const ELEMENT_OPTIONS = [
  { label: "ธาตุไม้", value: "ไม้" },
  { label: "ธาตุไฟ", value: "ไฟ" },
  { label: "ธาตุดิน", value: "ดิน" },
  { label: "ธาตุทอง", value: "ทอง" },
  { label: "ธาตุน้ำ", value: "น้ำ" },
];

function DropdownShowcase() {
  const [element, setElement] = useState("");
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Specimen label="Dropdown · default (เลือกได้จริง)">
        <Dropdown
          label="ธาตุประจำวันเกิด"
          placeholder="เลือกธาตุ"
          options={ELEMENT_OPTIONS}
          value={element}
          onChange={setElement}
        />
      </Specimen>
      <Specimen label="Dropdown · loading">
        <Dropdown
          label="กำลังโหลดข้อมูล"
          placeholder="โปรดรอสักครู่"
          state="loading"
        />
      </Specimen>
    </div>
  );
}

function CheckboxShowcase() {
  const [checked, setChecked] = useState(true);
  const [unchecked, setUnchecked] = useState(false);
  const [labeled, setLabeled] = useState(true);
  const [described, setDescribed] = useState(false);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Specimen label="checked">
        <Checkbox
          checked={checked}
          onChange={setChecked}
          ariaLabel="ตัวอย่างช่องที่เลือกแล้ว"
        />
      </Specimen>
      <Specimen label="unchecked">
        <Checkbox
          checked={unchecked}
          onChange={setUnchecked}
          ariaLabel="ตัวอย่างช่องที่ยังไม่เลือก"
        />
      </Specimen>
      <Specimen label="labeled">
        <Checkbox
          checked={labeled}
          onChange={setLabeled}
          label="รับข่าวสารดวงประจำวัน"
        />
      </Specimen>
      <Specimen label="with description">
        <Checkbox
          checked={described}
          onChange={setDescribed}
          label="ยอมรับเงื่อนไขการใช้งาน"
          description="เรานำข้อมูลไปใช้เพื่อคำนวณดวงของคุณเท่านั้น"
        />
      </Specimen>
    </div>
  );
}

function PillTabsShowcase() {
  const [tab, setTab] = useState("love");
  const [calTab, setCalTab] = useState("year");
  return (
    <div className="flex flex-col gap-6">
      <Specimen label="Neutral (#EBEBEB track · white-thumb + shadow)">
        <PillTabs
          ariaLabel="หมวดคำทำนาย"
          items={[
            { label: "ความรัก", value: "love" },
            { label: "การงาน", value: "work" },
            { label: "การเงิน", value: "money" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Specimen>
      <Specimen label="Calendar (white track · sapphire-fill + lime-label selected)">
        <PillTabs
          variant="calendar"
          ariaLabel="โหมดปฏิทิน"
          items={[
            { label: "ปฏิทินรายปี", value: "year" },
            { label: "ปฏิทินเฉพาะฉัน", value: "me" },
          ]}
          value={calTab}
          onChange={setCalTab}
        />
      </Specimen>
    </div>
  );
}

function CardShowcase() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Specimen label="Card · flat (default, ไม่มีเส้นขอบ)">
        <Card>
          <h4 className="font-ibm text-[16px] font-bold text-v3-text-title">
            ดวงวันนี้
          </h4>
          <p className="mt-1 font-ibm text-[14px] leading-[22px] text-v3-text-body">
            วันนี้เหมาะกับการเริ่มต้นสิ่งใหม่และจัดระบบให้ใจเบาขึ้น
          </p>
        </Card>
      </Specimen>
      <Specimen label="Card · border (เส้น 1px #E9EAEB)">
        <Card border>
          <h4 className="font-ibm text-[16px] font-bold text-v3-text-title">
            แพ็กเกจ FlexiMate
          </h4>
          <p className="mt-1 font-ibm text-[14px] leading-[22px] text-v3-text-body">
            เลือกจำนวนครั้งได้เอง เหมาะกับคนที่อยากถามเป็นช่วง ๆ
          </p>
        </Card>
      </Specimen>
    </div>
  );
}

// นักษัตร presets from the canonical zodiac table (single source of truth).
const NAKKASAT_OPTIONS = ZODIAC_TABLE.map((z) => ({
  label: `${z.th} (${z.en})`,
  value: z.th,
}));

// Interactive personalization demo — two axes (นักษัตร × ธาตุ) resolve via the
// PURE builder (no live API), then render the no-bg character .png + with-bg card
// .jpg through next/image. 12 × 5 = 60 assets always resolve to a real file.
function MascotDemo() {
  const [animal, setAnimal] = useState("กุน");
  const [element, setElement] = useState("ไม้");
  const mascot = buildMascotPaths(animal, element);

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
      <Card border className="flex flex-col gap-4">
        <Dropdown
          label="นักษัตร (ปีเกิด)"
          placeholder="เลือกนักษัตร"
          options={NAKKASAT_OPTIONS}
          value={animal}
          onChange={setAnimal}
        />
        <Dropdown
          label="ธาตุประจำวันเกิด"
          placeholder="เลือกธาตุ"
          options={ELEMENT_OPTIONS}
          value={element}
          onChange={setElement}
        />
        {mascot && (
          <div className="rounded-card bg-v3-ghost-white p-4">
            <p className="font-ibm text-[16px] font-bold text-v3-text-title">
              ธาตุของคุณคือ {mascot.elementLabelTh}
            </p>
            <p className="mt-1 font-ibm text-[13px] text-v3-text-muted">
              filename:{" "}
              <span className="font-poppins-v3">{mascot.filename}</span>
            </p>
          </div>
        )}
      </Card>

      {mascot && (
        <div className="grid gap-6 sm:grid-cols-2">
          <Specimen label="Character · no-bg .png">
            <div className="flex justify-center rounded-card bg-v3-ghost-white p-4">
              <Image
                src={mascot.character}
                alt={`ตัวการ์ตูน${mascot.animalTh} ${mascot.elementLabelTh}`}
                width={220}
                height={303}
                className="h-auto w-auto"
              />
            </div>
          </Specimen>
          <Specimen label="Card · with-bg .jpg">
            <Image
              src={mascot.card}
              alt={`การ์ด${mascot.animalTh} ${mascot.elementLabelTh}`}
              width={220}
              height={305}
              className="h-auto w-auto rounded-card"
            />
          </Specimen>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 Foundation Tokens — the visible design-system reference for every v3
// primitive value. Reviewer reads name + hex on each chip. Ghost-white wrapper
// so flat/white surfaces read (DESIGN §4). Additive to V3ComponentLibrary.
// ---------------------------------------------------------------------------

// One chip: color/border block + token name + hex (poppins-v3 numerals).
function Swatch({
  chipClass,
  name,
  hex,
  chipInner,
  sampleText,
  sampleClass,
}: {
  chipClass: string;
  name: string;
  hex: string;
  chipInner?: ReactNode;
  sampleText?: string;
  sampleClass?: string;
}) {
  return (
    <div className="rounded-card border border-v3-border-card bg-white p-3">
      <div className={`flex h-14 w-full items-center justify-center rounded-chip ${chipClass}`}>
        {chipInner}
      </div>
      {sampleText && (
        <p className={`mt-2 font-ibm text-[15px] ${sampleClass ?? ""}`}>{sampleText}</p>
      )}
      <p className="mt-2 font-ibm text-[13px] font-semibold text-v3-text-body">{name}</p>
      <p className="font-poppins-v3 text-[12px] text-v3-text-muted">{hex}</p>
    </div>
  );
}

function TokenGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">{children}</div>;
}

// Grade 10-step semantic scale — full literal class strings (Tailwind can't purge
// runtime-concatenated names). badgeText dark only on C+ (contrast exception).
const V3_GRADES = [
  { letter: "A", label: "Excellent", pct: 95, bg: "bg-v3-grade-a-bg", badge: "bg-v3-grade-a", accent: "text-v3-grade-a", badgeText: "text-white" },
  { letter: "B+", label: "Very Good", pct: 85, bg: "bg-v3-grade-bplus-bg", badge: "bg-v3-grade-bplus", accent: "text-v3-grade-bplus", badgeText: "text-white" },
  { letter: "B", label: "Good", pct: 75, bg: "bg-v3-grade-b-bg", badge: "bg-v3-grade-b", accent: "text-v3-grade-b", badgeText: "text-white" },
  { letter: "B-", label: "Above Avg", pct: 65, bg: "bg-v3-grade-bminus-bg", badge: "bg-v3-grade-bminus", accent: "text-v3-grade-bminus", badgeText: "text-white" },
  { letter: "C+", label: "Average+", pct: 55, bg: "bg-v3-grade-cplus-bg", badge: "bg-v3-grade-cplus", accent: "text-v3-grade-cplus", badgeText: "text-[#374151]" },
  { letter: "C", label: "Average", pct: 47, bg: "bg-v3-grade-c-bg", badge: "bg-v3-grade-c", accent: "text-v3-grade-c", badgeText: "text-white" },
  { letter: "C-", label: "Below Avg", pct: 42, bg: "bg-v3-grade-cminus-bg", badge: "bg-v3-grade-cminus", accent: "text-v3-grade-cminus", badgeText: "text-white" },
  { letter: "D+", label: "Poor", pct: 37, bg: "bg-v3-grade-dplus-bg", badge: "bg-v3-grade-dplus", accent: "text-v3-grade-dplus", badgeText: "text-white" },
  { letter: "D", label: "Very Poor", pct: 30, bg: "bg-v3-grade-d-bg", badge: "bg-v3-grade-d", accent: "text-v3-grade-d", badgeText: "text-white" },
  { letter: "D-", label: "Critical", pct: 15, bg: "bg-v3-grade-dminus-bg", badge: "bg-v3-grade-dminus", accent: "text-v3-grade-dminus", badgeText: "text-white" },
];

const V3_ELEMENTS = [
  { th: "ธาตุไม้", icon: "bg-v3-el-wood", text: "text-v3-el-wood-text" },
  { th: "ธาตุทอง", icon: "bg-v3-el-metal", text: "text-v3-el-metal-text" },
  { th: "ธาตุไฟ", icon: "bg-v3-el-fire", text: "text-v3-el-fire-text" },
  { th: "ธาตุดิน", icon: "bg-v3-el-earth", text: "text-v3-el-earth-text" },
  { th: "ธาตุน้ำ", icon: "bg-v3-el-water", text: "text-v3-el-water-text" },
];

// Typography ramp — literal class strings, live Thai+Latin line, spec as caption.
const V3_TYPE_RAMP = [
  { spec: "Display · 32 · Chonburi · UPPERCASE", cls: "font-chonburi text-[32px] uppercase text-v3-navy", text: "A PORCELAIN SWAN" },
  { spec: "H1 · 24/32 · bold", cls: "font-ibm text-[24px] leading-8 font-bold text-v3-text-title", text: "ดวงชะตาวันนี้ Heading 1" },
  { spec: "H2 · 20/28 · bold", cls: "font-ibm text-[20px] leading-7 font-bold text-v3-text-title", text: "ดวงชะตาวันนี้ Heading 2" },
  { spec: "H3 · 18/24 · bold", cls: "font-ibm text-[18px] leading-6 font-bold text-v3-text-title", text: "ดวงชะตาวันนี้ Heading 3" },
  { spec: "H4 · 16/24 · bold", cls: "font-ibm text-[16px] leading-6 font-bold text-v3-text-title", text: "ดวงชะตาวันนี้ Heading 4" },
  { spec: "Body Large · 16/24", cls: "font-ibm text-[16px] leading-6 text-v3-text-body", text: "อ่านง่ายและนุ่มนวล Body Large 123" },
  { spec: "Body Medium · 15/22 · weight 500", cls: "font-ibm text-[15px] leading-[22px] font-medium text-v3-text-body", text: "อ่านง่ายและนุ่มนวล Body Medium 123" },
  { spec: "Body Regular · 14/22", cls: "font-ibm text-[14px] leading-[22px] text-v3-text-body", text: "อ่านง่ายและนุ่มนวล Body Regular 123" },
  { spec: "Label · 14/20 · semibold", cls: "font-ibm text-[14px] leading-5 font-semibold text-v3-text-body", text: "ป้ายกำกับ Label Abc" },
  { spec: "Label Bold · 14/20 · bold", cls: "font-ibm text-[14px] leading-5 font-bold text-v3-text-body", text: "ป้ายกำกับ Label Bold Abc" },
  { spec: "Button · 16/24 · bold · UPPERCASE", cls: "font-ibm text-[16px] leading-6 font-bold uppercase text-v3-sapphire", text: "เริ่มดูดวง start now" },
  { spec: "Button Small · 14/20 · semibold · UPPERCASE", cls: "font-ibm text-[14px] leading-5 font-semibold uppercase text-v3-sapphire", text: "ดูเพิ่มเติม see more" },
  { spec: "Helper · 12/18", cls: "font-ibm text-[12px] leading-[18px] text-v3-text-muted", text: "ข้อความช่วยเหลือ Helper text 123" },
  { spec: "Caption · 10", cls: "font-ibm text-[10px] text-v3-text-muted", text: "คำอธิบายเล็ก Caption 123" },
];

const V3_RADII = [
  { cls: "rounded-chip", label: "chip · 6" },
  { cls: "rounded-[8px]", label: "8" },
  { cls: "rounded-day", label: "day · 11" },
  { cls: "rounded-method", label: "method · 12" },
  { cls: "rounded-date", label: "date · 14" },
  { cls: "rounded-card", label: "card · 16" },
  { cls: "rounded-feature", label: "feature · 20" },
  { cls: "rounded-service", label: "service · 24" },
  { cls: "rounded-sheet", label: "sheet · 28" },
  { cls: "rounded-screen", label: "screen · 40" },
  { cls: "rounded-[44px]", label: "44" },
  { cls: "rounded-[56px]", label: "56" },
  { cls: "rounded-pill", label: "pill · 100" },
];

const V3_SHADOWS = [
  { cls: "shadow-grade-glow", label: "grade-glow" },
  { cls: "shadow-sheet", label: "sheet" },
  { cls: "shadow-card-soft", label: "card-soft" },
  { cls: "shadow-card-faint", label: "card-faint" },
  { cls: "shadow-cta-cyan", label: "cta-cyan" },
  { cls: "shadow-cta-sapphire", label: "cta-sapphire" },
  { cls: "shadow-promo", label: "promo" },
  { cls: "shadow-tab-selected", label: "tab-selected" },
  { cls: "shadow-glass-glow", label: "glass-glow" },
];

const V3_SPACES = [4, 8, 12, 16, 20, 24, 28, 32];

function V3FoundationTokens() {
  return (
    <div className="bg-v3-ghost-white" data-testid="design-v3-foundation">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
        <h2 className="font-chonburi text-[28px] leading-9 text-v3-navy">
          V3 Foundation Tokens
        </h2>
        <p className="mt-1 font-ibm text-[14px] leading-[22px] text-v3-text-body">
          ทุกค่าโทเคนของ MuMate V3 — สี พื้นผิว ตัวอักษร มุมโค้ง เงา ระยะห่าง
          พร้อมชื่อโทเคนและ hex ให้ตรวจทานได้ทุกค่า (บนพื้น ghost-white)
        </p>

        <div className="mt-2 divide-y divide-v3-border-card">
          <V3Group title="Brand / accent" subtitle="สีแบรนด์และ accent หลัก — lime แสดงบนพื้นเข้ม (คอนทราสต์ต่ำบนขาว)">
            <TokenGrid>
              <Swatch chipClass="bg-v3-sapphire" name="sapphire" hex="#1455A4" />
              <Swatch chipClass="bg-v3-sapphire-hover" name="sapphire-hover" hex="#10427F" />
              <Swatch
                chipClass="bg-v3-nav-dark"
                name="lime"
                hex="#E1FF00"
                chipInner={<div className="h-8 w-8 rounded-chip bg-v3-lime" />}
              />
              <Swatch chipClass="bg-v3-cyan" name="cyan" hex="#1B9AAF" />
              <Swatch chipClass="bg-v3-pumpkin" name="pumpkin" hex="#FF6800" />
            </TokenGrid>
          </V3Group>

          <V3Group title="Surface & text" subtitle="พื้นผิวและสีตัวอักษร — โทเคนตัวอักษรแสดงตัวอย่าง ก ก ABC ในสีจริง">
            <TokenGrid>
              <Swatch chipClass="bg-v3-ghost-white border border-v3-border-card" name="ghost-white" hex="#ECF0FD" />
              <Swatch chipClass="bg-v3-bg-cream border border-v3-border-card" name="bg-cream" hex="#FAF7F4" />
              <Swatch chipClass="bg-white border border-v3-border-card" name="white (surface)" hex="#FFFFFF" />
              <Swatch chipClass="bg-v3-navy" name="navy / text-title" hex="#0B305B" sampleText="ก ก ABC" sampleClass="text-v3-navy" />
              <Swatch chipClass="bg-v3-text-body" name="text-body" hex="#464646" sampleText="ก ก ABC" sampleClass="text-v3-text-body" />
              <Swatch chipClass="bg-v3-text-body-alt" name="text-body-alt" hex="#4B5563" sampleText="ก ก ABC" sampleClass="text-v3-text-body-alt" />
              <Swatch chipClass="bg-v3-text-muted" name="text-muted" hex="#71717A" sampleText="ก ก ABC" sampleClass="text-v3-text-muted" />
              <Swatch chipClass="bg-v3-text-detail" name="text-detail" hex="#888888" sampleText="ก ก ABC" sampleClass="text-v3-text-detail" />
              <Swatch chipClass="bg-v3-placeholder" name="placeholder" hex="#9CA3AF" sampleText="ก ก ABC" sampleClass="text-v3-placeholder" />
              <Swatch chipClass="bg-v3-text-filled" name="text-filled" hex="#212121" sampleText="ก ก ABC" sampleClass="text-v3-text-filled" />
              <Swatch chipClass="bg-v3-text-price" name="text-price" hex="#1F2937" sampleText="ก ก ABC" sampleClass="text-v3-text-price" />
            </TokenGrid>
          </V3Group>

          <V3Group title="Semantic & border" subtitle="สถานะและเส้นขอบ — โทเคน border แสดงเป็นชิปขาวที่มีเส้นสีนั้น">
            <TokenGrid>
              <Swatch chipClass="bg-v3-error" name="error" hex="#E73E3E" />
              <Swatch chipClass="bg-v3-error-legacy" name="error-legacy" hex="#C13515" />
              <Swatch chipClass="bg-v3-focus-border" name="focus-border" hex="#3475E2" />
              <Swatch chipClass="bg-v3-shade-02" name="shade-02" hex="#222222" />
              <Swatch chipClass="bg-v3-link-legal" name="link-legal" hex="#004CC4" />
              <Swatch chipClass="bg-white border-2 border-v3-border-input" name="border-input" hex="#E5E7EB" />
              <Swatch chipClass="bg-white border-2 border-v3-border-checkout" name="border-checkout" hex="#D1D5DB" />
              <Swatch chipClass="bg-white border-2 border-v3-border-card" name="border-card" hex="#E9EAEB" />
              <Swatch chipClass="bg-white border-2 border-v3-border-warm" name="border-warm" hex="#E0DEDB" />
              <Swatch chipClass="bg-white border-2 border-v3-border-warm-2" name="border-warm-2" hex="#E5E3E0" />
              <Swatch chipClass="bg-v3-disabled-bg" name="disabled-bg" hex="#DDDDDD" />
              <Swatch chipClass="bg-white border-2 border-v3-border-dropdown" name="border-dropdown" hex="#B0B0B0" />
              <Swatch chipClass="bg-white border-2 border-v3-border-checkbox" name="border-checkbox" hex="#C2C2C2" />
              <Swatch chipClass="bg-v3-tab-track" name="tab-track" hex="#EBEBEB" />
              <Swatch chipClass="bg-v3-tab-focus border border-v3-border-card" name="tab-focus" hex="#F7F7F7" />
              <Swatch chipClass="bg-v3-dropdown-label" name="dropdown-label" hex="#717171" />
            </TokenGrid>
          </V3Group>

          <V3Group title="Nav / Mate AI" subtitle="แถบเมนูและ Mate AI — พร้อมพิลล์เดโมไล่สีฐาน + lime overlay + gradient text">
            <TokenGrid>
              <Swatch chipClass="bg-v3-nav-dark" name="nav-dark" hex="#1A1A1A" />
              <Swatch chipClass="bg-v3-nav-label-off border border-v3-border-card" name="nav-label-off" hex="#FAF7F4" />
              <Swatch chipClass="bg-v3-mate-magenta" name="mate-magenta" hex="#E913C5" />
              <Swatch chipClass="bg-v3-mate-teal" name="mate-teal" hex="#187CAA" />
              <Swatch chipClass="bg-v3-mate-purple" name="mate-purple" hex="#6F1BAF" />
            </TokenGrid>
            <div className="mt-4 flex items-center gap-4 rounded-service bg-[linear-gradient(141deg,#1455A4_3%,#187CAA_50%,#6F1BAF_122%)] p-5">
              <div className="h-10 w-10 rounded-chip bg-v3-lime" />
              <span className="font-ibm text-[20px] font-bold text-white">Mate AI FAB</span>
              <span className="ml-auto rounded-pill bg-white px-4 py-2 font-ibm text-[18px] font-bold">
                <span className="bg-[linear-gradient(90deg,#1455A4,#E913C5)] bg-clip-text text-transparent">
                  Mate AI
                </span>
              </span>
            </div>
            <p className="mt-2 font-ibm text-[12px] leading-[18px] text-v3-text-muted">
              base: linear-gradient(141deg,#1455A4,#187CAA,#6F1BAF) · lime overlay #E1FF00 · gradient text #1455A4→#E913C5
            </p>
          </V3Group>

          <V3Group title="Home pastel tiles" subtitle="โทนพาสเทลของแท็บหน้าหลัก — พื้นผิวอ่อน แสดงเป็นชิปมีเส้นขอบ">
            <TokenGrid>
              <Swatch chipClass="bg-v3-pastel-mint border border-v3-border-card" name="pastel-mint" hex="#E0FFC4" />
              <Swatch chipClass="bg-v3-pastel-sky border border-v3-border-card" name="pastel-sky" hex="#C1E6F8" />
              <Swatch chipClass="bg-v3-pastel-blue border border-v3-border-card" name="pastel-blue" hex="#C9E4F4" />
              <Swatch chipClass="bg-v3-pastel-lilac border border-v3-border-card" name="pastel-lilac" hex="#ECD9FB" />
              <Swatch chipClass="bg-v3-pastel-pink border border-v3-border-card" name="pastel-pink" hex="#FBD9E7" />
              <Swatch chipClass="bg-v3-grade-yellow border border-v3-border-card" name="grade-yellow" hex="#F1FF75" />
              <Swatch chipClass="bg-v3-pastel-teal border border-v3-border-card" name="pastel-teal" hex="#91D8D2" />
              <Swatch chipClass="bg-v3-lemon-chiffon border border-v3-border-card" name="lemon-chiffon" hex="#F9F4F0" />
              <Swatch chipClass="bg-v3-endeavour-100 border border-v3-border-card" name="endeavour-100" hex="#E3ECFB" />
            </TokenGrid>
          </V3Group>

          <V3Group title="Semantic scale — GRADE (10-step)" subtitle="การ์ด bg + พิลล์ badge + %-accent · C+ ใช้ตัวอักษรเข้ม #374151 (ยกเว้นคอนทราสต์)">
            <div className="grid gap-2 sm:grid-cols-2">
              {V3_GRADES.map((g) => (
                <div key={g.letter} className={`flex items-center gap-3 rounded-card p-3 ${g.bg}`}>
                  <span className="w-8 font-ibm text-[16px] font-bold text-v3-text-title">{g.letter}</span>
                  <span className={`rounded-chip px-3 py-1 font-ibm text-[13px] font-semibold ${g.badge} ${g.badgeText}`}>
                    {g.letter}
                  </span>
                  <span className="flex-1 font-ibm text-[13px] text-v3-text-body">{g.label}</span>
                  <span className={`font-poppins-v3 text-[15px] font-bold ${g.accent}`}>{g.pct}%</span>
                </div>
              ))}
            </div>
          </V3Group>

          <V3Group title="Semantic scale — CALENDAR (3-tier)" subtitle="โทนวันในปฏิทิน 3 ระดับ + วงแหวนมาร์กเกอร์ วันพระ">
            <TokenGrid>
              <Swatch chipClass="bg-v3-cal-good-bg" name="cal-good" hex="#0B7A8C" chipInner={<span className="font-ibm text-[14px] font-semibold text-v3-cal-good">≥60% วันดี</span>} />
              <Swatch chipClass="bg-v3-cal-medium-bg" name="cal-medium" hex="#B47E35" chipInner={<span className="font-ibm text-[14px] font-semibold text-v3-cal-medium">40–59%</span>} />
              <Swatch chipClass="bg-v3-cal-bad-bg" name="cal-bad" hex="#CD3D2E" chipInner={<span className="font-ibm text-[14px] font-semibold text-v3-cal-bad">&lt;40% ระวัง</span>} />
              <Swatch chipClass="bg-white border-2 border-v3-cal-marker" name="cal-marker" hex="#9D85DA" chipInner={<span className="font-ibm text-[13px] text-v3-text-body">วันพระ ring</span>} />
            </TokenGrid>
          </V3Group>

          <V3Group title="Element palette — 2 sets" subtitle="สว่าง = สีไอคอน/glyph · เข้ม = ชื่อธาตุบนพื้นขาว (WCAG ≥4.5:1)">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {V3_ELEMENTS.map((el) => (
                <div key={el.th} className="rounded-card border border-v3-border-card bg-white p-3">
                  <div className={`flex h-14 w-full items-center justify-center rounded-chip ${el.icon}`}>
                    <span className="font-ibm text-[13px] font-semibold text-white">icon</span>
                  </div>
                  <p className={`mt-2 font-ibm text-[16px] font-bold ${el.text}`}>{el.th}</p>
                  <p className="font-poppins-v3 text-[12px] text-v3-text-muted">{el.icon.replace("bg-v3-", "")} / {el.text.replace("text-v3-", "")}</p>
                </div>
              ))}
            </div>
          </V3Group>

          <V3Group title="Typography ramp" subtitle="ทุกระดับตัวอักษร แสดงเป็นบรรทัดจริง (ไทย+ละติน) พร้อม spec">
            <div className="flex flex-col gap-5">
              {V3_TYPE_RAMP.map((row) => (
                <Specimen key={row.spec} label={row.spec}>
                  <p className={row.cls}>{row.text}</p>
                </Specimen>
              ))}
            </div>
            <div className="mt-6 rounded-card border border-v3-border-card bg-white p-4">
              <p className="font-ibm text-[12px] leading-[18px] text-v3-text-muted">Font families</p>
              <p className="mt-2 font-ibm text-[16px] text-v3-text-title">IBM Plex Sans Thai — ดวงวันนี้อ่านง่าย Abc 123 (font-ibm · primary)</p>
              <p className="mt-1 font-poppins-v3 text-[16px] text-v3-text-title">Poppins — Latin buttons Abc 123 (font-poppins-v3)</p>
              <p className="mt-1 font-sans text-[16px] text-v3-text-title">Inter — Latin nav/numerals 0123456789 (system / font-sans)</p>
              <p className="mt-1 font-poppins text-[16px] text-v3-text-title">Noto Sans Thai — ดวงวันนี้ my-destiny only (font-poppins → Noto)</p>
              <p className="mt-1 font-chonburi text-[16px] text-v3-text-title">Chonburi — decorative single-use (font-chonburi)</p>
            </div>
          </V3Group>

          <V3Group title="Radius" subtitle="13 ระดับมุมโค้ง — พื้น sapphire">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {V3_RADII.map((r) => (
                <div key={r.label} className="flex flex-col items-center gap-2">
                  <div className={`h-16 w-16 bg-v3-sapphire ${r.cls}`} />
                  <span className="font-ibm text-[12px] text-v3-text-muted">{r.label}</span>
                </div>
              ))}
            </div>
          </V3Group>

          <V3Group title="Elevation" subtitle="เงาที่อนุญาตให้ใช้เท่านั้น — flat คือค่าเริ่มต้น">
            <div className="grid gap-4 sm:grid-cols-3">
              {V3_SHADOWS.map((s) => (
                <div key={s.label} className={`rounded-card bg-white p-5 ${s.cls}`}>
                  <span className="font-ibm text-[13px] font-semibold text-v3-text-body">{s.label}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 font-ibm text-[12px] leading-[18px] text-v3-text-muted">
              flat is default; these are the only sanctioned depth moments (DESIGN v3 §4)
            </p>
          </V3Group>

          <V3Group title="Spacing" subtitle="สเกลระยะห่าง 4–32px">
            <div className="flex flex-col gap-2">
              {V3_SPACES.map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-10 font-poppins-v3 text-[12px] text-v3-text-muted">{n}px</span>
                  <div className="h-4 rounded-chip bg-v3-sapphire" style={{ width: `${n}px` }} />
                </div>
              ))}
            </div>
          </V3Group>
        </div>
      </div>
    </div>
  );
}

function V3ComponentLibrary() {
  return (
    <div className="bg-v3-ghost-white" data-testid="design-v3-library">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
        <h2 className="font-chonburi text-[28px] leading-9 text-v3-navy">
          V3 Component Library
        </h2>
        <p className="mt-1 font-ibm text-[14px] leading-[22px] text-v3-text-body">
          คลังพรีมิทีฟ MuMate V3 พร้อมสถานะครบทุกตัว และเดโมการปรับแต่งตัวละครเฉพาะบุคคล
          (บนพื้น ghost-white)
        </p>

        <div className="mt-2 divide-y divide-v3-border-card">
          <V3Group title="Button" subtitle="5 variants: primary · secondary · tertiary · cta-cyan/sapphire · link (per-variant focus, icon gap 4)">
            <ButtonShowcase />
          </V3Group>
          <V3Group title="Input / Field" subtitle="Pill h52 · default · focus · filled · error">
            <InputShowcase />
          </V3Group>
          <V3Group title="Dropdown" subtitle="Radius 8 · native select · chevron / loading">
            <DropdownShowcase />
          </V3Group>
          <V3Group title="Checkbox" subtitle="24×24 · checked / unchecked / labeled / with description">
            <CheckboxShowcase />
          </V3Group>
          <V3Group title="Pill Tabs" subtitle="Segmented radiogroup · 2 variants: neutral (white-thumb+shadow) · calendar (sapphire-fill + lime-label)">
            <PillTabsShowcase />
          </V3Group>
          <V3Group title="Card" subtitle="Radius 16 · flat · optional 1px hairline">
            <CardShowcase />
          </V3Group>
          <V3Group
            title="Personalization / Mascot"
            subtitle="นักษัตร × ธาตุ → ตัวละคร (no-bg .png) + การ์ด (with-bg .jpg) ผ่าน pure builder"
          >
            <MascotDemo />
          </V3Group>
        </div>
      </div>
    </div>
  );
}

// CP-7 · Container primitives — the two full-viewport contracts every screen composes from. They
// can't render honestly inline (they OWN the viewport), so this catalogues each primitive's contract,
// the invariants it guarantees, a structure schematic, and WHICH harness gate proves it. The live
// invariant proof lives in the screen gate (a page IS a FullBleedScreen/AppScreen at full viewport).
function PrimitiveCard({
  name,
  role,
  guarantees,
  provenBy,
  proven,
  schematic,
  testid,
}: {
  name: string;
  role: string;
  guarantees: string[];
  provenBy: string;
  proven: boolean;
  schematic: ReactNode;
  testid: string;
}) {
  return (
    <div
      data-testid={testid}
      className="rounded-card border border-v3-border-card bg-white p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-prompt text-[18px] font-semibold text-v3-navy">{name}</h3>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 font-ibm text-[11px]",
            proven ? "bg-v3-sapphire text-v3-lime" : "border border-v3-border-input text-v3-text-muted",
          )}
        >
          {proven ? "✓ verified by gate" : "gate pending"}
        </span>
      </div>
      <p className="mt-1 font-ibm text-[13px] leading-5 text-v3-text-body">{role}</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-[168px_1fr]">
        <div className="flex items-center justify-center rounded-lg bg-v3-ghost-white p-3">{schematic}</div>
        <div>
          <p className="font-ibm text-[12px] font-semibold uppercase tracking-wide text-v3-text-muted">
            Guarantees
          </p>
          <ul className="mt-1 space-y-1">
            {guarantees.map((g) => (
              <li key={g} className="font-ibm text-[13px] leading-5 text-v3-text-body">
                • {g}
              </li>
            ))}
          </ul>
          <p className="mt-3 font-ibm text-[12px] leading-5 text-v3-text-muted">
            <span className="font-semibold">Proven by:</span> {provenBy}
          </p>
        </div>
      </div>
    </div>
  );
}

function V3ContainerPrimitives() {
  return (
    <div className="bg-v3-ghost-white" data-testid="design-container-primitives">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
        <h2 className="font-chonburi text-[28px] leading-9 text-v3-navy">
          Container Primitives
        </h2>
        <p className="mt-1 font-ibm text-[14px] leading-[22px] text-v3-text-body">
          พรีมิทีฟระดับหน้าจอ — ทุกหน้าเป็น <code>&lt;FullBleedScreen&gt;</code> หรือ{" "}
          <code>&lt;AppScreen&gt;</code> ไม่เคยประกอบเอง. คอนแทร็กต์ของคอนเทนเนอร์ + invariant ที่การันตี
          + gate ที่พิสูจน์ (proof อยู่ที่ screen gate เพราะพรีมิทีฟครองทั้ง viewport)
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <PrimitiveCard
            testid="primitive-fullbleed"
            name="FullBleedScreen"
            proven
            role="หน้าจอที่ครองทั้ง viewport — พื้นหลังเต็มจอ, เนื้อหาเป็นคอลัมน์กลางที่มีขอบเขต (onboarding / login / register)"
            guarantees={[
              "bg object-fit:cover ทุกความกว้าง — ไม่เคยยืด (invariant, ไม่ใช่ช่วง)",
              "content = centered column capped ที่ contentMaxWidth",
              "responsive 320 → 1280+ (bg เต็มจอ, content กลางบนจอกว้าง)",
              "safe-area top/bottom ผ่าน contentClassName",
            ]}
            provenBy="splash /v2 screen gate — bg-aspect + top/bottom-inset anchors + teeth (mut-objectfit-fill / mut-no-top-pad / mut-hero-uncapped) ✓"
            schematic={
              <div className="relative h-[120px] w-[72px] overflow-hidden rounded-md bg-gradient-to-b from-[#FBEFE6] via-[#F7E9F0] to-[#DCEBFB] ring-1 ring-v3-border-card">
                <div className="absolute inset-x-[14px] top-2 bottom-2 rounded-sm border border-dashed border-v3-sapphire/50 bg-white/30" />
                <span className="absolute inset-x-0 bottom-0 text-center font-ibm text-[8px] text-v3-text-muted">
                  bg + centered col
                </span>
              </div>
            }
          />
          <PrimitiveCard
            testid="primitive-appscreen"
            name="AppScreen → AppShell"
            proven={false}
            role="หน้าจอภายในแอป — คอลัมน์กลาง max-width + Menubar ล่าง (home / service / calendar / shop)"
            guarantees={[
              "centered bounded column (max-width)",
              "bottom Menubar chrome (AppShell)",
              "safe-area insets — เนื้อหาไม่ชนขอบ",
              "named contract ที่ระดับหน้า (page อ่านออกทันทีว่าเป็นคอนเทนเนอร์ไหน)",
            ]}
            provenBy="pending — slice-2 home-hub screen gate (contract += AppScreen anchors; engine untouched)"
            schematic={
              <div className="relative h-[120px] w-[72px] overflow-hidden rounded-md bg-white ring-1 ring-v3-border-card">
                <div className="absolute inset-x-[10px] top-2 bottom-[22px] rounded-sm border border-dashed border-v3-sapphire/50 bg-v3-ghost-white" />
                <div className="absolute inset-x-0 bottom-0 h-[18px] bg-v3-nav-dark" />
                <span className="absolute inset-x-0 bottom-[3px] text-center font-ibm text-[7px] text-v3-lime">
                  menubar
                </span>
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <>
      <Head>
        <title>MuMate Design System</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <main
        data-testid="design-showcase"
        className="min-h-screen bg-[#F2F7FD] pb-10 text-moumate_black"
      >
        <header className="bg-moumate_blue px-4 py-4 text-white">
          <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                alt="MuMate"
                className="h-[32px] w-auto"
                src="/images/mumate/ic_logo.svg"
              />
              <div>
                <h1 className="font-prompt text-[20px] font-semibold">
                  Design Foundation
                </h1>
                <p className="font-ibm text-[13px] text-white/85">
                  Brownfield MuMate FE
                </p>
              </div>
            </div>
            <span className="rounded-full bg-white/15 px-3 py-1 font-ibm text-[12px]">
              dev-only
            </span>
          </div>
        </header>


        <V3FoundationTokens />
        <V3ComponentLibrary />
        <V3ContainerPrimitives />
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === "production") {
    return {
      notFound: true,
    };
  }

  return {
    props: {},
  };
};

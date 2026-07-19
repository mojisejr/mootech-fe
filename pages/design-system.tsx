import type { GetServerSideProps } from "next";
import type { ReactNode } from "react";
import { useState } from "react";
import Head from "next/head";
import Image from "next/image";

import SkeletonRow from "@/components/ui/skeleton-row";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { PillTabs } from "@/components/ui/pill-tabs";
import { ZODIAC_TABLE, buildMascotPaths } from "@/lib/personalization";

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
      <Specimen label="Full · default">
        <Button>เริ่มดูดวงกับ MuMate</Button>
      </Specimen>
      <Specimen label="Full · hover → พื้น #10427F (ชี้เมาส์เพื่อดู)">
        <Button>เริ่มดูดวงกับ MuMate</Button>
      </Specimen>
      <Specimen label="Full · disabled">
        <Button disabled>เริ่มดูดวงกับ MuMate</Button>
      </Specimen>
      <Specimen label="Full · loading">
        <Button loading>กำลังทำนาย</Button>
      </Specimen>
      <Specimen label="Small · default">
        <Button size="small">ดูเพิ่มเติม</Button>
      </Specimen>
      <Specimen label="Small · disabled">
        <Button size="small" disabled>
          ดูเพิ่มเติม
        </Button>
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
  return (
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
          <V3Group title="Button" subtitle="Pill · UPPERCASE · full + small">
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
          <V3Group title="Pill Tabs" subtitle="Segmented radiogroup · selected carries the §4 shadow exception">
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

        <Section title="Token Probes">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {colorTokens.map((token) => (
              <TokenSwatch key={token.name} token={token} />
            ))}
          </div>
        </Section>

        <Section title="Typography">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              data-testid="design-type-ibm"
              className="rounded-[24px] border border-border_gray bg-white p-5 font-ibm shadow-custom"
            >
              <p className="text-[13px] text-moumate_gray">
                IBM Plex Sans Thai
              </p>
              <p className="mt-3 text-[24px] font-semibold text-moumate_black">
                ดวงวันนี้อ่านง่ายและนุ่มนวล
              </p>
              <p className="mt-2 text-[15px] leading-7 text-moumate_gray">
                ตัวอักษรหลักสำหรับฟอร์ม รายละเอียด และพื้นที่ที่ต้องอ่านซ้ำ
              </p>
            </div>
            <div
              data-testid="design-type-prompt"
              className="rounded-[24px] border border-border_gray bg-white p-5 font-prompt shadow-custom"
            >
              <p className="text-[13px] text-moumate_gray">Prompt</p>
              <p className="mt-3 text-[24px] font-semibold text-moumate_black">
                FirstMate FlexiMate Soulmate
              </p>
              <p className="mt-2 text-[15px] leading-7 text-moumate_gray">
                ใช้กับ landing, package, CTA และจังหวะที่ต้องมี brand voice
              </p>
            </div>
          </div>
        </Section>

        <Section title="Buttons And Pills">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <SoftCard>
              <div className="grid gap-3">
                <PrimaryCTA>เริ่มดูดวงกับ MuMate</PrimaryCTA>
                <div className="flex flex-wrap gap-2">
                  <PillCTA>ความรัก</PillCTA>
                  <PillCTA>การงาน</PillCTA>
                  <PillCTA>โชคลาภ</PillCTA>
                </div>
              </div>
            </SoftCard>
            <div className="rounded-[24px] border border-border_gray bg-white p-5 shadow-custom">
              <h3 className="font-prompt text-[18px] font-semibold">
                Package Shell
              </h3>
              <div className="mt-4 rounded-[20px] border border-moumate_blue bg-moumate_blue_light p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-prompt text-[20px] font-semibold text-moumate_blue">
                      FlexiMate
                    </p>
                    <p className="font-ibm text-[14px] text-moumate_gray">
                      พื้นผิว package แบบนุ่มและอ่านง่าย
                    </p>
                  </div>
                  <span className="rounded-full bg-moumate_blue px-3 py-1 font-prompt text-[12px] text-white">
                    popular
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section title="Surfaces And Inputs">
          <div className="grid gap-4 md:grid-cols-2">
            <SoftCard>
              <div className="rounded-[20px] bg-white/70 p-4">
                <div className="flex items-center gap-3">
                  <img
                    alt=""
                    aria-hidden="true"
                    className="h-[56px] w-[56px]"
                    src="/images/icons/image_mascot_package.svg"
                  />
                  <div>
                    <h3 className="font-prompt text-[18px] font-semibold">
                      Glass Surface
                    </h3>
                    <p className="font-ibm text-[14px] text-moumate_gray">
                      white alpha, blur, shadow, rounded shape
                    </p>
                  </div>
                </div>
              </div>
            </SoftCard>
            <div className="rounded-[24px] border border-border_gray bg-white p-5 shadow-custom">
              <FieldSample />
            </div>
          </div>
        </Section>

        <Section title="Skeleton And Chat">
          <div className="grid gap-4 md:grid-cols-2">
            <div
              data-testid="primitive-skeleton-row"
              className="rounded-[24px] border border-border_gray bg-white p-5 shadow-custom"
            >
              <SkeletonRow count={3} />
            </div>
            <div className="overflow-hidden rounded-[24px] bg-chat_surface text-white shadow-custom">
              <div className="bg-gradient-to-r from-chat_header_from to-chat_header_to p-4">
                <p className="font-prompt text-[18px] font-semibold">
                  MuMate Chat
                </p>
                <p className="font-ibm text-[13px] text-white/85">
                  chat_surface + chat_header tokens
                </p>
              </div>
              <div className="grid gap-3 p-4 font-ibm text-[14px]">
                <p className="w-[82%] rounded-[18px] bg-white/15 p-3">
                  วันนี้เหมาะกับการจัดระบบให้ใจเบาขึ้น
                </p>
                <p className="ml-auto w-[68%] rounded-[18px] bg-chat_bubble_user p-3">
                  แล้วเรื่องงานล่ะ?
                </p>
              </div>
            </div>
          </div>
        </Section>

        <V3ComponentLibrary />
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

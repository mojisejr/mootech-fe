import Head from "next/head";
import Image from "next/image";
import type { CSSProperties } from "react";
import { PRIVACY_POLICY, thaiLongDate, type PolicySection } from "@/constants/privacy-policy";

const sectionStyle: CSSProperties = {
  marginBottom: "1.5rem",
};

export default function PrivacyPolicyPage() {
  return (
    <div
    className='w-full bg-white min-h-screen  flex justify-center h-fit font-ibm'
    >
      <Head>
        <title>Privacy Policy | Mumate</title>
        <meta
          name="description"
          content="Learn how MooTech collects, uses, and protects your data."
        />
      </Head>
      

      <div className="w-full flex flex-wrap"> 
        <div className="w-full bg-moumate_blue h-[72px] flex justify-center items-center z-50 fixed top-0 left-0">
            <div className="flex  w-[110px] cursor-pointer">
                <Image
                  className=""
                  alt="mootech-icon"
                  src={'/images/mumate/ic_logo.svg'}
                  width={110}
                  height={26}
                />
            </div>
        </div>

        <div className="w-full min-h-full bg-cover bg-center pt-[72px]">
          <main style={{ padding: "2rem", maxWidth: 960, margin: "0 auto" }}>

            <h1 style={{ marginBottom: "1.5rem" }}>{PRIVACY_POLICY.title}</h1>
            <p style={{ marginBottom: "1.5rem" }}>{PRIVACY_POLICY.intro}</p>

            {/* เนื้อหาทั้งหมดมาจาก constants/privacy-policy.ts ที่เดียว (CIEL mumate-pdpa-reconsent-001) */}
            {PRIVACY_POLICY.sections.map((sec: PolicySection) => (
              <section key={sec.id} id={sec.id} style={sectionStyle}>
                <h2>{sec.title}</h2>
                {sec.intro ? <p>{sec.intro}</p> : null}
                {sec.items ? (
                  <ul>
                    {sec.items.map((it) => (
                      <li key={it.text}>
                        {it.lead ? <strong>{it.lead}</strong> : null}
                        {it.lead ? " " : null}
                        {it.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {sec.outro ? <p>{sec.outro}</p> : null}
              </section>
            ))}

            <p style={{ fontStyle: "italic" }} data-testid="policy-version">
              ฉบับ {PRIVACY_POLICY.version} · มีผลตั้งแต่ {thaiLongDate(PRIVACY_POLICY.effectiveDate)}
            </p>
          </main>
        </div>
      </div>
    </div>
  );
}

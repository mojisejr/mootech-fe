import WhatIfExperience from "@/components/what-if/what-if-experience";
import Head from "next/head";

export default function WhatIfPage() {
  return (
    <>
      <Head>
        <title>What If...? โลกคู่ขนานของคุณ | MuMate</title>
        <meta
          name="description"
          content="เปิดโลกคู่ขนานของคุณกับ MuMate แล้วดูว่าเส้นทางชีวิตอีกมิติจะเป็นอย่างไร"
        />
      </Head>
      <WhatIfExperience />
    </>
  );
}

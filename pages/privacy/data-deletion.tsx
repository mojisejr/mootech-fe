import Head from "next/head";
import Image from "next/image";
import type { CSSProperties } from "react";

const sectionStyle: CSSProperties = {
  marginBottom: "1.5rem",
};

export default function PrivacyPolicyPage() {
  return (
    <div
    className='w-full bg-white min-h-screen  flex justify-center h-fit font-ibm'
    >
      <Head>
        <title>Data Deletion | Mumate</title>
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

            <h1 style={{ marginBottom: "1.5rem" }}>การลบข้อมูลผู้ใช้ (User Data Deletion Policy)</h1>
            <p style={{ marginBottom: "1.5rem" }}>
              Mumate (“เรา”) เคารพสิทธิของผู้ใช้งานทุกท่านในการจัดการข้อมูลส่วนบุคคลของตนเอง หากคุณต้องการลบข้อมูลที่เราเก็บไว้ คุณสามารถดำเนินการได้ดังนี้:
            </p>

            <ul>
              <li>ส่งคำขอผ่านอีเมล: <strong>mumatedev@gmail.com</strong></li>
              <li>ระบุข้อมูลบัญชีหรืออีเมลที่ใช้ในการเข้าสู่ระบบ</li>
              <li>เมื่อเราได้รับคำขอแล้ว จะดำเนินการลบข้อมูลของคุณออกจากระบบภายใน <strong>7 วันทำการ</strong></li>
            </ul>

            <p>หมายเหตุ: การลบข้อมูลอาจทำให้คุณไม่สามารถเข้าใช้งานบริการบางส่วนหรือทั้งหมดได้อีกต่อไป</p>

            <p>หากมีข้อสงสัย กรุณาติดต่อเราได้ที่ <strong><a href="mail:mumatedev@gmail.com">mumatedev@gmail.com</a></strong></p>

          </main>
        </div>
      </div>
    </div>
  );
}

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

            <h1 style={{ marginBottom: "1.5rem" }}>นโยบายความเป็นส่วนตัว (Privacy Policy)</h1>
            <p style={{ marginBottom: "1.5rem" }}>
              Mumate (“เว็บไซต์”, “เรา”) ให้ความสำคัญกับความเป็นส่วนตัวและการปกป้องข้อมูลส่วนบุคคลของผู้ใช้งาน (“คุณ”) นโยบายนี้อธิบายถึงวิธีการที่เราเก็บ ใช้ เก็บรักษา และเปิดเผยข้อมูลของคุณ เมื่อคุณเข้าใช้งานเว็บไซต์ดูดวงและบริการของเรา รวมถึงการล็อกอินผ่านเครือข่ายสังคมออนไลน์ (Social Network)
            </p>

            <section style={sectionStyle}>
              <h2>1. ข้อมูลที่เราเก็บรวบรวม</h2>
              <ul>
                <li><strong>ข้อมูลบัญชี:</strong> เช่น ชื่อ อีเมล รูปโปรไฟล์ ที่ได้รับจาก Social Network (Google, Facebook, Line ฯลฯ)</li>
                <li><strong>ข้อมูลการใช้งาน:</strong> เช่น การเข้าหน้าเว็บ การใช้งานฟีเจอร์ วัน-เวลาในการใช้งาน</li>
                <li><strong>ข้อมูลอุปกรณ์:</strong> เช่น ประเภทอุปกรณ์ เบราว์เซอร์ ที่อยู่ IP</li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2>2. วัตถุประสงค์ในการใช้ข้อมูล</h2>
              <ul>
                <li>ยืนยันตัวตนและให้บริการล็อกอินผ่าน Social Network</li>
                <li>แสดงผลบริการดูดวงตามที่คุณเลือกใช้งาน</li>
                <li>ปรับปรุงประสบการณ์ใช้งานเว็บไซต์และพัฒนาบริการ</li>
                <li>ติดต่อสื่อสารกับคุณ เช่น การแจ้งข่าวสารหรือโปรโมชั่น (หากคุณสมัครใจรับข่าวสาร)</li>
                <li>ปฏิบัติตามข้อกฎหมายและข้อกำหนดที่เกี่ยวข้อง</li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2>3. การเก็บรักษาข้อมูล</h2>
              <p>ข้อมูลของคุณจะถูกจัดเก็บอย่างปลอดภัยบนระบบที่มีมาตรการป้องกันที่เหมาะสม และจะเก็บรักษาตราบเท่าที่จำเป็นต่อวัตถุประสงค์ที่ระบุไว้ หรือเท่าที่กฎหมายกำหนด</p>
            </section>

            <section style={sectionStyle}>
              <h2>4. การเปิดเผยข้อมูลต่อบุคคลที่สาม</h2>
              <ul>
                <li>ต่อผู้ให้บริการด้านเทคโนโลยี (เช่น ระบบคลาวด์, ระบบวิเคราะห์ข้อมูล) เพื่อสนับสนุนการให้บริการ</li>
                <li>ต่อหน่วยงานราชการหรือหน่วยงานกำกับดูแล หากกฎหมายกำหนด</li>
                <li><strong>เราจะไม่ขาย แลกเปลี่ยน หรือให้เช่าข้อมูลส่วนบุคคล</strong> ของคุณแก่บุคคลที่สามเพื่อวัตถุประสงค์ทางการตลาดโดยไม่ได้รับความยินยอม</li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2>5. สิทธิของเจ้าของข้อมูล</h2>
              <ul>
                <li>ขอเข้าถึงและรับสำเนาข้อมูลของคุณ</li>
                <li>ขอแก้ไขข้อมูลที่ไม่ถูกต้อง</li>
                <li>ขอให้ลบหรือทำลายข้อมูลเมื่อไม่มีความจำเป็นต้องเก็บอีกต่อไป</li>
                <li>ถอนความยินยอมในการใช้ข้อมูล (อาจมีผลต่อการใช้งานบางฟีเจอร์ เช่น การล็อกอิน)</li>
              </ul>
            </section>

            <section style={sectionStyle}>
              <h2>6. คุกกี้ (Cookies) และเทคโนโลยีติดตาม</h2>
              <p>เว็บไซต์อาจใช้คุกกี้หรือเทคโนโลยีติดตามเพื่อจดจำการตั้งค่า วิเคราะห์การใช้งาน และปรับปรุงประสบการณ์ของคุณ คุณสามารถตั้งค่าเบราว์เซอร์เพื่อปฏิเสธคุกกี้บางประเภทได้</p>
            </section>

            <section style={sectionStyle}>
              <h2>7. การเปลี่ยนแปลงนโยบายความเป็นส่วนตัว</h2>
              <p>เราอาจปรับปรุงนโยบายนี้เป็นครั้งคราว หากมีการเปลี่ยนแปลงสำคัญ เราจะแจ้งให้คุณทราบทางเว็บไซต์</p>
            </section>

            <section style={sectionStyle}>
              <h2>8. ช่องทางติดต่อ</h2>
              <p>หากคุณมีคำถาม ข้อเสนอแนะ หรือข้อร้องเรียนเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อเราได้ที่:</p>
              <ul>
                <li>อีเมล: mumatedev@gmail.com</li>
              </ul>
            </section>


            <p style={{ fontStyle: "italic" }}>Last updated: {new Date().getFullYear()}</p>
          </main>
        </div>
      </div>
    </div>
  );
}

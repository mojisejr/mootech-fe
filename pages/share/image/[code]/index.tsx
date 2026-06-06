import Image from "next/image";
import { useRouter } from "next/router";
import Head from "next/head";
import html2canvas from 'html2canvas';

export default function ShareProfilePage() {
  const router = useRouter();
 const handleExport = async () => {
    const element = document.getElementById('capture-area');
    if (!element) return;

    const canvas = await html2canvas(element, {
      useCORS: true,
      scale: 1,
    });

    const dataURL = canvas.toDataURL('image/jpeg', 1.0);
    const a = document.createElement('a');
    a.href = dataURL;
    a.download = 'mumate_result.jpg';
    a.click();
  };
   
return (
    <div className="w-full min-h-screen font-ibm flex flex-col items-center bg-gray-900 text-white">
      <Head>
        <title>Mumate</title>
      </Head>

      {/* 🔘 ปุ่ม Save รูป */}
      <button
        onClick={handleExport}
        className="mt-4 px-6 py-2 bg-white text-black rounded shadow"
      >
        📸 Save as JPEG
      </button>

      {/* 🖼️ Layout ที่จะ capture */}
      <div
        id="capture-area"
        className="relative mt-6"
        style={{
          width: '1080px',
          height: '1920px',
          transform: 'scale(0.4)',
          transformOrigin: 'top left',
          backgroundImage: "url('/images/mumate/img_bg_home.jpg')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',  left: '-9999px', 
        }}
      >
        {/* Logo fixed */}
        <div className="absolute top-0 left-0 w-full flex justify-center pt-8 z-50">
          <Image
            alt="mootech-icon"
            src="/images/mumate/ic_logo.svg"
            width={400}
            height={95}
          />
        </div>

        {/* Main Content */}
        <div className="w-full h-full pt-40 flex flex-col items-center px-12">
          <Image
            src="/mascot/attachment1.png"
            width={700}
            height={1236}
            className="rounded-[24px] shadow-xl"
            alt="icon-result"
          />

          <span className="text-white text-center text-[56px] font-normal mt-24 leading-[1.4]">
            เคลื่อนไหวไว ไหวพริบดี มักระวังตัวและไม่ประมาท ชอบสังเกตและจับจังหวะก่อนลงมือ ชินกับการทำงานหรือใช้ชีวิตในช่วงกลางคืน รู้จักเลือกอยู่ในที่ที่ปลอดภัย และมีนิสัยชอบสะสมหรือเตรียมสำรองไว้ล่วงหน้าเสมอ
          </span>

          <div className="w-full flex justify-left">
            <span className="text-white text-start text-[36px] font-normal mt-12">
              ค้นหาตัวเองได้ที่ IG : @mumate.co
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

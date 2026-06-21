"use client";
import Menu from '@/components/menu';
import { PageRouter } from '@/constants/router';
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useState } from "react";


const REASON_MESSAGES: Record<string, string> = {
  timeout: 'หมดเวลาชำระเงิน กรุณาทำรายการใหม่อีกครั้ง',
  declined: 'บัตรของคุณถูกปฏิเสธ กรุณาตรวจสอบข้อมูลหรือลองช่องทางอื่น',
  card: 'บัตรของคุณถูกปฏิเสธ กรุณาตรวจสอบข้อมูลหรือลองช่องทางอื่น',
};

const DEFAULT_MESSAGE = 'ไม่สามารถดำเนินการชำระเงินได้ กรุณาลองใหม่อีกครั้ง';


export default function PaymentFailurePage() {

  const router = useRouter();
  const [isShowMenu, setIsShowMenu] = useState<boolean>(false);

  const reason = (router.query.reason as string) || '';
  const reasonMessage = REASON_MESSAGES[reason] || DEFAULT_MESSAGE;

  const onClickRetry = () => {
    router.push(PageRouter.PAYMENT_SELECT_CHANNEL);
  };

  const onClickHome = () => {
    router.push(PageRouter.HOME);
  };

  return (
    <div
      className="w-full bg-[#F2F7FD] min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full block flex-wrap">
        <div className='w-full relative'>
          <div className='w-full z-50 bg-moumate_blue fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
            <div className='w-fit flex flex-none'>
              <Image
                src={isShowMenu ? '/images/icons/x.svg' : '/images/mumate/ic_menu.svg'}
                width={32}
                height={32}
                onClick={() => { setIsShowMenu(!isShowMenu) }}
                className=' cursor-pointer '
                alt='icon-menu' />
            </div>

            <div className='w-full grow flex pl-4'>
              <Image
                src={'/images/mumate/ic_logo.svg'}
                width={103}
                height={24}
                alt='icon-app' />
            </div>
          </div>

          {
            isShowMenu ?
              <div className=' w-full flex flex-wrap absolute top-0 left-0 z-50 '>
                <Menu is_show={isShowMenu} />
              </div>
              :
              null
          }
        </div>

        <div className='w-full flex flex-wrap justify-center'>
          <div
            className="flex bg-[#F2F7FD] justify-center min-h-screen w-fit h-full flex-wrap mt-[60px] lg:mt-[60px] pb-[90px]">
            <div className="w-full lg:w-full md:px-0 pt-[60px] md:pb-0 flex-wrap">
              <div className='w-full flex flex-wrap items-start pb-[100px] px-[32px] md:px-0'>

                <div className='w-full md:w-[500px] lg:w-[500px] mx-auto flex flex-wrap'>
                  <div
                    className=' w-full bg-white flex flex-wrap py-8 px-8 rounded-[32px] shadow-custom'>

                    <div className='w-full flex flex-wrap justify-center'>
                      <div className='w-[72px] h-[72px] rounded-full bg-moumate_red/10 flex items-center justify-center'>
                        <span className='text-moumate_red text-[40px] leading-none font-semibold'>!</span>
                      </div>
                    </div>

                    <span className='w-full flex flex-wrap justify-center text-center text-moumate_red text-[28px] font-semibold mt-6'>
                      ชำระเงินไม่สำเร็จ
                    </span>

                    <span className='w-full flex flex-wrap justify-center text-center text-[#444444] text-[16px] mt-3'>
                      {reasonMessage}
                    </span>

                    <div className='w-full flex flex-wrap mt-8'>
                      <button
                        onClick={onClickRetry}
                        className='w-full bg-moumate_blue cursor-pointer rounded-[40px] py-[16px] px-[24px]'
                      >
                        <span className='w-full flex justify-center text-white font-medium'>ลองชำระเงินอีกครั้ง</span>
                      </button>
                    </div>

                    <div className='w-full flex flex-wrap mt-4'>
                      <span
                        onClick={onClickHome}
                        className='w-full cursor-pointer flex justify-center text-moumate_blue underline'
                      >
                        กลับสู่หน้าแรก
                      </span>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

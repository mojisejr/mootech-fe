"use client";
import HeaderMuMate from '@/components/header-v2';
import { PaymentRetrieveApi } from '@/constants/api/api-payment-retrieve';
import { PageRouter } from '@/constants/router';
import Head from "next/head";
import Image from "next/image";
import { useRouter } from 'next/router';
import { useEffect } from 'react';


export default function PaymentCallbackPage() {

  const router = useRouter()



  useEffect(() => {
    if (router.query) {
       const { chargeId } = router.query
       if (chargeId) {
          callCallback(chargeId)
       }
    }
  },[router.query])


  const callCallback = async (chargeId: any) => {
    const result = await PaymentRetrieveApi(
      chargeId
    )
    if (result) {
      router.replace(PageRouter.PAYMENT_THANKYOU)
    }
  }
  

  return (
    <div 

    className="w-full bg-[#F2F7FD]  min-h-screen flex justify-center h-fit font-prompt">
      <Head>
        <title>Mumate</title>
      </Head>

      <div className="w-full block  flex-wrap">
        <div className='w-full flex flex-wrap'>
          <HeaderMuMate isShowMenu={false} isLogin={false} image={''}  />
        </div>


        <div className='w-full flex flex-wrap justify-center'>
            <div 
            className="flex bg-[#F2F7FD] justify-center  w-fit  h-full flex-wrap mt-[60px] lg:mt-[60px]">
              <div className="w-full  lg:w-full   pt-[60px] flex-wrap">
                <div className='w-full flex flex-wrap items-start'>


                </div>


                
              </div>
            </div>

       


        </div>

      </div>


    </div>
  );
}

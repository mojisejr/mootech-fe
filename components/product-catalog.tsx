import { useEffect, useState } from 'react'
import Image from "next/image";
import { ProductGet } from '@/constants/api/api-product-get';


type ComponentProps = {
  element: string
}

const ProductCatalog = ({ element }: ComponentProps) => {


  const [products, setProducts] = useState<any[]>([])
 

    useEffect(() => {

      if (element && element != '') {
        callGetProduct(element)
      }

    }, [element])



  const callGetProduct = async (element: string) => {

    const result = await ProductGet(
      'PROFILE', element, null
    )
    if (result) {
      setProducts(result)
    }
  }

  return (
      <div className={
        (products && products.length > 0 ? ' flex ' : ' hidden ') + 
        " w-full  flex-wrap p-[24px] " +
        "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom"
      }>
        <div className='w-full  flex-wrap'>
          <div className='w-full flex flex-nowrap items-center'>
            <div className='w-fit flex-none'>
                <Image
                  className=""
                  alt="mootech-box"
                  src={'/images/mumate/ic_box_7.svg'} 
                  width={32}
                  height={32}
                />
            </div>
            <div className='w-full grow pl-[8px]'>
              <span className='  text-moumate_blue text-[16px] font-bold'>ของเสริมดวง</span>
            </div>
          </div>
          <div className='w-full flex flex-wrap items-center mt-[12px]'>


            <div className='w-full flex flex-nowrap lg:grid lg:grid-cols-3 gap-4 overflow-y-auto lg:overscroll-y-none'>
                {
                  products?.map(function(item, index){
                    return (
                      <div
                      key={index}
                      className='w-[210px] lg:w-full rounded-[16px] p-4 bg-white '
                      >

                        <div className='w-[210px] lg:w-full flex flex-wrap'>
                              <Image
                                className=""
                                alt="mootech-box"
                                src={item.image} 
                                width={176}
                                height={112}
                              />
                        </div>

                        <div className='w-full flex flex-wrap mt-4'>
                          <span className=' text-black text-[18px] font-semibold'>
                            {item.name}
                          </span>
                        </div>

                        <div className='w-full flex flex-wrap mt-4'>
                          <span className=' text-moumate_gray'>
                            {item.description}
                          </span>
                        </div>

                        <div className='w-full flex flex-wrap mt-4'>
                          <a 
                            className='w-fit'
                            href={item.url} 
                            target='_blank'
                            rel="noopener noreferrer"> 
                            <span className='  cursor-pointer text-moumate_blue font-bold'>
                              ซื้อเลย
                            </span>
                          </a>
                        </div>


                      </div>

                    )
                  })
                }
            </div>


          </div>
        </div>
       
      </div>
  )
}

export default ProductCatalog

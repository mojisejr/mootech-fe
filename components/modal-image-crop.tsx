import { getCroppedImg } from '@/utils/cropImage';
import Image from 'next/image'
import { useState, useRef, useCallback, useEffect } from 'react';
import { saveAs } from 'file-saver';
import Cropper from 'react-easy-crop';
import { callApiUpload } from '@/utils/fetch';
import { API } from '@/constants/api/endpoint';
import { UserUpdateProfilePic } from '@/constants/api/api-user-update-profile-pic';
import { MemberWithFriendUpdateApi } from '@/constants/api/api-member-with-friend-update';

type ComponentProps = {
  customerId: any,
  imageSrc: any,
  cancel: any,
  submit: any,
  is_friend: any
}
const ModalImageCrop = ({
  customerId,
  imageSrc,
  cancel,
  submit,
  is_friend = false
}: ComponentProps) => {


    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const sliderRef = useRef<HTMLInputElement>(null);
    const [rotation, setRotation] = useState(0);

    useEffect(() => {
      const updateSliderBg = () => {
        const percent = ((zoom - 1) / 2) * 100;
        sliderRef.current?.style.setProperty('--value', `${percent}%`);
        // แก้ background ด้วย JS โดยตรง (backup)
        sliderRef.current?.style.setProperty(
          'background',
          `linear-gradient(to right, #1B9AAF 0%, #1B9AAF ${percent}%, #E5E7EB ${percent}%, #E5E7EB 100%)`
        );
      };

      updateSliderBg();
    }, [zoom]);

    const onCropComplete = useCallback((croppedArea: any, croppedPixels: any) => {
      setCroppedAreaPixels(croppedPixels);
    }, []);
  
    const handleSave = async () => {
      if (!imageSrc || !croppedAreaPixels) return;
      const file = await getCroppedImg(imageSrc, croppedAreaPixels, rotation);
      // saveAs(file, 'cropped-image.png');
      uploadPicture(file)
    };




  const uploadPicture = async (blob: any) => {
    let fileOriginal = (blob)
    if(fileOriginal && fileOriginal != null) {
      // setIsLoading(true)


        const f = new File([blob], 'signature.png', { type: 'image/png' });
        const formData = new FormData();
        formData.append("file", f);
        const response = await callApiUpload(
          API.object_storage.upload, 
          'POST', 
          '',
          formData,
          );
        if (response.s3_key) {
          if (customerId) {
            const resultImg:any = await callApiUpdateProfilePic(customerId, response.s3_key);
            if (resultImg && resultImg.user_id) {
                submit(resultImg.picture_url)
            }
          } else {
            submit(response.s3_key)
          }
        }
        
      
    }
  }


  const callApiUpdateProfilePic = async (user_id: string, url: string) => {
    if (is_friend == true) {
      const result = await MemberWithFriendUpdateApi(user_id, url);
      if (result) {
        return result;
      }
    } else {
      const result = await UserUpdateProfilePic(user_id, url);
      if (result) {
        return result;
      }
    }
  }

  return (
    <div
      className={'  fixed z-[9999] inset-0 overflow-y-auto  '}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex  items-center md:items-end justify-center h-full md:h-fit  lg:max-h-screen pt-4 px-4 md:px-12 lg:px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed inset-0 bg-black backdrop-blur-[10px] bg-opacity-[0.48] transition-opacity"
          aria-hidden="true"
        ></div>

        <span className="hidden sm:inline-block align-middle h-screen" aria-hidden="true">
          &#8203;
        </span>

        <div className=" w-full  lg:w-[580px] inline-block bg-white rounded-xl   overflow-hidden shadow-box transform transition-all  align-middle">
          <div className="w-full flex flex-wrap py-[26px] px-6">
                 <div className="w-full flex flex-wrap justify-end">
                         <Image
           
                          onClick={() => { cancel() }}
                           alt="ic_alert_success"
                           src={'/images/mumate/x-mark.svg'}
                           width={24}
                           className=' cursor-pointer '
                           height={24}
                         /> 
                       </div>
           
            <div className=" grow w-full flex flex-wrap ">
             
              <span
                className={
                  ' text-center  ' +
                  ' flex justify-center  w-full text-[24px] font-ibm  text-moumate_blue  mt-4 font-semibold'
                }
              >
                Edit Profile Photo
              </span>
              <div className='w-full flex flex-wrap'>
                        <div className="flex flex-col justify-center w-full items-center gap-4 p-4">
                        
                          {imageSrc && (
                            <div className="relative w-full h-[344px] bg-gray-100 rounded overflow-hidden">
                              <Cropper
                                image={imageSrc}
                                crop={crop}
                                zoom={zoom}
                                aspect={1}
                                rotation={rotation}
                                onCropChange={setCrop}
                                onZoomChange={setZoom}
                                onCropComplete={onCropComplete}
                              />
                            </div>
                          )}

                          {imageSrc && (

                                <div className="flex flex-wrap justify-center gap-2 items-center w-full ">

                                      <div className='w-fit flex'>
                                                <Image
                                                onClick={() => setRotation((prev) => (prev - 90 + 360) % 360)}
                                                  src={'/images/mumate/ic_rotate_left.svg'}
                                                  width={40}
                                                  height={40}
                                                  className=' cursor-pointer '
                                                  alt=''/>
                                      </div>
                                      <div className="flex flex-col items-center w-fit gap-2">
                                              <div className="flex border border-gray-200 py-[16px] px-[16px] items-center gap-2  bg-white rounded-[40px]">
                                              
                                                <Image
                                                  onClick={() => setZoom((z) => Math.max(1, z - 0.1))}
                                                  src={'/images/mumate/ic_zoom_in.svg'}
                                                  width={32}
                                                  height={32}
                                                  className=' cursor-pointer '
                                                  alt=''/>

                              <input
  ref={sliderRef}
  type="range"
  min={1}
  max={3}
  step={0.1}
  value={zoom}
  onChange={(e) => setZoom(Number(e.target.value))}
  className="slider"
/>

                                                <Image
                                                  onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                                                  src={'/images/mumate/ic_zoom_out.svg'}
                                                  width={32}
                                                  height={32}
                                                  className=' cursor-pointer '
                                                  alt=''/>
                                              </div>
                                      </div>
                                      <div className='w-fit flex'>
                                                <Image
                                                  onClick={() => setRotation((prev) => (prev + 90) % 360)}
                                                  src={'/images/mumate/ic_rotate_right.svg'}
                                                  width={40}
                                                  height={40}
                                                  className=' cursor-pointer '
                                                  alt=''/>
                                      </div>
                                </div>

                            
                          )}
                        </div>
              </div>
            

            </div>

          <div className="w-full flex  gap-2 py-4  px-4 justify-center">
                   <button
                      onClick={() => {  cancel() }}
                      className={
                        (  ' bg-white ' ) + 
                        "w-full  rounded-[16px] py-[16px] px-[16px]  mt-2 text-black border-black border justify-center"}
                    >
                     ยกเลิก
                    </button>

              
                    <button
                      onClick={() => {  handleSave() }}
                      className={
                        (  ' bg-moumate_blue ' ) + 
                        "w-full  rounded-[16px] py-[16px] px-[16px]  mt-2 text-white justify-center"}
                    >
                     ยืนยัน
                    </button>

              

          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModalImageCrop



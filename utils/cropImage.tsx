// ช่วยแปลงองศาเป็นเรเดียน
const getRadianAngle = (degreeValue: number) => {
  return (degreeValue * Math.PI) / 180;
};

// คำนวณ bounding box หลังหมุน
const rotateSize = (width: number, height: number, rotation: number) => {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
};

export const getCroppedImg = async (
  imageSrc: string,
  pixelCrop: any,
  rotation = 0
): Promise<Blob> => {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => (image.onload = resolve));

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context is null');

  const rotRad = getRadianAngle(rotation);

  // คำนวณ safe area (เผื่อหมุนแล้วไม่โดนตัดขอบ)
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // ✅ หมุนภาพไว้ตรงกลาง canvas
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);

  // ✅ ตัดส่วนที่ต้องการ
  const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);

  // ✅ เซ็ต canvas ใหม่ให้ขนาดพอดี crop
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.putImageData(data, 0, 0);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
    }, 'image/png');
  });
};

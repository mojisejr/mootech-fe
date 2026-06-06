'use client'; // สำหรับ Next.js 13 ขึ้นไป

import React from 'react';

let CanvasJSChart: any;
if (typeof window !== 'undefined') {
  // ทำ dynamic import เฉพาะฝั่ง client
  const module = require('canvasjs-react-charts');
  CanvasJSChart = module.CanvasJSChart;
}


type ComponentProps = {
  data: any;
}


const ChartComponent = ({ 
  data,
}: ComponentProps) => {

    let dataPoints:any[] = []
    if (data) {
      dataPoints = data.map((item: any) => ({
        label: `${item.ageStart}-${item.ageEnd}`,
        y: item.score,
        indexLabel: item.description || '',         // แสดงบนจุด
        toolTipContent: `<b>${item.ageStart}-${item.ageEnd}</b>: ${item.description || 'ไม่มีคำอธิบาย'} (${item.score})`,
      }));
    }


    const options = {
      title: {
        text: "",
      },
      data: [
        {
          type: "spline",
          color: '#1B9AAF',   
          lineThickness: 1,  
          dataPoints: dataPoints,
        },
      ],
    };

    return <CanvasJSChart options={options} />

}

export default ChartComponent;

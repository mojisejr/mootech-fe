import { useEffect, useState } from "react";

type ComponentProps = {
  dob: string,
  onChangeDate: any,
}

function parseDob(dob?: string) {
  // dob รูปแบบ "YYYY-MM-DD"
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map((x) => Number(x));
  if (!y || !m || !d) return null;
  return { y, m, d };
}


const BirthDayInput = ({ 
  dob,
  onChangeDate
}: ComponentProps) => {




  const [selectedDay, setSelectedDay] = useState<any>(new Date().getDate()); // 24
  const [selectedMonth, setSelectedMonth]  = useState<any>(new Date().getMonth() + 1); // 7 (July)
  const [selectedYear, setSelectedYear]  = useState<any>(new Date().getFullYear()); // 1990

  // useEffect(() => {
  //   const baseDate = dob ? new Date(dob) : new Date();
  //   const selectedDay = baseDate.getDate(); // 24
  //   const selectedMonth = baseDate.getMonth() + 1; // 7 (July)
  //   const selectedYear = baseDate.getFullYear(); // 1990

  //   setSelectedDay(selectedDay)
  //   setSelectedMonth(selectedMonth)
  //   setSelectedYear(selectedYear)

  // }, [dob])

    useEffect(() => {
    const parsed = parseDob(dob);
    if (!parsed) return;

    setSelectedDay(parsed.d);
    setSelectedMonth(parsed.m);
    setSelectedYear(parsed.y);
  }, [dob]);



  const dates = Array.from({ length: 31 }, (_, i) => i + 1);
  const months = [
    { value: 1, label: "มกราคม" },
    { value: 2, label: "กุมภาพันธ์" },
    { value: 3, label: "มีนาคม" },
    { value: 4, label: "เมษายน" },
    { value: 5, label: "พฤษภาคม" },
    { value: 6, label: "มิถุนายน" },
    { value: 7, label: "กรกฎาคม" },
    { value: 8, label: "สิงหาคม" },
    { value: 9, label: "กันยายน" },
    { value: 10, label: "ตุลาคม" },
    { value: 11, label: "พฤศจิกายน" },
    { value: 12, label: "ธันวาคม" },
  ];

  const currentYear = new Date().getFullYear(); // 2025
  const years = Array.from(
  { length: 151 },
  (_, i) => currentYear + 50 - i
);


  const onChangeDay = (event: any) => {
    const m = Number(event.target.value);
    setSelectedDay(m)
    onChange(event.target.value, selectedMonth, selectedYear)
  }
  const onChangeMonth = (event: any) => {
    const m = Number(event.target.value);
    setSelectedMonth(m)
    onChange(selectedDay, event.target.value, selectedYear)
    
  }
  const onChangeYear = (event: any) => {
    const m = Number(event.target.value);
    setSelectedYear(m)
    onChange(selectedDay, selectedMonth, event.target.value)
  }

  const onChange = (d: any, m: any, y: any) => {
    if (onChangeDate) {
      const dd = String(d).padStart(2, "0");
      const mm = String(m).padStart(2, "0");
      const value = `${y}-${mm}-${dd}`;
      onChangeDate(value)
    }
  }

  return (
      <div className=" w-full flex flex-wrap font-ibm gap-2 ">
      
        <div className='w-fit flex flex-wrap'>
          <select
            onChange={onChangeDay}
           value={selectedDay}
           aria-label="วันที่"
          className='w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]'
          >
          {dates.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
           ))}
          </select>
        </div>

        <div className='w-fit flex flex-wrap'>
          <select
            onChange={onChangeMonth}
           value={selectedMonth}
           aria-label="เดือน"
          className='w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]'
          >
            {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
          </select>
        </div>

        <div className='w-fit flex flex-wrap'>
          <select
            onChange={onChangeYear}
           value={selectedYear}
           aria-label="ปี"
          className='w-full bg-moumate_white border border-gray-200 p-[8px] rounded-[10px]'
          >
     {years.map((y) => (
          <option key={y} value={y}>
            {y + 543} {/* แสดงเป็น พ.ศ. */}
          </option>
        ))}
          </select>
        </div>

      </div>
  )
}

export default BirthDayInput

'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Label,
  LabelList,
} from 'recharts';

type ComponentProps = {
  data?: any[];
};

const GraphLifeV2 = ({ data }: ComponentProps) => {
   const chartData = data?.map((item) => ({
    label: `${item.ageStart}-${item.ageEnd}`,
    score: item.score,
    description: item.description || 'ไม่มีคำอธิบาย',
  }));

  if (!chartData) {
    return null
  }
  const pointWidth = 80; // ปรับขนาดต่อจุดตามความกว้าง label
  const minChartWidth = chartData.length * pointWidth;
  

  return (
    <div
      className="overflow-x-auto"
      style={{
        background: 'linear-gradient(180deg, #E3ECFB 0%, #FDE6EB 100%)',
        borderRadius: '16px',  padding: '32px 16px 16px 16px',
      }}
    >
      <div style={{ minWidth: `${minChartWidth}px`, width: '100%' }}>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label">
              <Label value="ช่วงอายุ" offset={-5} position="insideBottom" />
            </XAxis>
            <YAxis
              label={{ value: 'คะแนน', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#4B96E5"
              strokeWidth={1}
              activeDot={{ r: 3 }}
            >
              <LabelList
                dataKey="description"
                position="top"
                content={(props) => {
                  const { x, y, value } = props;
                  const xPos = Number(x) - 50;
                  const yPos = Number(y) - 25;

                  return (
                    <foreignObject x={xPos} y={yPos} width={100} height={30}>
                      <div
                        className="bg-white rounded-[20px] text-moumate_blue font-ibm text-[12px] px-2 py-1 text-center shadow"
                      >
                        {value ?? ''}
                      </div>
                    </foreignObject>
                  );
                }}
              />
            </Line>
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
export default GraphLifeV2;

// Figma 720:32490 §"ตารางดวงจีน" (2026-09-07) — การ์ดตารางดวงจีนต่อคน: 5 เสา ลงสีธาตุของก้าน/กิ่งเอง, ชิปธาตุดิถี,
// วันเกิด พ.ศ., วัยจร + ปีจร 100 ปี กางได้, legend ธาตุ; ยามไม่ทราบ → "—"; ผลเก่าไม่มี chart → readChartTable = null
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('next/image', () => ({ default: (p: { alt?: string }) => <img alt={p.alt ?? ''} /> }))

import { ChartTableCard } from '@/features/v2-service/components/ChartTableCard'
import { readChartTable, chartInk, CHART_ELEMENT_INK } from '@/features/v2-service/chart-table'

const P = (stem: string, branch: string, stemElement: string, branchElement: string, animal: string) => ({ stem, branch, stemElement, branchElement, animal })
const CHART = {
  birthDate: '1989-03-02',
  birthTime: '10:00',
  dayElement: 'ทอง',
  pillars: {
    year: P('己', '巳', 'ดิน', 'ไฟ', 'มะเส็ง'),
    month: P('丙', '寅', 'ไฟ', 'ไม้', 'ขาล'),
    day: P('辛', '酉', 'ทอง', 'ทอง', 'ระกา'),
    hour: P('癸', '巳', 'น้ำ', 'ไฟ', 'มะเส็ง'),
    ascendant: P('壬', '申', 'น้ำ', 'ทอง', 'วอก'),
  },
  daYun: [{ ...P('乙', '亥', 'ไม้', 'น้ำ', 'กุน'), startAge: 1, endAge: 10, ageRange: '1–10' }, { ...P('丙', '子', 'ไฟ', 'น้ำ', 'ชวด'), startAge: 11, endAge: 20, ageRange: '11–20' }],
  liuNian: Array.from({ length: 15 }, (_, k) => ({ ...P('丙', '午', 'ไฟ', 'ไฟ', 'มะเมีย'), year: 2026 + k, yearBE: 2569 + k, age: 38 + k })),
}

afterEach(cleanup)

describe('ChartTableCard', () => {
  it('5 เสา (รวมลัคนา) ก้าน/กิ่งลงสีตามธาตุของตัวเอง + ชิปธาตุดิถี + วันเกิด พ.ศ.', () => {
    render(<ChartTableCard testId="ct" roleLabel="คุณ" chart={CHART} person={{ name: 'คุณ' }} />)
    for (const k of ['year', 'month', 'day', 'hour', 'ascendant']) expect(screen.getByTestId(`ct-pillar-${k}`)).toBeTruthy()
    const year = screen.getByTestId('ct-pillar-year')
    const spans = year.querySelectorAll('span')
    expect(spans[1].textContent).toBe('己')
    expect((spans[1] as HTMLElement).style.color).toBe(hex(CHART_ELEMENT_INK['ดิน']))
    expect(spans[2].textContent).toBe('巳')
    expect((spans[2] as HTMLElement).style.color).toBe(hex(CHART_ELEMENT_INK['ไฟ']))
    expect(screen.getByTestId('ct-element').textContent).toBe('ธาตุทอง')
    expect(screen.getByTestId('ct-birth').textContent).toContain('2 มี.ค. 2532')
    expect(screen.getByTestId('ct-birth').textContent).toContain('10:00')
  })

  it('กดปุ่มแล้วกาง วัยจร (ทุกช่วงอายุ+นักษัตร) + ปีจร 15 ปี (ไม่มี legend)', () => {
    render(<ChartTableCard testId="ct" roleLabel="คุณ" chart={CHART} person={{ name: 'คุณ' }} />)
    expect(screen.queryByTestId('ct-luck')).toBeNull()
    fireEvent.click(screen.getByTestId('ct-toggle'))
    expect(screen.getByTestId('ct-dayun').textContent).toContain('1–10')
    expect(screen.getByTestId('ct-dayun').textContent).toContain('กุน')
    expect(screen.getByTestId('ct-liunian').children).toHaveLength(15) // แถวเดียว 15 ปีจากปีปัจจุบัน (ผู้ใช้เคาะ 2026-09-07)
    expect(screen.getByTestId('ct-liunian').textContent).toContain('2040')
    expect(screen.queryByTestId('chart-legend')).toBeNull() // สถานะกางใน Figma ไม่มี legend
  })

  it('ไม่ทราบเวลาเกิด → ยาม/ลัคนา "—" ไม่ใช่ค่าเดา', () => {
    render(<ChartTableCard testId="ct" roleLabel="เขา" chart={{ ...CHART, birthTime: null }} person={{ name: 'สมชาย', timeKnown: false }} />)
    expect(screen.getByTestId('ct-pillar-hour').textContent).toContain('—')
    expect(screen.getByTestId('ct-pillar-ascendant').textContent).toContain('—')
    expect(screen.getByTestId('ct-pillar-day').textContent).toContain('辛')
  })

  it('readChartTable: ผลเก่า/ไม่ครบ 4 เสา → null; ครบ → อ่านได้ และ chartInk ไม่รู้จัก → สี navy', () => {
    expect(readChartTable(undefined)).toBeNull()
    expect(readChartTable({ pillars: { year: CHART.pillars.year } })).toBeNull()
    expect(readChartTable(CHART)?.liuNian).toHaveLength(15)
    expect(chartInk('ไม่มี')).toBe('#1A264D')
  })
})

function hex(h: string): string {
  const n = h.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16))
  return `rgb(${r}, ${g}, ${b})`
}

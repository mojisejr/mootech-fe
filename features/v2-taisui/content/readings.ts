// ปีชง 2570 — reading content. DRAFT: written by the agent from the engine's facts (bazi
// src/features/taisui/year-relations.ts). The Sinse approves every line before production
// (workstream mumate-taisui-2570-001, slice 5). While APPROVED is false the page shows a draft
// label and the production switch (lib/taisui/live.ts) keeps the page closed on production.
//
// Rules for this file: no AI provider names, no ritual or purchase promises, plain Thai.

export const APPROVED = false

export type Relation = 'same' | 'clash' | 'punish' | 'harm' | 'six' | 'half3' | 'season' | 'none'
export type PillarKey = 'hour' | 'day' | 'month' | 'year'
export type Flow = 'same' | 'feeds' | 'controls' | 'fed-by' | 'controlled-by'

/** Each pillar's life area. */
export const AREA: Record<PillarKey, { label: string; noun: string }> = {
  year: { label: 'ปีเกิด · สังคมและผู้ใหญ่', noun: 'เรื่องสังคมและผู้ใหญ่' },
  month: { label: 'เดือนเกิด · การงานและพ่อแม่', noun: 'การงานและครอบครัว' },
  day: { label: 'วันเกิด · ตัวเองและคู่ครอง', noun: 'ตัวคุณและความรัก' },
  hour: { label: 'ยามเกิด · ลูก ลูกน้อง การลงทุน', noun: 'ลูกน้องและการลงทุน' },
}

/** The relation's Thai name, with the classical name in brackets for the reading header. */
export const RELATION_NAME: Record<Relation, string> = {
  same: 'ชงตรง · ปีนักษัตรตัวเอง',
  clash: 'ชงเต็ม (冲)',
  punish: 'ชงกระทบ (刑)',
  harm: 'ชงให้โทษ (害)',
  six: 'หกประสาน (六合)',
  half3: 'ครึ่งไตรภาคี (半三合)',
  season: 'ฤดูเดียวกัน (三會)',
  none: 'ไม่ชง',
}

/** The relation as it reads inside a sentence: "<animal> ... กับปีมะแม". */
export const RELATION_IN_SENTENCE: Record<Relation, string> = {
  same: 'เป็นนักษัตรเดียวกับปีมะแม', clash: 'ชงเต็มกับปีมะแม', punish: 'ชงกระทบกับปีมะแม', harm: 'ชงให้โทษกับปีมะแม',
  six: 'หกประสานกับปีมะแม', half3: 'ครึ่งไตรภาคีกับปีมะแม', season: 'อยู่ฤดูเดียวกับปีมะแม', none: 'ไม่ชงกับปีมะแม',
}

/** Is this relation a caution (the character shivers) or a help (it hops)? */
export const TONE: Record<Relation, 'good' | 'care' | 'calm'> = {
  same: 'care', clash: 'care', punish: 'care', harm: 'care',
  six: 'good', half3: 'good', season: 'good', none: 'calm',
}

/** The two lines under each character (scene 4). */
export const PREVIEW: Record<Relation, Record<PillarKey, [string, string]>> = {
  same: {
    year: ['ปีของตัวเอง', 'ทำตัวให้นิ่งไว้'],
    month: ['งานเปลี่ยนมือ', 'เช็กสัญญาให้ดี'],
    day: ['อารมณ์ขึ้นลง', 'ใจเย็นกับคนใกล้'],
    hour: ['ลงทุนค่อยเป็น', 'ค่อยไป'],
  },
  clash: {
    year: ['ผู้ใหญ่เปลี่ยน', 'อย่าเพิ่งขัดใคร'],
    month: ['งานสะดุดบ้าง', 'เผื่อเวลาไว้'],
    day: ['ความรักต้องคุย', 'ฟังกันให้มาก'],
    hour: ['เงินลงทุนแกว่ง', 'อย่าเพิ่งเพิ่มเดิมพัน'],
  },
  punish: {
    year: ['คำพูดถูกจับผิด', 'พูดให้ชัดไว้'],
    month: ['เอกสารต้องเป๊ะ', 'อ่านก่อนเซ็น'],
    day: ['สุขภาพต้องดูแล', 'นอนให้พอ'],
    hour: ['ลูกน้องงอแง', 'ตั้งกติกาให้ชัด'],
  },
  harm: {
    year: ['คนรอบตัวงอน', 'ใส่ใจคนเก่า'],
    month: ['งานมีคนแทรก', 'เก็บหลักฐานไว้'],
    day: ['เข้าใจผิดง่าย', 'ถามก่อนคิดเอง'],
    hour: ['เงินรั่วเล็กๆ', 'จดรายจ่ายไว้'],
  },
  six: {
    year: ['ผู้ใหญ่ช่วย', 'อย่ารับงานเกิน'],
    month: ['งานมีคนหนุน', 'จับมือได้เลย'],
    day: ['ความรักอุ่นขึ้น', 'เปิดใจได้'],
    hour: ['ลูกน้องหนุน', 'ลงทุนมีแรงส่ง'],
  },
  half3: {
    year: ['เพื่อนพาโชค', 'ออกไปเจอคน'],
    month: ['งานขยาย', 'โปรเจกต์ใหม่เริ่มได้'],
    day: ['คนรักเข้าใจ', 'วางแผนคู่ได้'],
    hour: ['ทีมแข็ง', 'ลงทุนระยะยาวดี'],
  },
  season: {
    year: ['ได้แรงจากกลุ่ม', 'เข้าหาเครือข่าย'],
    month: ['งานไหลลื่น', 'เร่งได้ช่วงกลางปี'],
    day: ['พลังดี', 'ดูแลใจตัวเอง'],
    hour: ['ไอเดียมา', 'จดไว้แล้วลงมือ'],
  },
  none: {
    year: ['ปีสงบ', 'เดินตามแผน'],
    month: ['งานเรียบๆ', 'สะสมผลงาน'],
    day: ['ใจนิ่ง', 'ดูแลกิจวัตร'],
    hour: ['เงินนิ่ง', 'ออมได้ดี'],
  },
}

type Reading = { headline: string; opportunity: string; strengths: string; cautions: string; actions: [string, string, string] }

const BASE: Record<Relation, { headline: string; opportunity: (area: string) => string; strengths: string; cautions: string }> = {
  same: {
    headline: 'ปีของตัวเอง ทุกอย่างหมุนเร็ว',
    opportunity: (a) => `${a}มีเรื่องใหม่เข้ามาให้ตัดสินใจหลายครั้ง ถ้าคิดก่อนทำ ปีนี้คือปีวางรากใหม่`,
    strengths: 'คุณเห็นตัวเองชัดขึ้น รู้ว่าอะไรควรเก็บ อะไรควรปล่อย',
    cautions: 'อารมณ์ขึ้นลงง่าย อย่าตัดสินใจเรื่องใหญ่ตอนเหนื่อยหรือโกรธ',
  },
  clash: {
    headline: 'ปีที่ต้องปรับตัว แต่ผ่านไปได้ด้วยแผน',
    opportunity: (a) => `${a}มีการเปลี่ยนแปลงแรง ถ้ามีแผนสำรองไว้ก่อน การเปลี่ยนนี้จะพาไปที่ใหม่ที่ดีกว่า`,
    strengths: 'แรงกดดันทำให้คุณกล้าตัดสินใจเรื่องที่ค้างมานาน',
    cautions: 'ช่วงเดือนชงให้เลี่ยงการเซ็นสัญญาใหญ่และการเดินทางไกลแบบรีบร้อน',
  },
  punish: {
    headline: 'ปีที่ต้องละเอียด คำพูดและเอกสารสำคัญ',
    opportunity: (a) => `${a}จะดีขึ้นถ้าทำทุกอย่างให้ชัดเจน มีหลักฐาน และพูดตรงไปตรงมา`,
    strengths: 'ความรอบคอบของคุณจะเป็นที่พึ่งของคนรอบตัว',
    cautions: 'ระวังการถูกเข้าใจผิดจากคำพูด และเรื่องเล็กที่ลามเป็นเรื่องใหญ่',
  },
  harm: {
    headline: 'ปีที่ต้องดูแลความสัมพันธ์',
    opportunity: (a) => `${a}ไปได้ดีถ้าคุณใส่ใจคนรอบตัวและถามให้ชัดก่อนคิดเอง`,
    strengths: 'คุณอ่านใจคนเก่ง ปีนี้ใช้จุดนี้แก้ปัญหาได้',
    cautions: 'ระวังคนที่เข้ามาแทรกกลาง และเงินที่รั่วไหลทีละนิด',
  },
  six: {
    headline: 'ปีที่มีคนช่วยเปิดทาง',
    opportunity: (a) => `${a}มีผู้ใหญ่หรือคนสำคัญยื่นมือมาช่วย จังหวะดีที่จะชวนกันทำเรื่องใหม่`,
    strengths: 'คนรอบตัวเชื่อใจคุณ งานที่ต้องอาศัยความร่วมมือจะไปได้ไว',
    cautions: 'ได้รับความช่วยเหลือเยอะ อย่ารับปากเกินกำลังตัวเอง',
  },
  half3: {
    headline: 'ปีที่โชคมาจากการรวมพลัง',
    opportunity: (a) => `${a}เติบโตเมื่อคุณรวมทีมหรือรวมเครือข่าย โอกาสจะเด่นที่สุดในเดือนที่ครบไตรภาคี`,
    strengths: 'คุณดึงคนเก่งมาอยู่ด้วยกันได้ ปีนี้คือปีลงมือทำโปรเจกต์ใหญ่',
    cautions: 'งานเยอะขึ้นเร็ว แบ่งเวลาพักให้ตัวเองด้วย',
  },
  season: {
    headline: 'ปีที่ไปทางเดียวกับฤดูของปี',
    opportunity: (a) => `${a}ได้แรงหนุนจากกลุ่มคนที่คิดคล้ายกัน ช่วงกลางปีเหมาะเร่งงาน`,
    strengths: 'พลังของคุณเข้ากับจังหวะของปี เริ่มอะไรก็มีแรงส่ง',
    cautions: 'ไฟแรงได้ แต่อย่าใจร้อนจนข้ามรายละเอียด',
  },
  none: {
    headline: 'ปีที่สงบ เหมาะสะสมผลงาน',
    opportunity: (a) => `${a}ไม่มีแรงกระแทกจากปี เป็นจังหวะดีที่จะทำตามแผนให้ต่อเนื่อง`,
    strengths: 'ความสม่ำเสมอของคุณจะออกผลชัดเมื่อสิ้นปี',
    cautions: 'ปีนิ่งจนชิน อย่าลืมตั้งเป้าให้ตัวเองท้าทายขึ้นบ้าง',
  },
}

const ACTIONS: Record<'good' | 'care' | 'calm', Record<PillarKey, [string, string, string]>> = {
  good: {
    year: ['นัดคุยกับผู้ใหญ่ที่เคยช่วยคุณ', 'รับงานที่ได้ออกหน้าสังคม', 'ขอบคุณคนที่ช่วยให้เป็นกิจจะลักษณะ'],
    month: ['เขียนแผนงานปีนี้ให้ชัดในหน้าเดียว', 'ชวนพาร์ทเนอร์ที่ไว้ใจเริ่มงานใหม่', 'พาพ่อแม่ไปเที่ยวสักครั้ง'],
    day: ['เปิดใจคุยเรื่องอนาคตกับคนรัก', 'ลงเรียนสิ่งที่อยากทำมานาน', 'ดูแลสุขภาพให้เป็นกิจวัตร'],
    hour: ['มอบหมายงานให้ลูกน้องมากขึ้น', 'เริ่มลงทุนระยะยาวแบบสม่ำเสมอ', 'ใช้เวลากับลูกหรือคนรุ่นใหม่'],
  },
  care: {
    year: ['ฟังมากกว่าพูดในที่ประชุม', 'เลื่อนเรื่องใหญ่ออกจากเดือนชง', 'รักษาคำพูดกับผู้ใหญ่'],
    month: ['อ่านสัญญาทุกฉบับก่อนเซ็น', 'ตั้งเงินสำรองก่อนเริ่มงานใหม่', 'นัดตรวจสุขภาพพ่อแม่ก่อนกลางปี'],
    day: ['พักให้พอก่อนตัดสินใจเรื่องสำคัญ', 'คุยกับคนรักทุกสัปดาห์', 'ออกกำลังกายเบาๆ สม่ำเสมอ'],
    hour: ['ไม่เพิ่มเงินลงทุนช่วงเดือนชง', 'ตั้งกติกากับลูกน้องให้ชัด', 'จดรายรับรายจ่ายทุกเดือน'],
  },
  calm: {
    year: ['ตั้งเป้าใหม่หนึ่งข้อที่ท้าทาย', 'ขยายวงเพื่อนในสายงาน', 'ช่วยงานส่วนรวมสักครั้ง'],
    month: ['ทำผลงานให้มีคนเห็น', 'เก็บทักษะใหม่หนึ่งอย่าง', 'วางแผนเงินของครอบครัว'],
    day: ['ทำกิจวัตรดีๆ ให้ต่อเนื่อง', 'ให้เวลากับคนรัก', 'พักใจด้วยงานอดิเรก'],
    hour: ['ออมเงินอัตโนมัติทุกเดือน', 'สอนงานลูกน้องหนึ่งคน', 'ศึกษาการลงทุนก่อนลงมือ'],
  },
}

export function readingFor(relation: Relation, key: PillarKey): Reading {
  const b = BASE[relation]
  return {
    headline: b.headline,
    opportunity: b.opportunity(AREA[key].noun),
    strengths: b.strengths,
    cautions: b.cautions,
    actions: ACTIONS[TONE[relation]][key],
  }
}

/** The year's fire into each pillar (scene 5): Mu's line while that pillar is lit. */
export const FLOW_LINE: Record<Flow, string> = {
  same: 'ไฟของปีเป็นธาตุเดียวกับเสานี้ แรงเสริมกันเต็มที่',
  feeds: 'ไฟของปีหล่อเลี้ยงเสานี้ ได้แรงหนุนอุ่นๆ ทั้งปี',
  controls: 'ไฟของปีคุมเสานี้ ต้องอดทนแต่ได้ฝีมือเพิ่ม',
  'fed-by': 'เสานี้ส่งแรงให้ไฟของปี ทุ่มเทแล้วมีคนเห็น',
  'controlled-by': 'เสานี้คุมไฟของปีได้ คุณเป็นคนกำหนดจังหวะเอง',
}

/** Receiver against sender, year animals (red packet card, scene 11). */
export const PAIR_LINE: Record<Relation, string> = {
  same: 'นักษัตรเดียวกัน ปีนี้เข้าใจกันดีเป็นพิเศษ',
  clash: 'ชงกันตรงๆ ปีนี้ต้องฟังกันให้มาก แล้วจะช่วยกันได้',
  punish: 'กระทบกันบ้าง พูดให้ชัดแล้วจะไปด้วยกันได้',
  harm: 'ต้องใส่ใจกันหน่อย อย่าปล่อยให้เข้าใจผิดค้าง',
  six: 'หกประสาน ปีนี้ช่วยกันได้ดีมาก',
  half3: 'ครึ่งไตรภาคี ร่วมมือกันแล้วโชคดี',
  season: 'อยู่ฤดูเดียวกัน คิดอะไรคล้ายกัน',
  none: 'ไม่ชงกัน ปีนี้ไปด้วยกันได้สบาย',
}

/** Month tip (scene 8b) by state; the month name is added by the page. */
export const MONTH_TIP: Record<'peak' | 'care' | 'normal', string> = {
  peak: 'เดือนที่ส่งผลดีกับดวงคุณ จังหวะดีเริ่มงานใหม่หรือคุยเรื่องสำคัญ',
  care: 'เดือนชงกับดวงคุณ พักการตัดสินใจก้อนใหญ่ไว้ก่อน',
  normal: 'เดือนปกติ ทำตามแผนได้ตามเดิม',
}

/** Year plan card (scene 9): one focus line per pillar. */
export function planLine(relation: Relation, key: PillarKey): string {
  return `${AREA[key].noun}: ${PREVIEW[relation][key].join(' ')}`
}

/** Mu's line for each pillar while it is lit (scene 4). */
export function muLine(relation: Relation, key: PillarKey, animal: string): string {
  const [a, b] = PREVIEW[relation][key]
  return `${AREA[key].label.split(' · ')[0]}ของคุณคือ${animal} ${RELATION_IN_SENTENCE[relation]} ${a} ${b}`
}

// ปีชง 2570 — reading content. DRAFT, keyed by the Sinse's reactions (plan revision 0.9 of ciel-os
// mumate-taisui-2570-001, design/SINSE-REACTIONS.md): what the year does (ชง เฮ้ง ไห่ ผั่ว ซำเฮ้ง …),
// where it lands (which pillar, top or bottom character) and what the year's fire is to the day
// master. The meanings follow the Sinse's own documents; the agent drafted the wording, and the
// Sinse approves every line before production (slice 5). While APPROVED is false the page shows a
// draft label and the production switch (lib/taisui/live.ts) keeps the page closed on production.
//
// Rules for this file: "ชง" names 冲 alone; no AI provider names; no ritual or purchase promises.

export const APPROVED = false

/** The Sinse's reactions, as bazi names them (src/features/taisui/year-reactions.ts), plus none. */
export type Relation = 'chong' | 'samheng' | 'heng' | 'hai' | 'phua' | 'stemClash' | 'same' | 'six' | 'half3' | 'stemCombine' | 'none'
export type PillarKey = 'hour' | 'day' | 'month' | 'year'
export type Flow = 'same' | 'feeds' | 'controls' | 'fed-by' | 'controlled-by'
export type ElementRole = 'companion' | 'output' | 'wealth' | 'power' | 'resource'
export type ReactionFact = {
  kind: Exclude<Relation, 'none'>; name: string; pillar: PillarKey; at: 'top' | 'bottom'
  mine: string; year: string; pair?: string; group?: string
}

export const RELATIONS: Relation[] = ['chong', 'samheng', 'heng', 'hai', 'phua', 'stemClash', 'same', 'six', 'half3', 'stemCombine', 'none']

/** Each pillar's life area. */
export const AREA: Record<PillarKey, { label: string; noun: string }> = {
  year: { label: 'ปีเกิด · สังคมและผู้ใหญ่', noun: 'เรื่องสังคมและผู้ใหญ่' },
  month: { label: 'เดือนเกิด · การงานและพ่อแม่', noun: 'การงานและครอบครัว' },
  day: { label: 'วันเกิด · ตัวเองและคู่ครอง', noun: 'ตัวคุณและความรัก' },
  hour: { label: 'ยามเกิด · ลูก ลูกน้อง การลงทุน', noun: 'ลูกน้องและการลงทุน' },
}

/** Top character = ราศีบน (the stem), bottom = ราศีล่าง (the animal). */
export const AT_TH: Record<'top' | 'bottom', string> = { top: 'ราศีบน', bottom: 'ราศีล่าง' }

/** The reaction's name for the reading header: plain word first, the classical name in brackets. */
export const RELATION_NAME: Record<Relation, string> = {
  chong: 'ชง (冲)',
  samheng: 'ซำเฮ้ง (三刑)',
  heng: 'เฮ้ง (刑)',
  hai: 'ไห่ (害)',
  phua: 'ผั่ว (破)',
  stemClash: 'ราศีบนปะทะ (天干冲)',
  same: 'นักษัตรเดียวกับปี (伏吟)',
  six: 'หกประสาน (六合)',
  half3: 'ครึ่งไตรภาคี (半三合)',
  stemCombine: 'ราศีบนประสาน (天干合)',
  none: 'ไม่มีปฏิกิริยาตรง',
}

/** The reaction inside a sentence: "<animal> … ". */
export const RELATION_IN_SENTENCE: Record<Relation, string> = {
  chong: 'ชงกับปีมะแม', samheng: 'ครบซำเฮ้งกับปีมะแม', heng: 'โดนเฮ้งจากปีมะแม', hai: 'โดนไห่จากปีมะแม',
  phua: 'เกิดผั่วกับปีมะแม', stemClash: 'ราศีบนปะทะไฟของปี', same: 'เป็นนักษัตรเดียวกับปีมะแม',
  six: 'หกประสานกับปีมะแม', half3: 'ครึ่งไตรภาคีกับปีมะแม', stemCombine: 'ราศีบนประสานกับไฟของปี', none: 'ไม่มีปฏิกิริยาตรงกับปีมะแม',
}

/** The core meaning of each reaction, in the Sinse's terms. */
export const MEANING: Record<Relation, string> = {
  chong: 'การปะทะและการเปลี่ยนแปลงแบบฉับพลัน ทำลายความหยุดนิ่ง ดีหรือร้ายขึ้นกับทั้งดวง',
  samheng: 'เฮ้งที่หนักที่สุด ครบสามตัวในกลุ่มเดียว แรงกดดันซ้อนกันหลายทาง',
  heng: 'ภาระที่บั่นทอนกันและกัน ความตึงเครียดเรื้อรัง การล้ำเส้นเกินพอดี',
  hai: 'ความขัดแย้งที่มองไม่เห็น คำนินทา การถูกให้ร้ายลับหลัง',
  phua: 'รอยร้าวจากข้างใน การรั่วไหลอย่างเงียบๆ ที่ค่อยๆ กินรากฐาน',
  stemClash: 'ความคิดและสิ่งที่แสดงออกปะทะกับพลังของปี',
  same: 'ปีมาทับนักษัตรของตัวเอง เรื่องของเสานี้จะเด่นและถูกจับตามากกว่าปกติ',
  six: 'แรงประสาน มีคนจับมือช่วยกันในเรื่องของเสานี้',
  half3: 'แรงรวมกลุ่ม เมื่อครบอีกตัวในเดือนที่ใช่ โอกาสจะเด่นขึ้น',
  stemCombine: 'ความคิดเข้ากับพลังของปี เจรจาและร่วมมือได้ง่าย',
  none: 'ปีไม่ได้เข้ามาทำปฏิกิริยากับเสานี้โดยตรง',
}

/** The Sinse's stories for the pairs that touch the Goat year, and the ผั่ว and ซำเฮ้ง groups. */
const PAIR_STORY: Record<string, string> = {
  'chong:丑': 'ปัญหายืดเยื้อและจุกจิก เรื่องในบ้านหรือการซ่อมแซมกวนใจ ดูแลระบบทางเดินอาหาร',
  'heng:戌': 'ภาระหน้าที่หนักจนอยากทิ้งกลางทาง อย่าเพิ่งปฏิเสธความรับผิดชอบแบบหักดิบ',
  'heng:辰': 'ผลประโยชน์บีบคั้นจนรู้สึกเข้าตาจน ข้อตกลงบางเรื่องอาจต้องยุติ',
  'hai:子': 'คนใกล้ตัวขัดกันเอง ระวังถูกใส่ร้ายในเรื่องที่ไม่ได้ทำ หรือความอิจฉาในหมู่คนสนิท',
  'phua:drain': 'ลงแรงลงเงินหรือช่วยคนอื่นแล้วตัวเองเสียหาย การเรียนหรือการลงทุนอาจไม่ได้ผลตามคาด',
  'phua:poison': 'คนที่เข้ามาช่วยอาจไม่มีกำลังพอ หรือมีวาระซ่อนอยู่ สุดท้ายเราต้องรับผลเสียภายหลัง',
  'phua:self': 'แบกภาระหนักจากข้างใน มีรายจ่ายหรือหนี้รออยู่ตลอด การเงินตึง',
  'phua:leak': 'เงินรั่วไหลกับเรื่องจุกจิก เก็บไม่อยู่',
  'samheng:vault': 'แรงกดดันยืดเยื้อ การแย่งชิงทรัพย์ที่ซ่อนเร้น เรื่องคาราคาซังที่หาทางออกยาก',
  'stemClash:any': 'ความคิดหรือการตัดสินใจขัดกับคนรอบตัว เรื่องที่พูดออกไปต้องคิดก่อน',
  'stemCombine:any': 'เจรจาง่าย ความคิดของคุณเข้ากับจังหวะของปี',
  'same:any': 'เป็นปีที่ต้องก้าวขึ้นมารับผิดชอบมากขึ้น วางตัวนิ่งแล้วจะได้ความน่าเชื่อถือ',
  'six:any': 'มีคนจับมือช่วย งานที่ต้องร่วมมือจะไปได้ไว',
  'half3:any': 'รวมทีมแล้วมีแรงส่ง โอกาสเด่นในเดือนที่ครบไตรภาคี',
}

/** One line for one reaction: what it is, where it lands, the Sinse's story for it. */
export function storyOf(r: ReactionFact): string {
  const key = r.kind === 'phua' || r.kind === 'samheng' ? `${r.kind}:${r.group}` : `${r.kind}:${r.mine}`
  return PAIR_STORY[key] ?? PAIR_STORY[`${r.kind}:any`] ?? MEANING[r.kind]
}

export function whereOf(r: ReactionFact): string {
  const via = r.kind === 'phua' ? ` · ${r.pair} ` : r.kind === 'samheng' ? ` · ${r.pair} ` : ' '
  return `${AREA[r.pillar].label.split(' · ')[0]} · ${AT_TH[r.at]} ${r.mine}${via}`.trim()
}

/** Is this reaction a caution or a help? */
export const TONE: Record<Relation, 'good' | 'care' | 'calm'> = {
  chong: 'care', samheng: 'care', heng: 'care', hai: 'care', phua: 'care', stemClash: 'care',
  // The Sinse: a Goat meeting the Goat year is written kindly ("เขียนให้สวย"), so it is not a caution.
  same: 'good', six: 'good', half3: 'good', stemCombine: 'good', none: 'calm',
}

/** The two short lines under each character (scene 4), by the strongest reaction on that pillar. */
export const PREVIEW: Record<Relation, [string, string]> = {
  chong: ['มีแรงปะทะ', 'เตรียมแผนสำรอง'],
  samheng: ['แรงกดดันซ้อน', 'ค่อยๆ แก้ทีละเรื่อง'],
  heng: ['ภาระบั่นทอน', 'อย่าแบกเกินตัว'],
  hai: ['ระวังคนให้ร้าย', 'เก็บหลักฐานไว้'],
  phua: ['มีรอยรั่วข้างใน', 'อุดก่อนจะลาม'],
  stemClash: ['ความคิดปะทะ', 'คิดก่อนพูด'],
  same: ['ปีของตัวเอง', 'วางตัวให้นิ่ง'],
  six: ['มีคนจับมือ', 'ชวนกันทำได้'],
  half3: ['รวมพลังได้', 'หาทีมที่ใช่'],
  stemCombine: ['เจรจาง่าย', 'คุยเรื่องสำคัญได้'],
  none: ['ปีนิ่ง', 'เดินตามแผน'],
}

type Reading = { headline: string; opportunity: string; strengths: string; cautions: string; actions: [string, string, string]; details: Array<{ name: string; where: string; story: string }> }

const HEADLINE: Record<Relation, string> = {
  chong: 'ปีที่มีการเปลี่ยนแปลงฉับพลัน เตรียมแผนไว้ก่อน',
  samheng: 'ปีที่แรงกดดันซ้อนหลายทาง ต้องใจเย็น',
  heng: 'ปีที่ต้องระวังภาระที่บั่นทอน',
  hai: 'ปีที่ต้องระวังเรื่องลับหลัง',
  phua: 'ปีที่ต้องอุดรอยรั่วจากข้างใน',
  stemClash: 'ปีที่ความคิดต้องผ่านการกลั่นกรอง',
  same: 'ปีที่นักษัตรของคุณถูกจับตา',
  six: 'ปีที่มีคนช่วยเปิดทาง',
  half3: 'ปีที่โชคมาจากการรวมพลัง',
  stemCombine: 'ปีที่เจรจาแล้วลงตัว',
  none: 'ปีที่สงบ เหมาะสะสมผลงาน',
}

const ACTIONS: Record<'good' | 'care' | 'calm', Record<PillarKey, [string, string, string]>> = {
  good: {
    year: ['นัดคุยกับผู้ใหญ่ที่เคยช่วยคุณ', 'รับงานที่ได้ออกหน้าสังคม', 'ขอบคุณคนที่ช่วยให้เป็นกิจจะลักษณะ'],
    month: ['เขียนแผนงานปีนี้ให้ชัดในหน้าเดียว', 'ชวนพาร์ทเนอร์ที่ไว้ใจเริ่มงานใหม่', 'พาพ่อแม่ไปเที่ยวสักครั้ง'],
    day: ['เปิดใจคุยเรื่องอนาคตกับคนรัก', 'ลงเรียนสิ่งที่อยากทำมานาน', 'ดูแลสุขภาพให้เป็นกิจวัตร'],
    hour: ['มอบหมายงานให้ลูกน้องมากขึ้น', 'เริ่มลงทุนระยะยาวแบบสม่ำเสมอ', 'ใช้เวลากับลูกหรือคนรุ่นใหม่'],
  },
  care: {
    year: ['ฟังมากกว่าพูดในที่ประชุม', 'เลื่อนเรื่องใหญ่ออกจากเดือนที่ต้องระวัง', 'รักษาคำพูดกับผู้ใหญ่'],
    month: ['อ่านสัญญาทุกฉบับก่อนเซ็น', 'ตั้งเงินสำรองก่อนเริ่มงานใหม่', 'จดรายรับรายจ่ายทุกเดือน'],
    day: ['พักให้พอก่อนตัดสินใจเรื่องสำคัญ', 'คุยกับคนรักทุกสัปดาห์', 'ออกกำลังกายเบาๆ สม่ำเสมอ'],
    hour: ['ไม่เพิ่มเงินลงทุนแบบรีบร้อน', 'ตั้งกติกากับลูกน้องให้ชัด', 'ตรวจสัญญาร่วมทุนอีกรอบ'],
  },
  calm: {
    year: ['ตั้งเป้าใหม่หนึ่งข้อที่ท้าทาย', 'ขยายวงเพื่อนในสายงาน', 'ช่วยงานส่วนรวมสักครั้ง'],
    month: ['ทำผลงานให้มีคนเห็น', 'เก็บทักษะใหม่หนึ่งอย่าง', 'วางแผนเงินของครอบครัว'],
    day: ['ทำกิจวัตรดีๆ ให้ต่อเนื่อง', 'ให้เวลากับคนรัก', 'พักใจด้วยงานอดิเรก'],
    hour: ['ออมเงินอัตโนมัติทุกเดือน', 'สอนงานลูกน้องหนึ่งคน', 'ศึกษาการลงทุนก่อนลงมือ'],
  },
}

/** The pillar's tone: any caution makes it care, else any help makes it good. */
export function toneOf(reactions: ReactionFact[]): 'good' | 'care' | 'calm' {
  if (reactions.some((r) => TONE[r.kind] === 'care')) return 'care'
  return reactions.length ? 'good' : 'calm'
}

export function readingFor(strongest: Relation, key: PillarKey, reactions: ReactionFact[]): Reading {
  const mine = reactions.filter((r) => r.pillar === key)
  const cares = mine.filter((r) => TONE[r.kind] === 'care')
  const helps = mine.filter((r) => TONE[r.kind] === 'good')
  const area = AREA[key].noun
  return {
    headline: HEADLINE[strongest],
    opportunity: helps.length
      ? `${area}มีแรงหนุนจาก${helps.map((r) => RELATION_NAME[r.kind].split(' (')[0]).join(' และ')} ${storyOf(helps[0])}`
      : cares.length ? `${area}จะผ่านไปได้ดีถ้ารู้ก่อนว่าแรงของปีเข้ามาตรงไหน แล้ววางแผนรับไว้` : `${area}ไม่มีแรงกระแทกจากปี เป็นจังหวะดีที่จะทำตามแผนให้ต่อเนื่อง`,
    strengths: helps.length ? MEANING[helps[0].kind] : cares.length ? 'การรู้ล่วงหน้าทำให้คุณเลือกจังหวะได้เอง' : 'ความสม่ำเสมอของคุณจะออกผลชัดเมื่อสิ้นปี',
    cautions: cares.length ? MEANING[cares[0].kind] : 'ปีนิ่งจนชิน อย่าลืมตั้งเป้าให้ตัวเองท้าทายขึ้นบ้าง',
    actions: ACTIONS[toneOf(mine)][key],
    details: mine.map((r) => ({ name: RELATION_NAME[r.kind], where: whereOf(r), story: storyOf(r) })),
  }
}

/** The year's fire to the day master (ดิถี): the Sinse's five roles. */
export const ROLE: Record<ElementRole, { th: string; line: string }> = {
  resource: { th: 'ส่งเสริมดิถี', line: 'ไฟของปีหล่อเลี้ยงตัวคุณ ปีนี้มีผู้ใหญ่หรือคนสนับสนุน รับความช่วยเหลือได้ แต่อย่าพึ่งจนลืมลงมือเอง' },
  companion: { th: 'คู่ธาตุดิถี', line: 'ไฟของปีเป็นธาตุเดียวกับคุณ มีเพื่อนร่วมทางและคู่แข่งพอๆ กัน แบ่งผลประโยชน์ให้ชัด' },
  output: { th: 'ดิถีถ่ายเท', line: 'คุณต้องส่งพลังออกไปให้ไฟของปี ได้ใช้ฝีมือและความคิดเต็มที่ แต่ระวังเหนื่อยและใช้จ่ายเกิน' },
  wealth: { th: 'โชคลาภ', line: 'คุณคุมไฟของปีได้ ไฟคือโชคลาภของคุณ มีเงินและโอกาสเข้ามาให้จัดการ' },
  power: { th: 'พิฆาตดิถี', line: 'ไฟของปีคุมตัวคุณ แรงกดดันจากงาน กฎเกณฑ์หรือผู้มีอำนาจ อดทนแล้วจะได้ตำแหน่งและความน่าเชื่อถือ' },
}

/** The ten day masters as pictures. */
export const DAY_MASTER: Record<string, { th: string; picture: string }> = {
  甲: { th: 'ไม้หยาง', picture: 'ต้นไม้ใหญ่' }, 乙: { th: 'ไม้หยิน', picture: 'เถาไม้ดอก' },
  丙: { th: 'ไฟหยาง', picture: 'ดวงอาทิตย์' }, 丁: { th: 'ไฟหยิน', picture: 'เปลวเทียน' },
  戊: { th: 'ดินหยาง', picture: 'ขุนเขา' }, 己: { th: 'ดินหยิน', picture: 'ดินสวน' },
  庚: { th: 'ทองหยาง', picture: 'เหล็กกล้า' }, 辛: { th: 'ทองหยิน', picture: 'อัญมณี' },
  壬: { th: 'น้ำหยาง', picture: 'มหาสมุทร' }, 癸: { th: 'น้ำหยิน', picture: 'หยาดน้ำค้าง' },
}

/** The year's fire into each pillar's stem (scene 5): Mu's line while that pillar is lit. */
export const FLOW_LINE: Record<Flow, string> = {
  same: 'ไฟของปีเป็นธาตุเดียวกับราศีบนของเสานี้',
  feeds: 'ไฟของปีหล่อเลี้ยงราศีบนของเสานี้',
  controls: 'ไฟของปีคุมราศีบนของเสานี้',
  'fed-by': 'ราศีบนของเสานี้ส่งแรงให้ไฟของปี',
  'controlled-by': 'ราศีบนของเสานี้คุมไฟของปีได้',
}

/** Receiver against sender, year animals (red packet card, scene 11). Branch reactions only. */
export const PAIR_LINE: Record<Relation, string> = {
  chong: 'ชงกันตรงๆ ปีนี้ต้องฟังกันให้มาก แล้วจะช่วยกันได้',
  samheng: 'แรงกดดันซ้อน ใจเย็นกับกันและกัน',
  heng: 'มีเฮ้งกัน อย่าแบกภาระแทนกันจนเหนื่อย',
  hai: 'มีไห่กัน อย่าปล่อยให้เข้าใจผิดค้าง',
  phua: 'มีรอยรั่วเล็กๆ คุยกันตรงๆ จะไม่ลาม',
  stemClash: 'ความคิดต่างกันบ้าง ฟังกันก่อนตัดสิน',
  same: 'นักษัตรเดียวกัน ปีนี้เข้าใจกันดีเป็นพิเศษ',
  six: 'หกประสาน ปีนี้ช่วยกันได้ดีมาก',
  half3: 'ครึ่งไตรภาคี ร่วมมือกันแล้วโชคดี',
  stemCombine: 'ความคิดเข้ากัน คุยอะไรก็ลงตัว',
  none: 'ไม่มีปฏิกิริยาตรงกัน ปีนี้ไปด้วยกันได้สบาย',
}

/** Month tip (scene 8b) by state; the month name is added by the page. */
export const MONTH_TIP: Record<'peak' | 'care' | 'normal', string> = {
  peak: 'เดือนที่ส่งผลดีกับดวงคุณ จังหวะดีเริ่มงานใหม่หรือคุยเรื่องสำคัญ',
  care: 'เดือนที่ต้องระวังกับดวงคุณ พักการตัดสินใจก้อนใหญ่ไว้ก่อน',
  normal: 'เดือนปกติ ทำตามแผนได้ตามเดิม',
}

/** Year plan card (scene 9): one focus line per pillar. */
export function planLine(relation: Relation, key: PillarKey): string {
  return `${AREA[key].noun}: ${PREVIEW[relation].join(' ')}`
}

/** Mu's line for each pillar while it is lit (scene 4). */
export function muLine(relation: Relation, key: PillarKey, animal: string): string {
  const [a, b] = PREVIEW[relation]
  return `${AREA[key].label.split(' · ')[0]}ของคุณคือ${animal} ${RELATION_IN_SENTENCE[relation]} ${a} ${b}`
}

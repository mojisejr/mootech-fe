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
  /** ฮะ only, from bazi: the element and the engine's outcome (source "sinse" when the engine has no element). */
  into?: { element: string; status: 'transformed' | 'supported' | 'detected' | 'blocked'; source: 'engine' | 'sinse' }
}
/** The chart's favourable elements (用神) and elements to avoid (忌神), from the engine, in Thai. */
export type Luck = { favorable: string[]; avoid: string[] }

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
  six: 'ฮะ (六合)',
  half3: 'ภาคี (半三合)',
  stemCombine: 'ราศีบนฮะ (天干合)',
  none: 'ไม่มีปฏิกิริยาตรง',
}

/** The reaction inside a sentence: "<animal> … ". */
export const RELATION_IN_SENTENCE: Record<Relation, string> = {
  chong: 'ชงกับปีมะแม', samheng: 'ครบซำเฮ้งกับปีมะแม', heng: 'โดนเฮ้งจากปีมะแม', hai: 'โดนไห่จากปีมะแม',
  phua: 'เกิดผั่วกับปีมะแม', stemClash: 'ราศีบนปะทะไฟของปี', same: 'เป็นนักษัตรเดียวกับปีมะแม',
  six: 'จับมือกับปีมะแม', half3: 'รวมกลุ่มกับปีมะแม', stemCombine: 'ความคิดเข้ากับไฟของปี', none: 'ไม่มีปฏิกิริยาตรงกับปีมะแม',
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
  six: 'ฮะ: สองตัวรวมกันแล้วแปรสภาพ เกิดธาตุใหม่เพิ่มขึ้น มีคนจับมือช่วยในเรื่องของเสานี้',
  half3: 'ภาคี: รวมกลุ่มกับปีแล้วได้ธาตุเพิ่ม ครบอีกตัวในเดือนที่ใช่ โอกาสจะเด่นขึ้น',
  stemCombine: 'ราศีบนฮะ: ความคิดรวมกับพลังของปีแล้วแปรสภาพ เจรจาและร่วมมือได้ง่าย',
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
  // ฮะ, from the Sinse (2026-11-20): 午+未 ภาคี合 แปรสภาพเป็นธาตุไฟ; 卯 ภาคีกับ 未 ซึ่งเป็นคลังไม้ ได้ธาตุไม้.
  'six:午': '午 กับ 未 ฮะกัน (午未合) รวมกันแล้วแปรสภาพเป็นธาตุไฟ เกิดคุณสมบัติใหม่เพิ่มขึ้น เรื่องของเสานี้ได้แรงหนุนจากคนที่เข้าขากัน',
  'half3:卯': '卯 ไม้เบ้า มาภาคีกับ 未 ซึ่งเป็นคลังไม้ (亥卯未) ได้ธาตุไม้เพิ่ม เรื่องของเสานี้มีคนรวมกลุ่มช่วย',
  'half3:亥': '亥 มาภาคีกับ 未 ซึ่งเป็นคลังไม้ (亥卯未) ได้ธาตุไม้เพิ่ม เรื่องของเสานี้มีคนรวมกลุ่มช่วย',
  'stemCombine:壬': '丁 ของปีฮะกับ 壬 ของคุณ (丁壬合) แปรสภาพเป็นธาตุไม้ ความคิดเข้ากับจังหวะของปี เจรจาง่าย',
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
  six: ['มีคนจับมือ', 'ได้ธาตุไฟเพิ่ม'],
  half3: ['มีคนรวมกลุ่ม', 'ได้ธาตุไม้เพิ่ม'],
  stemCombine: ['คุยกันง่าย', 'ได้ธาตุไม้เพิ่ม'],
  none: ['ปีนิ่ง', 'เดินตามแผน'],
}

type Reading = {
  /** Layer 1, plain words: the pillar's life area and what the year does to it. */
  headline: string
  /** The Sinse's story for the strongest reaction on this pillar. */
  story: string
  /** Layer 2, for readers who know the chart: each reaction, the characters it joins and where. */
  details: Array<{ name: string; why: string; story: string }>
  /** Layer 3: what to do, by the pillar's area and the reaction. */
  actions: [string, string, string]
}

/** Layer 1: what the reaction means in plain words. */
export const PLAIN: Record<Relation, string> = {
  chong: 'มีเรื่องเปลี่ยนกะทันหัน ของเดิมอาจไม่อยู่ที่เดิม',
  samheng: 'แรงกดดันมาหลายทางพร้อมกัน',
  heng: 'มีภาระหนักที่ค่อยๆ บั่นทอนแรง',
  hai: 'ระวังคนพูดลับหลังหรือเข้าใจผิด',
  phua: 'มีรอยรั่วเงียบๆ ที่ต้องรีบอุด',
  stemClash: 'ความคิดของคุณสวนทางกับคนรอบตัว',
  same: 'ได้ออกหน้าและถูกจับตามากขึ้น',
  six: 'มีคนจับมือ ได้ธาตุไฟเพิ่ม',
  half3: 'มีคนรวมกลุ่มด้วย ได้ธาตุไม้เพิ่ม',
  stemCombine: 'คุยกันง่าย เจรจาลงตัว',
  none: 'ปีไม่ได้เข้ามาแตะเรื่องนี้โดยตรง เดินตามแผนได้',
}

/** The answer first (owner pick A, 2026-11-20): one line for the whole year, by the strongest reaction. */
export const VERDICT: Record<Relation, string> = {
  chong: 'ปีแห่งการเปลี่ยนแปลง เตรียมแผนไว้ก่อน',
  samheng: 'ปีที่แรงกดดันมาหลายทาง ใจเย็นแล้วผ่านได้',
  heng: 'ปีที่ต้องวางภาระบางอย่างลง',
  hai: 'ปีที่ต้องระวังเรื่องลับหลัง',
  phua: 'ปีที่ต้องอุดรอยรั่ว ก่อนไปต่อ',
  stemClash: 'ปีที่ต้องคิดก่อนพูด',
  same: 'ปีของคุณเอง ได้ออกหน้า',
  six: 'ปีที่มีคนจับมือ ได้พลังไฟเพิ่ม',
  half3: 'ปีที่รวมทีมแล้วได้ธาตุไม้หนุน',
  stemCombine: 'ปีที่เจรจาลงตัว',
  none: 'ปีที่สงบ เดินตามแผนได้',
}

/** The strongest reaction among the pillars, in bazi's order. */
export function strongestOf(relations: string[]): Relation {
  for (const k of RELATIONS) if (relations.includes(k)) return k
  return 'none'
}

/** The pillar's own name, "เสาปี" … "เสายาม". */
export function pillarName(key: PillarKey): string {
  return `เสา${AREA[key].label.split(' · ')[0].replace('เกิด', '')}`
}

/** The pillar's life area alone: "สังคมและผู้ใหญ่". */
export function areaOf(key: PillarKey): string {
  return AREA[key].label.split(' · ')[1]
}

/** Layer 2: which character of the year meets which of yours, and where. The verb sits between them. */
const VERB: Record<Exclude<Relation, 'none' | 'phua' | 'samheng' | 'same'>, string> = {
  chong: 'ชง',
  heng: 'เฮ้ง',
  hai: 'ไห่',
  stemClash: 'ปะทะ',
  six: 'ฮะ',
  half3: 'ภาคีกับ',
  stemCombine: 'ฮะ',
}

/** The year's own character in a reaction. For ผั่ว on a bottom character bazi sends the year's branch,
 *  but the year's character there is its stem (丁 over your animal), the first of the pair. */
export function yearCharOf(r: ReactionFact): string {
  if (r.kind === 'phua' && r.pair && r.pair.length === 2) return r.at === 'bottom' ? r.pair[0] : r.pair[1]
  return r.year
}

export function whyOf(r: ReactionFact): string {
  const where = `${AT_TH[r.at]}${pillarName(r.pillar)}`
  if (r.kind === 'phua') {
    const meet = r.at === 'top' ? `${r.mine} ของคุณมาเจอ ${yearCharOf(r)} ของปี` : `${yearCharOf(r)} ของปีมาเจอ ${r.mine} ของคุณ`
    return r.pair ? `${r.pair} · ${meet} · ${where}` : `${meet} · ${where}`
  }
  if (r.kind === 'samheng') return `${r.pair ? `${r.pair} ` : ''}ครบสามตัวกับ ${r.year} ของปี · ${where}`
  if (r.kind === 'same') return `${r.year} ของปีตรงกับ ${r.mine} ของคุณ · ${where}`
  return `${r.year} ของปี ${VERB[r.kind]} ${r.mine} ของคุณ${r.into ? intoWords(r.into) : ''} · ${where}`
}

export const ELEMENT_EN_TH: Record<string, string> = { wood: 'ไม้', fire: 'ไฟ', earth: 'ดิน', metal: 'ทอง', water: 'น้ำ' }

/** ฮะ in plain words: what joins, and what the new element is to you. */
export const HE_DOES: Record<string, string> = { six: 'มีคนจับมือ', half3: 'มีคนรวมกลุ่มด้วย', stemCombine: 'คุยกันลงตัว' }
/** On the wheel: "<animal>ของคุณ<verb>กับแพะ". */
export const HE_VERB: Record<string, string> = { six: 'จับมือ', half3: 'รวมกลุ่ม' }

export type He = { element: string; status: NonNullable<ReactionFact['into']>['status']; tone: 'good' | 'care'; gets: string; toYou: string; short: string }

/**
 * A ฮะ as bazi reads it from the engine: the element and how far the pair gets (`into`), and whether
 * that element helps this chart (the engine's 用神 / 忌神 in `luck`). Nothing here is decided on the page.
 */
export function heOf(r: { into?: ReactionFact['into'] }, luck: Luck | null | undefined): He | null {
  const into = r.into; if (!into) return null
  const element = ELEMENT_EN_TH[into.element]; if (!element) return null
  const gets = into.status === 'transformed' || into.status === 'blocked' ? `รวมเป็นธาตุ${element}เต็มตัว` : into.status === 'detected' && into.source === 'engine' ? `ได้ธาตุ${element}นิดหน่อย` : `ได้ธาตุ${element}เพิ่ม`
  const avoid = luck?.avoid.includes(element), favorable = luck?.favorable.includes(element)
  return {
    element, status: into.status, tone: avoid ? 'care' : 'good', gets,
    toYou: avoid ? 'แต่ธาตุนี้ไม่ใช่ธาตุที่ช่วยคุณ อย่ารับงานเกินตัว' : favorable ? 'ธาตุนี้ช่วยหนุนคุณ' : 'เป็นแรงเสริมกลางๆ',
    short: avoid ? 'แต่ไม่ใช่ธาตุที่ช่วยคุณ' : favorable ? 'ช่วยหนุนคุณ' : '',
  }
}

/** The Sinse's chart words for a ฮะ outcome (inside "ดูแบบซินแส" only). */
function intoWords(into: NonNullable<ReactionFact['into']>): string {
  const el = ELEMENT_EN_TH[into.element] ?? ''
  if (into.source === 'sinse') return ` รวมเป็นธาตุ${el} (ตามคำอธิบายของซินแส)`
  return { transformed: ` แปรสภาพเป็นธาตุ${el}`, blocked: ` ครบชุดสามตัว ธาตุ${el}`, supported: ` มีแรงไปทางธาตุ${el} (ยังไม่แปร)`, detected: ` ธาตุ${el} แรงน้อย` }[into.status]
}

/** Layer 3: two actions per reaction; the page picks two of four by the pillar, so two pillars with
 *  the same reaction do not read the same. */
const KIND_ACTS: Record<Exclude<Relation, 'none'>, [string, string, string, string]> = {
  chong: ['เตรียมแผนสำรองไว้กับเรื่องที่อาจเปลี่ยนกะทันหัน', 'เผื่อเงินและเวลาไว้ก่อนเริ่มเรื่องใหม่', 'ถ้าต้องย้ายหรือเปลี่ยน เลือกเองก่อนถูกบังคับ', 'ตรวจรถ บ้าน และเอกสารสำคัญให้พร้อม'],
  samheng: ['แก้ทีละเรื่อง เริ่มจากเรื่องที่ค้างนานที่สุด', 'จดไว้ว่าใครเกี่ยวกับเรื่องไหน อย่าให้ปนกัน', 'ไม่รับภาระใหม่จนกว่าเรื่องเก่าจะจบ', 'หาคนกลางที่ไว้ใจได้ช่วยดู'],
  heng: ['ปฏิเสธงานที่เกินแรงอย่างสุภาพ', 'แบ่งภาระให้คนอื่นช่วยถือ', 'อย่าทิ้งความรับผิดชอบแบบหักดิบ', 'พักให้พอก่อนจะหมดแรง'],
  hai: ['เก็บแชตและเอกสารสำคัญไว้เป็นหลักฐาน', 'ไม่เล่าเรื่องส่วนตัวในกลุ่มใหญ่', 'ถ้ามีข่าวลือ คุยกับต้นเรื่องตรงๆ', 'ทำงานสำคัญให้มีคนรู้เห็น'],
  phua: ['ไล่ดูรายจ่ายประจำ แล้วตัดตัวที่รั่ว', 'ไม่ค้ำประกันหรือให้ยืมก้อนใหญ่', 'ดูให้ดีก่อนรับความช่วยเหลือที่มาง่าย', 'ซ่อมของที่เริ่มเสียก่อนจะลาม'],
  stemClash: ['คิดก่อนพูด โดยเฉพาะตอนโกรธ', 'ฟังอีกฝ่ายให้จบก่อนแย้ง', 'เขียนเหตุผลลงกระดาษก่อนตัดสินใจ', 'เรื่องที่เถียงกัน เลื่อนไปคุยวันถัดไป'],
  same: ['รับบทนำในเรื่องที่ถนัด', 'วางตัวนิ่ง พูดน้อยแต่ทำจริง', 'รักษาคำพูด เพราะมีคนจับตาอยู่', 'ใช้ปีนี้สร้างความน่าเชื่อถือ'],
  six: ['ชวนคนที่เข้ากันได้เริ่มงานร่วมกัน', 'ขอความช่วยเหลือได้ อย่าเกรงใจเกินไป', 'ตอบแทนคนที่ช่วยให้เป็นกิจจะลักษณะ', 'เปิดรับพาร์ทเนอร์ใหม่'],
  half3: ['หาทีมที่ใช่แล้วลงมือพร้อมกัน', 'เก็บเรื่องใหญ่ไว้เริ่มในเดือนที่ไตรภาคีครบ', 'เข้ากลุ่มคนในสายงานเดียวกัน', 'แบ่งงานตามความถนัดของแต่ละคน'],
  stemCombine: ['นัดคุยเรื่องสำคัญที่ค้างไว้', 'ขอเจรจาเงื่อนไขใหม่ได้', 'เสนอไอเดียที่คิดไว้นาน', 'ปิดดีลที่ต้องอาศัยความเข้าใจกัน'],
}
const PILLAR_ORDER: PillarKey[] = ['hour', 'day', 'month', 'year']

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

export function readingFor(strongest: Relation, key: PillarKey, reactions: ReactionFact[], luck?: Luck | null): Reading {
  const mine = reactions.filter((r) => r.pillar === key)
  const area = areaOf(key)
  const details = mine.map((r) => ({ name: RELATION_NAME[r.kind], why: whyOf(r), story: storyOf(r) }))
  const lead = mine.find((r) => r.kind === strongest) ?? mine[0]
  const tone = toneOf(mine)
  let actions: [string, string, string] = ACTIONS[tone][key]
  if (lead) {
    const acts = KIND_ACTS[lead.kind]; const at = (PILLAR_ORDER.indexOf(key) * 2) % 4
    actions = [ACTIONS[tone][key][0], acts[at], acts[at + 1]]
  }
  return {
    headline: (() => { const he = lead ? heOf(lead, luck) : null; return he ? `${area}: ${HE_DOES[lead!.kind]} ${he.gets} ${he.short}`.trim() : `${area}: ${PLAIN[lead ? lead.kind : 'none']}` })(),
    story: lead ? storyOf(lead) : '',
    details,
    actions,
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
  six: 'ฮะกัน ปีนี้ช่วยกันได้ดีมาก',
  half3: 'ภาคีกัน ร่วมมือกันแล้วโชคดี',
  stemCombine: 'ราศีบนฮะกัน คุยอะไรก็ลงตัว',
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

/**
 * The year's fire to the day master in plain words (plan revision 0.11). The role and whether fire is
 * this chart's 用神 or 忌神 both come from bazi; the page only words them, so a strong day master fed
 * by fire never reads as "ส่งเสริม … แต่ไม่ช่วย".
 */
export const FIRE_PLAIN: Record<ElementRole, { base: string; fav: string; avoid: string }> = {
  resource: { base: 'ไฟของปีหล่อเลี้ยงตัวคุณ', fav: 'ไฟของปีหล่อเลี้ยงตัวคุณ และเป็นธาตุที่ช่วยคุณ', avoid: 'ไฟของปีหล่อเลี้ยงตัวคุณ แต่ดวงคุณมีพลังพออยู่แล้ว ไฟปีนี้จึงไม่ใช่ตัวช่วยหลัก' },
  companion: { base: 'ไฟของปีเป็นธาตุเดียวกับคุณ', fav: 'ไฟของปีเป็นธาตุเดียวกับคุณ เหมือนมีเพื่อนร่วมทาง', avoid: 'ไฟของปีเป็นธาตุเดียวกับคุณ แต่ดวงคุณมีพลังพออยู่แล้ว ระวังคู่แข่ง' },
  output: { base: 'ไฟของปีพาคุณได้ใช้ฝีมือ', fav: 'ไฟของปีให้คุณได้ใช้ฝีมือเต็มที่', avoid: 'ไฟของปีพาคุณใช้แรงมาก แต่ดวงคุณต้องการแรงหนุนก่อน' },
  wealth: { base: 'ไฟของปีเป็นโอกาสเรื่องเงินของคุณ', fav: 'ไฟของปีเป็นโอกาสเรื่องเงินของคุณ', avoid: 'ไฟของปีมีโอกาสเรื่องเงิน แต่ดวงคุณต้องการแรงหนุนก่อน อย่ารับเกินตัว' },
  power: { base: 'ไฟของปีเป็นแรงกดดันต่อตัวคุณ', fav: 'ไฟของปีเป็นแรงกดดันที่ช่วยให้คุณเติบโต', avoid: 'ไฟของปีเป็นแรงกดดันต่อตัวคุณ ใจเย็นแล้วผ่านได้' },
}
export function fireLine(role: ElementRole, luck: Luck | null | undefined): string {
  const f = FIRE_PLAIN[role]
  if (luck?.favorable.includes('ไฟ')) return f.fav
  if (luck?.avoid.includes('ไฟ')) return f.avoid
  return f.base
}

/** The year's character a reaction meets, in a caption: its top 丁 is the year's fire, its bottom 未 is มะแม. */
export const yearWord = (c: string) => (c === '未' ? 'มะแม' : 'ไฟของปี')
/** The Sinse's word for each reaction inside a caption line: "<ราศีบน|ราศีล่าง><word><yearWord>". */
const CAP_WORD: Record<Exclude<Relation, 'none'>, string> = {
  chong: 'ชงกับ', samheng: 'ครบซำเฮ้งกับ', heng: 'โดนเฮ้งจาก', hai: 'โดนไห่จาก', phua: 'ผั่วกับ', stemClash: 'ปะทะ',
  same: 'ตรงกับ', six: 'ฮะกับ', half3: 'ฮะกับ', stemCombine: 'ฮะกับ',
}
/** How many reactions a caption lists before it points to the chart. */
export const CAPTION_MAX = 3

/**
 * Mu's caption for one pillar in the four-animal scene (plan revision 0.11, the Sinse's check of
 * 2026-11-23): every reaction bazi sends for the pillar, by position and by the year character it
 * meets, then the year's fire on the top character only when no reaction already names that top.
 */
export function pillarCaption(
  p: { key: PillarKey; animal: string; flow: Flow },
  hits: Array<{ pillar: PillarKey; at: 'top' | 'bottom'; kind: Exclude<Relation, 'none'>; year: string; into?: ReactionFact['into'] }>,
  luck: Luck | null | undefined,
): string {
  const head = `${AREA[p.key].label.split(' · ')[0]}ของคุณคือ${p.animal}`
  // top first, as the Sinse reads a pillar; bazi's order (hard reactions first) kept within each
  const mine = hits.filter((h) => h.pillar === p.key).sort((a, b) => (a.at === b.at ? 0 : a.at === 'top' ? -1 : 1))
  if (!mine.length) return `${head} ${RELATION_IN_SENTENCE.none}\n${FLOW_LINE[p.flow]}`
  // short enough that three lines fit under the animals on a 360×640 phone; the cards tell the rest
  const line = (h: (typeof mine)[number]) => {
    const he = heOf(h, luck)
    const says = he ? `${he.gets}${he.tone === 'care' ? ' แต่ไม่ช่วยคุณ' : he.short ? ` ${he.short}` : ''}` : PREVIEW[h.kind][1]
    return `${AT_TH[h.at]}${CAP_WORD[h.kind]}${yearWord(h.year)} · ${says}`
  }
  const shown = mine.length > CAPTION_MAX ? mine.slice(0, CAPTION_MAX - 1) : mine
  const lines = shown.map(line)
  if (mine.length > shown.length) lines.push(`และอีก ${mine.length - shown.length} จุด ดูในผังดวงด้านล่าง`)
  if (!mine.some((h) => h.at === 'top')) lines.push(FLOW_LINE[p.flow])
  return [head, ...lines].join('\n')
}

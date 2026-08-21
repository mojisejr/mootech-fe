import { pgTable, bigserial, text, varchar, bigint, doublePrecision, json, index, uniqueIndex, boolean, primaryKey, uuid, timestamp, integer, date, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ───────────────────────────────────────────────────────────────────────────────────
// DRIZZLE WORKFLOW CONTRACT (snapshot re-baselined 2026-06-25, #mootech-drizzle-rebaseline)
// ───────────────────────────────────────────────────────────────────────────────────
// STATE NOW: schema.ts ≡ meta/0000_snapshot.json ≡ live DB. `drizzle-kit generate` is SAFE
// to run as a DIFF tool — it reports "No schema changes" today, and a real change generates
// clean SQL (verified: a test index produced only `CREATE INDEX`, no rename/drop prompt).
//
// ✅ SAFE: `drizzle-kit generate` (diff/preview only) — it never touches the DB.
// 🚫 STILL FORBIDDEN: `drizzle-kit push` and auto-applying generated SQL via `drizzle migrate`.
//    Migrations are APPLIED BY HAND: write CREATE INDEX CONCURRENTLY IF NOT EXISTS etc. and run
//    it manually on dev → then prod (operator-gated). generated SQL is a starting point you
//    REVIEW, never run blind. (vow: hand-authored migrations on this pgloader'd DB.)
//
// THE OLD LANDMINE (now defused): this schema was introspected from a pgloader'd MySQL→Postgres
// copy. 7 log tables (log_activity, log_matching, log_save_image, log_survey, log_calculate,
// log_work_vibe, log_love_mate) have a literal camelCase column "createAt" (mapped here as the
// `createat` field); every other table uses snake_case "create_at". schema.ts was hand-corrected
// on 2026-06-13 to match the real DB, but BOTH the old snapshot AND the old baseline SQL
// (0000_polite_venus.sql) stayed at the stale "create_at". So `drizzle-kit generate` used to diff
// schema-vs-stale-snapshot, see "create_at gone / createAt new", and PROMPT a rename-or-drop —
// accepting it would have emitted `RENAME`/`DROP COLUMN` = DATA LOSS on those 7 tables.
//   FIX APPLIED: re-baselined the snapshot FROM schema.ts (verified ≡ live DB first; READ-ONLY,
//   no DDL/DML). The stale 0000_polite_venus.sql + the old meta were moved to lib/db/_archive/.
//   The new lib/db/0000_baseline_current.sql is a full-schema baseline that REPRESENTS the
//   already-existing DB — it is reference only, DO NOT RUN it (the tables already exist).
//
// DO NOT "normalize" the createat/createAt/create_at naming — the three casings (TS field
// `createat`, DB column "createAt", JSON `create_at`) are intentional and load-bearing.
// ───────────────────────────────────────────────────────────────────────────────────

export const activity = pgTable("activity", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	description: text().notNull(),
});

export const analyticBase = pgTable("analytic_base", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	element: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
	power: varchar({ length: 255 }).notNull(),
});

export const analyticBeCareful = pgTable("analytic_be_careful", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	power: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
});

export const analyticCharacter = pgTable("analytic_character", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	note: text().notNull(),
});

export const analyticCharacterForShare = pgTable("analytic_character_for_share", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	note: text().notNull(),
});

export const analyticColor = pgTable("analytic_color", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	element: varchar({ length: 255 }).notNull(),
	level: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequence: bigint({ mode: "number" }).notNull(),
	note: text().notNull(),
});

export const analyticElementalCharacteristicsCalculate = pgTable("analytic_elemental_characteristics_calculate", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	detail: varchar({ length: 255 }).notNull(),
	weight: doublePrecision().notNull(),
	gainElements: json("gain_elements"),
});

export const analyticElementalCharacteristicsElementResult = pgTable("analytic_elemental_characteristics_element_result", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	level: varchar({ length: 255 }).notNull(),
	element: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequence: bigint({ mode: "number" }).notNull(),
});

export const analyticElementalCharacteristicsResult = pgTable("analytic_elemental_characteristics_result", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	level: varchar({ length: 255 }).notNull(),
	remark: varchar({ length: 255 }).notNull(),
	startScore: doublePrecision("start_score").notNull(),
	endScore: doublePrecision("end_score").notNull(),
});

export const analyticFeature = pgTable("analytic_feature", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	element: varchar({ length: 255 }).notNull(),
	behavior: text().notNull(),
	occupations: text().notNull(),
	colors: text().notNull(),
	sacredThings: text("sacred_things").notNull(),
});

export const analyticHabit = pgTable("analytic_habit", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	level: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
	power: varchar({ length: 255 }).notNull(),
});

export const analyticLove = pgTable("analytic_love", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	note: text().notNull(),
});

export const analyticOccupation = pgTable("analytic_occupation", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequence: bigint({ mode: "number" }).notNull(),
	note: text().notNull(),
	topic: text().notNull(),
});

export const analyticSacredThing = pgTable("analytic_sacred_thing", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	element: varchar({ length: 255 }).notNull(),
	level: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	sequence: bigint({ mode: "number" }).notNull(),
	note: text().notNull(),
});

export const calendar100Year = pgTable("calendar100_year", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startYear: bigint("start_year", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startMonth: bigint("start_month", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startDate: bigint("start_date", { mode: "number" }).notNull(),
	startTime: varchar("start_time", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	endYear: bigint("end_year", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	endMonth: bigint("end_month", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	endDate: bigint("end_date", { mode: "number" }).notNull(),
	endTime: varchar("end_time", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bigStartYear: bigint("big_start_year", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bigStartMonth: bigint("big_start_month", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bigStartDate: bigint("big_start_date", { mode: "number" }).notNull(),
	bigStartTime: varchar("big_start_time", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bigEndYear: bigint("big_end_year", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bigEndMonth: bigint("big_end_month", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bigEndDate: bigint("big_end_date", { mode: "number" }).notNull(),
	bigEndTime: varchar("big_end_time", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	smallStartYear: bigint("small_start_year", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	smallStartMonth: bigint("small_start_month", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	smallStartDate: bigint("small_start_date", { mode: "number" }).notNull(),
	smallStartTime: varchar("small_start_time", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	smallEndYear: bigint("small_end_year", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	smallEndMonth: bigint("small_end_month", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	smallEndDate: bigint("small_end_date", { mode: "number" }).notNull(),
	smallEndTime: varchar("small_end_time", { length: 255 }).notNull(),
});

export const chineseCalendarDescAbove = pgTable("chinese_calendar_desc_above", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
});

export const chineseCalendarDescBelow = pgTable("chinese_calendar_desc_below", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
});

export const chineseHoroscope8SquareAbove = pgTable("chinese_horoscope8_square_above", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().notNull(),
	chineseSymbol: varchar("chinese_symbol", { length: 255 }).notNull(),
	pronunciation: varchar({ length: 255 }).notNull(),
	power: varchar({ length: 255 }).notNull(),
	element: varchar({ length: 255 }).notNull(),
	direction: varchar({ length: 255 }).notNull(),
	color: varchar({ length: 255 }).notNull(),
});

export const chineseHoroscope8SquareBelow = pgTable("chinese_horoscope8_square_below", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().notNull(),
	constellation: varchar({ length: 255 }).notNull(),
	chineseSymbol: varchar("chinese_symbol", { length: 255 }).notNull(),
	pronunciation: varchar({ length: 255 }).notNull(),
	power: varchar({ length: 255 }).notNull(),
	element: varchar({ length: 255 }).notNull(),
	direction: varchar({ length: 255 }).notNull(),
	color: varchar({ length: 255 }).notNull(),
});

export const chineseHoroscope8SquareHiddenZodiac = pgTable("chinese_horoscope8_square_hidden_zodiac", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	belowId: bigint("below_id", { mode: "number" }).primaryKey().notNull(),
	hiddenZodiac: varchar("hidden_zodiac", { length: 255 }).notNull(),
});

export const chineseHoroscope8SquareMonthChinese = pgTable("chinese_horoscope8_square_month_chinese", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthChineseId: bigint("month_chinese_id", { mode: "number" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startDay: bigint("start_day", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	startMonth: bigint("start_month", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	endDay: bigint("end_day", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	endMonth: bigint("end_month", { mode: "number" }).notNull(),
	startDate: varchar("start_date", { length: 255 }).notNull(),
	endDate: varchar("end_date", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	chineseHoroscope8SquareBelowId: bigint("chinese_horoscope_8_square_below_id", { mode: "number" }).notNull(),
});

export const color = pgTable("color", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	hex: varchar({ length: 255 }).notNull(),
});

export const compatibilityLove = pgTable("compatibility_love", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearAboveId: bigint("year_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearBelowId: bigint("year_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const compatibilityLoveDescription = pgTable("compatibility_love_description", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
});

export const compatibilityLoveRating = pgTable("compatibility_love_rating", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	startScore: doublePrecision("start_score").notNull(),
	endScore: doublePrecision("end_score").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rating: bigint({ mode: "number" }).notNull(),
	note: text().notNull(),
});

export const compatibilityWork = pgTable("compatibility_work", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearAboveId: bigint("year_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearBelowId: bigint("year_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const compatibilityWorkDescription = pgTable("compatibility_work_description", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
	boss: text().notNull(),
	employee: text().notNull(),
	friend: text().notNull(),
});

export const compatibilityWorkRating = pgTable("compatibility_work_rating", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	startScore: doublePrecision("start_score").notNull(),
	endScore: doublePrecision("end_score").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	rating: bigint({ mode: "number" }).notNull(),
	note: text().notNull(),
});

export const direction = pgTable("direction", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	description: text().notNull(),
});

export const elementCycle = pgTable("element_cycle", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	element: varchar({ length: 255 }).notNull(),
	power: varchar({ length: 255 }).notNull(),
	gender: varchar({ length: 255 }).notNull(),
	elementFriend: varchar("element_friend", { length: 255 }).notNull(),
	elementWork: varchar("element_work", { length: 255 }).notNull(),
	elementCareer: varchar("element_career", { length: 255 }).notNull(),
	elementFortune: varchar("element_fortune", { length: 255 }).notNull(),
	elementSpouse: varchar("element_spouse", { length: 255 }).notNull(),
	elementSupporter: varchar("element_supporter", { length: 255 }).notNull(),
});

export const employee = pgTable("employee", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: text().notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
});

export const fortuneStick = pgTable("fortune_stick", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	mascotId: bigint("mascot_id", { mode: "number" }).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
});

export const fortuneTelling = pgTable("fortune_telling", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	no: bigint({ mode: "number" }).notNull(),
	image: text().notNull(),
});

export const fortuneTellingLog = pgTable("fortune_telling_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cardNo: bigint("card_no", { mode: "number" }).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
}, (table) => [
	// (#mootech-latency-user-fold) /api/user runs `count(*) WHERE user_id` on this table on
	// every user load (header/profile/my-destiny). Without this index that count was a full
	// table scan (~2s). Mirrors the existing log_* user_id indexes (e.g. idx on log_activity).
	index("idx_fortune_telling_log_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const heavenlySpiritCard = pgTable("heavenly_spirit_card", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	no: bigint({ mode: "number" }).notNull(),
	messageFromHeaven: text("message_from_heaven").notNull(),
	image: text().notNull(),
	sacredThings: text("sacred_things").notNull(),
	keywordTh: text("keyword_th").notNull(),
	keywordEn: text("keyword_en").notNull(),
	vision: text().notNull(),
});

export const heavenlySpiritCardLog = pgTable("heavenly_spirit_card_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	cardNo: bigint("card_no", { mode: "number" }).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
});

export const logActivity = pgTable("log_activity", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	createat: varchar("createAt", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	activityId: bigint("activity_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	point: bigint({ mode: "number" }).notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
}, (table) => [
	index("idx_17837_idx_07f4db96621b76d710322d0330").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	// Added for the ops dashboard's date-range aggregate (#mumate-ops-dashboard-phase1 Step 3) —
	// this table had no index on createAt, so the range filter was a full seq scan.
	index("idx_ops_log_activity_createat").using("btree", table.createat.asc().nullsLast().op("text_ops")),
]);

export const logAi = pgTable("log_ai", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	aiType: varchar("ai_type", { length: 255 }).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	message: text().notNull(),
}, (table) => [
	// #mumate-ops-dashboard-pr56 — same pattern as the 4 indexes added in PR#55
	// (lib/db/0002_add_ops_date_indexes.sql): date-range filters on this varchar column were a
	// Seq Scan (small today, 801 rows, but same growth risk as the others).
	index("idx_ops_log_ai_createat").using("btree", table.createAt.asc().nullsLast().op("text_ops")),
]);

export const logMatching = pgTable("log_matching", {
	matchingId: varchar("matching_id", { length: 255 }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	createat: varchar("createAt", { length: 255 }).notNull(),
	type: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	dob: varchar({ length: 255 }).notNull(),
	time: varchar({ length: 255 }).notNull(),
	isRememberTime: boolean("is_remember_time").notNull(),
	gender: varchar({ length: 255 }),
	yourName: varchar("your_name", { length: 255 }).notNull(),
	yourDob: varchar("your_dob", { length: 255 }).notNull(),
	yourTime: varchar("your_time", { length: 255 }).notNull(),
	yourIsRememberTime: boolean("your_is_remember_time").notNull(),
	yourGender: varchar("your_gender", { length: 255 }),
	result: text().notNull(),
	friendId: varchar("friend_id", { length: 255 }),
}, (table) => [
	index("idx_17867_idx_d9ad34068424b937e8091ee2ba").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const logMemberPayAsUse = pgTable("log_member_pay_as_use", {
	userId: text("user_id").notNull(),
	paymentId: text("payment_id").notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	total: bigint({ mode: "number" }).notNull(),
	id: varchar({ length: 36 }).primaryKey().notNull(),
});

export const logSaveImage = pgTable("log_save_image", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	createat: varchar("createAt", { length: 255 }).notNull(),
	page: varchar({ length: 255 }).default('PROFILE').notNull(),
}, (table) => [
	index("idx_17880_idx_0d3a2328bbbb156b0c292eac08").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const logSurvey = pgTable("log_survey", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	createat: varchar("createAt", { length: 255 }).notNull(),
	code: varchar({ length: 255 }).notNull(),
	result: text().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
}, (table) => [
	index("idx_17888_idx_30fe18a08c1c49be225ac9ab75").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("idx_17888_idx_ae653a048f9293d99b70f68ba9").using("btree", table.code.asc().nullsLast().op("text_ops")),
	// #mumate-ops-dashboard-phase1 Step 3 — see log_activity above.
	index("idx_ops_log_survey_createat").using("btree", table.createat.asc().nullsLast().op("text_ops")),
]);

export const logCalculate = pgTable("log_calculate", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	createat: varchar("createAt", { length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	dob: varchar({ length: 255 }).notNull(),
	time: varchar({ length: 255 }).notNull(),
	gender: varchar({ length: 255 }),
	isRememberTime: boolean("is_remember_time").notNull(),
	placeName: varchar("place_name", { length: 255 }),
	code: varchar({ length: 255 }).notNull(),
	result: text().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
}, (table) => [
	index("idx_17851_idx_385729c804d03bd4b22c151ac4").using("btree", table.code.asc().nullsLast().op("text_ops")),
	index("idx_17851_idx_7f3196edaae4f8c9e45375471c").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	// #mumate-ops-dashboard-phase1 Step 3 — see log_activity above.
	index("idx_ops_log_calculate_createat").using("btree", table.createat.asc().nullsLast().op("text_ops")),
]);

export const logWorkVibe = pgTable("log_work_vibe", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	createat: varchar("createAt", { length: 255 }).notNull(),
	type: varchar({ length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	dob: varchar({ length: 255 }).notNull(),
	time: varchar({ length: 255 }).notNull(),
	isRememberTime: boolean("is_remember_time").notNull(),
	gender: varchar({ length: 255 }),
	yourName: varchar("your_name", { length: 255 }).notNull(),
	yourDob: varchar("your_dob", { length: 255 }).notNull(),
	yourTime: varchar("your_time", { length: 255 }).notNull(),
	yourIsRememberTime: boolean("your_is_remember_time").notNull(),
	yourGender: varchar("your_gender", { length: 255 }),
	result: text().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
}, (table) => [
	index("idx_17895_idx_ae56335ed1cd4d4f2f28e09fac").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const logLoveMate = pgTable("log_love_mate", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	createat: varchar("createAt", { length: 255 }).notNull(),
	name: varchar({ length: 255 }).notNull(),
	dob: varchar({ length: 255 }).notNull(),
	time: varchar({ length: 255 }).notNull(),
	isRememberTime: boolean("is_remember_time").notNull(),
	gender: varchar({ length: 255 }),
	yourName: varchar("your_name", { length: 255 }).notNull(),
	yourDob: varchar("your_dob", { length: 255 }).notNull(),
	yourTime: varchar("your_time", { length: 255 }).notNull(),
	yourIsRememberTime: boolean("your_is_remember_time").notNull(),
	yourGender: varchar("your_gender", { length: 255 }),
	result: text().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
}, (table) => [
	index("idx_17859_idx_225062e6eabb0158e6e89e4b41").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const mascot = pgTable("mascot", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	url: varchar({ length: 255 }).notNull(),
	gender: varchar({ length: 255 }),
	dayAboveElement: varchar("day_above_element", { length: 255 }).notNull(),
	power: varchar({ length: 255 }).notNull(),
	description: varchar({ length: 255 }).notNull(),
});

export const mascotV2 = pgTable("mascot_v2", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	power: varchar({ length: 255 }).notNull(),
	element: varchar({ length: 255 }).notNull(),
	url: varchar({ length: 255 }).notNull(),
	description: varchar({ length: 255 }).notNull(),
	mascotName: varchar("mascot_name", { length: 255 }).notNull(),
	behaviour: text().notNull(),
	person: text().notNull(),
	work: text().notNull(),
	wealth: text().notNull(),
	health: text().notNull(),
	love: text().notNull(),
	family: text().notNull(),
	sacredItem: text("sacred_item").notNull(),
	urlShare: text("url_share").notNull(),
});

export const matching = pgTable("matching", {
	createAt: varchar("create_at", { length: 255 }).notNull(),
	id: varchar({ length: 36 }).primaryKey().notNull(),
	friendId: text("friend_id").notNull(),
	matchingType: varchar("matching_type", { length: 255 }).notNull(),
	userId: text("user_id").notNull(),
});

export const member = pgTable("member", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	username: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	firstName: varchar("first_name", { length: 255 }).notNull(),
	lastName: varchar("last_name", { length: 255 }).notNull(),
	role: varchar({ length: 255 }).notNull(),
	updateAt: varchar("update_at", { length: 255 }).notNull(),
});

export const memberPayment = pgTable("member_payment", {
	userId: varchar("user_id", { length: 255 }).primaryKey().notNull(),
	planCode: text("plan_code").notNull(),
	packageCode: text("package_code").notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	startAt: varchar("start_at", { length: 255 }).notNull(),
	expireAt: varchar("expire_at", { length: 255 }).notNull(),
}, (table) => [
	index("idx_member_payment_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const memberPaymentCode = pgTable("member_payment_code", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	code: text().notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	ownerBy: varchar("owner_by", { length: 255 }).notNull(),
});

export const memberPaymentCodeLog = pgTable("member_payment_code_log", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	memberPaymentCodeId: text("member_payment_code_id").notNull(),
	userId: text("user_id").notNull(),
	code: text().notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
});

export const memberPaymentLog = pgTable("member_payment_log", {
	planCode: text("plan_code").notNull(),
	packageCode: text("package_code").notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	startAt: varchar("start_at", { length: 255 }).notNull(),
	expireAt: varchar("expire_at", { length: 255 }).notNull(),
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	paymentId: text("payment_id").notNull(),
	code: text().notNull(),
});

export const memberPayAsUse = pgTable("member_pay_as_use", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	total: bigint({ mode: "number" }).notNull(),
	updateAt: varchar("update_at", { length: 255 }).notNull(),
	userId: varchar("user_id", { length: 255 }).primaryKey().notNull(),
	// Added to match live DB (#mumate-ops-dashboard-pr56) — this column already exists in
	// production, created by mootech-be's own migration
	// (member-pay-as-use/migrations/2026-06-26-wallet-balance.sql), NOT by this repo. schema.ts
	// was just never updated to know about it. Decrement-only spendable wallet balance; `total`
	// stays a cumulative-purchased audit trail. Verified live: information_schema says `integer`.
	balance: integer("balance").notNull().default(0),
});

export const otp = pgTable("otp", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	tel: varchar({ length: 255 }).notNull(),
	message: varchar({ length: 255 }).notNull(),
	refCode: varchar("ref_code", { length: 255 }).notNull(),
	code: varchar({ length: 255 }).notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	expireAt: varchar("expire_at", { length: 255 }).notNull(),
	verifyAt: varchar("verify_at", { length: 255 }),
});

export const payment = pgTable("payment", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	paymentPlan: text("payment_plan").notNull(),
	paymentPackage: text("payment_package").notNull(),
	paymentPackageName: text("payment_package_name").notNull(),
	paymentAmount: doublePrecision("payment_amount").notNull(),
	file: text().notNull(),
	date: varchar({ length: 255 }).notNull(),
	time: varchar({ length: 255 }).notNull(),
	amount: doublePrecision().notNull(),
	status: varchar({ length: 255 }).default('WAIT').notNull(),
	note: text(),
	submitAt: varchar("submit_at", { length: 255 }).notNull(),
	approveAt: varchar("approve_at", { length: 255 }),
	approveBy: varchar("approve_by", { length: 255 }),
	email: text().notNull(),
	orderId: text("order_id").notNull(),
	paymentBy: varchar("payment_by", { length: 255 }).default('TRANSFER').notNull(),
	chargeId: text("charge_id").notNull(),
}, (table) => [
	index("idx_payment_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	// #mumate-ops-dashboard-phase1 Step 3 — see log_activity above.
	index("idx_ops_payment_submit_at").using("btree", table.submitAt.asc().nullsLast().op("text_ops")),
]);

export const paymentPackage = pgTable("payment_package", {
	planCode: text("plan_code").notNull(),
	packageCode: text("package_code").notNull(),
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	description: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	bufferDay: bigint("buffer_day", { mode: "number" }).default(sql`'0'`).notNull(),
	amount: doublePrecision().default(sql`'0'`).notNull(),
	expire: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	maxUser: bigint("max_user", { mode: "number" }).default(sql`'1'`).notNull(),
});

export const paymentPlan = pgTable("payment_plan", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	planCode: text("plan_code").notNull(),
	description: text().notNull(),
});

export const powerCustomer = pgTable("power_customer", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearAboveId: bigint("year_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearBelowId: bigint("year_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const paymentCode = pgTable("payment_code", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: text().notNull(),
	planCode: text("plan_code").notNull(),
	packageCode: text("package_code").notNull(),
	description: text().notNull(),
	expire: varchar({ length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	maxUse: bigint("max_use", { mode: "number" }).default(sql`'1'`).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	isActive: boolean("is_active").notNull(),
});

// v2 membership store (mootech-fe#354, migration 0006). NOT an extension of member_payment: user_id is a
// plain column (many rows / history per human), money is integer สตางค์, start_at/expire_at are real DATE.
// Nobody flips status in Phase 2 — expiry is computed at read (expire_at vs today Asia/Bangkok); the reader
// (lib/v2/subscription.ts) excludes non-ACTIVE and past-expire rows. See 0006_member_subscription.sql.
export const memberSubscription = pgTable("member_subscription", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => user.userId),
	tierCode: text("tier_code").notNull(),
	packageCode: text("package_code").notNull(),
	amountSatang: integer("amount_satang").notNull(),
	startAt: date("start_at").notNull(),
	expireAt: date("expire_at").notNull(),
	paymentId: text("payment_id").references(() => payment.id),
	// v2 link (#355, added by 0007's ALTER): the v2_payment that created this row. #354's payment_id FK
	// points at the v1 `payment` table (unused by v2 → NULL for v2 rows); this points at v2_payment.
	v2PaymentId: varchar("v2_payment_id", { length: 36 }).references(() => v2Payment.id),
	status: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	index("idx_member_subscription_user_id").on(table.userId),
	// CHECK mirrors 0006 (Postgres names an inline column CHECK <table>_<column>_check, so these agree).
	check("member_subscription_tier_code_check", sql`${table.tierCode} IN ('FREE','PLUS','PRO')`),
	check("member_subscription_status_check", sql`${table.status} IN ('ACTIVE','EXPIRED','REPLACED')`),
]);

// v2 payment records (mootech-fe#355, migration 0007). Separate from v1 `payment`: the webhook settles by
// a conditional UPDATE on `status` (charge_id UNIQUE) so double-delivery provisions at-most-once. tier_code
// is server-written from lib/payment/catalog.ts. See 0007_v2_payment.sql.
export const v2Payment = pgTable("v2_payment", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull().references(() => user.userId),
	packageCode: text("package_code").notNull(),
	tierCode: text("tier_code").notNull(),
	amountSatang: integer("amount_satang").notNull(),
	vatSatang: integer("vat_satang").default(0).notNull(),
	// duration frozen at charge (ตู๋ #370 B2) — raw '1M'/'1Y' string + buffer, so settle never re-reads payment_package.
	expire: text().notNull(),
	bufferDay: integer("buffer_day").default(0).notNull(),
	method: text().notNull(),
	chargeId: text("charge_id").notNull(),
	orderId: text("order_id").notNull(),
	status: text().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("uq_v2_payment_charge_id").on(table.chargeId),
	index("idx_v2_payment_user_id").on(table.userId),
	// CHECK mirrors 0007 (Postgres names an inline column CHECK <table>_<column>_check, so these agree).
	check("v2_payment_tier_code_check", sql`${table.tierCode} IN ('FREE','PLUS','PRO')`),
	check("v2_payment_method_check", sql`${table.method} IN ('card','promptpay')`),
	check("v2_payment_status_check", sql`${table.status} IN ('PENDING','APPROVED','REJECT')`),
	check("v2_payment_expire_check", sql`${table.expire} ~ '^[0-9]+[DMY]$'`),
]);

export const memberWithFriend = pgTable("member_with_friend", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: text(),
	surname: text(),
	pictureUrl: text("picture_url"),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	updateAt: varchar("update_at", { length: 255 }).notNull(),
	dob: varchar({ length: 255 }).notNull(),
	time: varchar({ length: 255 }).notNull(),
	isRememberTime: boolean("is_remember_time").notNull(),
	gender: varchar({ length: 255 }),
	placeName: text("place_name").notNull(),
	isMember: boolean("is_member").notNull(),
	memberId: text("member_id").notNull(),
	isNotify: boolean("is_notify").notNull(),
}, (table) => [
	// (#mootech-latency-user-fold) /api/user runs `count(*) WHERE user_id` on this table on
	// every user load. Without this index that count was a full table scan. Mirrors the
	// existing user_id indexes on member_payment / payment / user_matching.
	index("idx_member_with_friend_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const powerCustomerDescription = pgTable("power_customer_description", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
});

export const powerEducation = pgTable("power_education", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthAboveId: bigint("month_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthBelowId: bigint("month_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const powerEducationDescription = pgTable("power_education_description", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
});

export const powerFinance = pgTable("power_finance", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	aboveId: bigint("above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	belowId: bigint("below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fortuneAboveId: bigint("fortune_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	fortuneBelowId: bigint("fortune_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const powerFinanceDescription = pgTable("power_finance_description", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
});

export const powerFinanceExtra = pgTable("power_finance_extra", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const powerFriendly = pgTable("power_friendly", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	note: text().notNull(),
});

export const powerFinanceFortune = pgTable("power_finance_fortune", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	isAbove: boolean("is_above").notNull(),
	isReal: boolean("is_real").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	chineseSymbolId: bigint("chinese_symbol_id", { mode: "number" }).notNull(),
});

export const powerKnowledge = pgTable("power_knowledge", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeAboveId: bigint("time_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeBelowId: bigint("time_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const powerKnowledgeDescription = pgTable("power_knowledge_description", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
});

export const predictionWork = pgTable("prediction_work", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayBelowId: bigint("day_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthAboveId: bigint("month_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthBelowId: bigint("month_below_id", { mode: "number" }).notNull(),
	score: doublePrecision().notNull(),
	details: text().notNull(),
});

export const predictionWorkDescription = pgTable("prediction_work_description", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	note: text().notNull(),
});

export const scaredThing = pgTable("scared_thing", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	code: varchar({ length: 255 }).notNull(),
	name: text().notNull(),
	url: text().notNull(),
});

export const product = pgTable("product", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	name: text().notNull(),
	url: text().notNull(),
	description: text().notNull(),
	image: text().notNull(),
	isShow: boolean("is_show").notNull(),
	element: text().notNull(),
	productType: text("product_type").notNull(),
});

export const user = pgTable("user", {
	userId: varchar("user_id", { length: 36 }).primaryKey().notNull(),
	name: text(),
	pictureUrl: text("picture_url"),
	tel: varchar({ length: 255 }),
	email: text(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	updateAt: varchar("update_at", { length: 255 }).notNull(),
	surname: text(),
	referCode: text("refer_code"),
	loginAt: varchar("login_at", { length: 255 }).notNull(),
	dob: varchar({ length: 255 }).notNull(),
	time: varchar({ length: 255 }).notNull(),
	isRememberTime: boolean("is_remember_time").notNull(),
	gender: varchar({ length: 255 }),
	resultCode: text("result_code").notNull(),
	placeName: text("place_name").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	usedPoint: bigint("used_point", { mode: "number" }).default(sql`'0'`).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	totalPoint: bigint("total_point", { mode: "number" }).default(sql`'20'`).notNull(),
	isRefresh: boolean("is_refresh").notNull(),
	shareImgProfileUrl: text("share_img_profile_url").notNull(),
	accountName: text("account_name"),
	// v2 first-run onboarding (#233) — added to the DB by migrations/2026-08-09_onboarding-consent.sql.
	// Nullable: NULL = user has not finished v2 first-run. NB: GET /user (pages/api/user.ts) uses raw
	// `SELECT *`, so it already returns these as snake_case keys regardless of this schema; these entries
	// keep the Drizzle typed schema honest for any typed query.
	onboardedAt: text("onboarded_at"),
	onboardingGoal: text("onboarding_goal"),
});

export const userFriendGetFriend = pgTable("user_friend_get_friend", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	userId: text("user_id"),
	referUserId: text("refer_user_id"),
	createAt: varchar("create_at", { length: 255 }).notNull(),
});

export const userMatching = pgTable("user_matching", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	friendId: text("friend_id").notNull(),
	matchingType: varchar("matching_type", { length: 255 }).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
}, (table) => [
	index("idx_user_matching_user_id").using("btree", table.userId.asc().nullsLast().op("text_ops")),
]);

export const userProvider = pgTable("user_provider", {
	id: varchar({ length: 36 }).primaryKey().notNull(),
	userId: text("user_id").notNull(),
	provider: text().notNull(),
	name: text(),
	pictureUrl: text("picture_url"),
	email: text().notNull(),
	idToken: text("id_token").notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	updateAt: varchar("update_at", { length: 255 }).notNull(),
});

export const useProvider = pgTable("use_provider", {
	userId: varchar("user_id", { length: 255 }).primaryKey().notNull(),
	name: text(),
	pictureUrl: text("picture_url"),
	email: text().notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	updateAt: varchar("update_at", { length: 255 }).notNull(),
});

// ── PWA push (mootech-fe#287) — NEW tables only, never altering the pgloader'd legacy tables above.
// These two use MODERN types (uuid PK, timestamptz) — unlike the legacy string "create_at" columns —
// because they are born here, not introspected. The migration is hand-authored in lib/db/0005_*.sql
// and applied BY HAND on dev → prod (operator-gated); nothing here runs DDL. No FK to "user" (this DB
// avoids hard FKs — see the legacy tables; user_id is a plain scoped column, filtered by session).

// One device's push mailbox. Scoped by (user_id, endpoint): a user registers their own device, and a
// DELETE/read is always filtered by the SESSION's user_id — so no one can overwrite or unsubscribe
// someone else's device (#287's "ปิดเสียงเตือนเขาเงียบๆ" threat). Endpoint is the browser's opaque URL.
export const pushSubscription = pgTable("push_subscription", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	endpoint: text("endpoint").notNull(),
	p256dh: text("p256dh").notNull(),
	auth: text("auth").notNull(),
	userAgent: text("user_agent"),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	// endpoint (the browser's own opaque push URL) is GLOBALLY unique to one device/profile → uniqueness
	// is on endpoint ALONE, not (user_id, endpoint). With (user_id, endpoint) the SAME endpoint could bind
	// to many user_ids (shared browser A→B, or an attacker), and #288's cron would push one account's
	// reminders to another's device — which the victim could NOT remove (DELETE is scoped by their own
	// user_id). One endpoint = one owner; re-subscribing REASSIGNS ownership (POST onConflict → set user_id).
	// (ตู๋ #291 B2)
	uniqueIndex("uq_push_subscription_endpoint").on(table.endpoint),
	index("idx_push_subscription_user_id").on(table.userId),
]);

// A saved reminder = one row per (user, day, ยาม). `fireAtUtc` is the ABSOLUTE instant to notify,
// computed ONCE at save (lib/v2/reminder-time.ts) — never a display string the cron re-parses.
// The natural key (user_id, reminder_date, yam_id) IS the dedup: a lost-response retry re-sends the
// same (user, date, yam) → ON CONFLICT DO NOTHING → exactly one row (business-level idempotency,
// stronger than an opaque token — see #287 comment). `group`/totals are NOT stored (adapter derives).
export const reminder = pgTable("reminder", {
	id: uuid("id").defaultRandom().primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	reminderDate: varchar("reminder_date", { length: 10 }).notNull(), // YYYY-MM-DD, ยาม START's BKK day
	yamId: varchar("yam_id", { length: 8 }).notNull(),
	yamLabel: text("yam_label").notNull(),
	// DB column is `yam_window`, NOT `window`: `window` is a RESERVED keyword in Postgres (WINDOW clause)
	// and an unquoted `window` column fails with a syntax error on raw SQL — caught applying 0005 to a real
	// pg. The TS field stays `window` (API/DTO/client unchanged); only the physical column name differs.
	window: varchar("yam_window", { length: 16 }).notNull(), // "HH:MM-HH:MM" — display only
	destinations: json("destinations").$type<string[]>().notNull(),
	fireAtUtc: timestamp("fire_at_utc", { withTimezone: true }).notNull(),
	// #288's send-marker, added NOW so prod is migrated ONCE (บอง 2026-08-16): NULL = not yet sent,
	// a timestamp = sent. A one-shot reminder needs no separate reminder_sent table — this column IS
	// the "ส่งไปแล้ว" record the cron writes, and the natural key above keeps it one row per (user,date,ยาม).
	sentAt: timestamp("sent_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("uq_reminder_user_date_yam").on(table.userId, table.reminderDate, table.yamId),
	index("idx_reminder_user_id").on(table.userId),
	// #288's cron scans DUE-and-UNSENT reminders. A partial index on fire time WHERE sent_at IS NULL is
	// exactly that scan — added now so that lane is ready without a second prod migration.
	index("idx_reminder_due").on(table.fireAtUtc).where(sql`sent_at IS NULL`),
]);

export const analyticLife = pgTable("analytic_life", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveBelowId: bigint("day_above_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	score: bigint({ mode: "number" }).notNull(),
	isAbove: boolean("is_above").notNull(),
	description: text().notNull(),
	child: text().notNull(),
	teen: text().notNull(),
	adult: text().notNull(),
	elder: text().notNull(),
});

export const chineseHoroscope8SquareAscendant = pgTable("chinese_horoscope8_square_ascendant", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearAboveId: bigint("year_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ascendantAboveId: bigint("ascendant_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ascendantBelowId: bigint("ascendant_below_id", { mode: "number" }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.yearAboveId, table.ascendantAboveId, table.ascendantBelowId], name: "idx_17701_primary"}),
]);

export const chineseHoroscope8SquareCountingIm = pgTable("chinese_horoscope8_square_counting_im", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	aboveId: bigint("above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	belowId: bigint("below_id", { mode: "number" }).notNull(),
	element: varchar({ length: 255 }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.aboveId, table.belowId], name: "idx_17709_primary"}),
]);

export const chineseHoroscope8SquareMonthHongHouTung = pgTable("chinese_horoscope8_square_month_hong_hou_tung", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthChineseId: bigint("month_chinese_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	yearAboveId: bigint("year_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthBelowId: bigint("month_below_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthAboveId: bigint("month_above_id", { mode: "number" }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.monthChineseId, table.yearAboveId], name: "idx_17720_primary"}),
]);

export const holiday = pgTable("holiday", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	day: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	month: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	year: bigint({ mode: "number" }).notNull(),
	date: varchar({ length: 255 }).notNull(),
	description: varchar({ length: 255 }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.day, table.month, table.year], name: "idx_17831_primary"}),
]);

export const chineseHoroscope8SquareTimeHongHouTung = pgTable("chinese_horoscope8_square_time_hong_hou_tung", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeChineseId: bigint("time_chinese_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	dayAboveId: bigint("day_above_id", { mode: "number" }).notNull(),
	startTime: varchar("start_time", { length: 255 }).notNull(),
	endTime: varchar("end_time", { length: 255 }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeAboveId: bigint("time_above_id", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	timeBelowId: bigint("time_below_id", { mode: "number" }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.timeChineseId, table.dayAboveId], name: "idx_17723_primary"}),
]);

export const chineseCalendar = pgTable("chinese_calendar", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	day: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	month: bigint({ mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	year: bigint({ mode: "number" }).notNull(),
	isThaiBuddhistDay: boolean("is_thai_buddhist_day").notNull(),
	isChineseBuddhistDay: boolean("is_chinese_buddhist_day").notNull(),
	chineseTimeCodes: text("chinese_time_codes").notNull(),
	chineseTimeRanges: text("chinese_time_ranges").notNull(),
	scaredThing: varchar("scared_thing", { length: 255 }).notNull(),
	color1: varchar("color_1", { length: 255 }).notNull(),
	color2: varchar("color_2", { length: 255 }).notNull(),
	directionGood: varchar("direction_good", { length: 255 }).notNull(),
	directionBad: varchar("direction_bad", { length: 255 }).notNull(),
	isDoctorDay: boolean("is_doctor_day").notNull(),
	isGoodDay: boolean("is_good_day").notNull(),
	isThianChai: boolean("is_thian_chai").notNull(),
	desc1: varchar("desc_1", { length: 255 }).notNull(),
	desc2: varchar("desc_2", { length: 255 }).notNull(),
	percentage: doublePrecision().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	above1: bigint("above_1", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	above2: bigint("above_2", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	above3: bigint("above_3", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	below1: bigint("below_1", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	below2: bigint("below_2", { mode: "number" }).notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	below3: bigint("below_3", { mode: "number" }).notNull(),
	timeChange: varchar("time_change", { length: 255 }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.day, table.month, table.year, table.percentage, table.above1, table.above2, table.above3, table.below1, table.below2, table.below3], name: "idx_17672_primary"}),
]);

// Ops dashboard identity (#mumate-ops-dashboard-phase1). Isolated from the main product
// tables: only used to populate the /ops gate dropdown and stamp last_seen_at. Not a real
// auth/login system — the actual gate is OPS_DASHBOARD_KEY (shared passkey).
export const dashboardUsers = pgTable("dashboard_users", {
	id: uuid().primaryKey().notNull().default(sql`gen_random_uuid()`),
	name: text().notNull(),
	email: text().unique(),
	role: text().notNull().default('member'),
	isActive: boolean("is_active").notNull().default(true),
	lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

// Public calculator usage counter (#public-bazi-calculator). Deliberately separate from
// LogCalculateService — PDPA-safe by construction: this table has NO PII columns at all (no
// dob/name/gender/IP), just a timestamp per calc event. Ops dashboard aggregates count/trend
// from this directly (GROUP BY date_trunc), no anonymization step needed because nothing
// identifying was ever stored.
export const calculatorUsageLog = pgTable("calculator_usage_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().default(sql`now()`),
});

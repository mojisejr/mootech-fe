import { pgTable, bigserial, text, varchar, bigint, doublePrecision, json, index, boolean, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

// ⚠️⚠️  DO NOT RUN `drizzle-kit generate` / `drizzle-kit push` ON THIS SCHEMA  ⚠️⚠️
// ------------------------------------------------------------------------------------
// MIGRATIONS HERE ARE HAND-AUTHORED. Apply DDL manually (see lib/db/0001_*.sql) — write
// CREATE INDEX CONCURRENTLY IF NOT EXISTS etc. by hand and run it on dev → then prod.
//
// WHY (the landmine): this schema was introspected from a pgloader'd MySQL→Postgres copy.
// 7 log tables (log_activity, log_matching, log_save_image, log_survey, log_calculate,
// log_work_vibe, log_love_mate) have a literal camelCase column "createAt" (mapped here as
// the `createat` field), while every other table uses snake_case "create_at". schema.ts was
// corrected on 2026-06-13 to match the real DB, but the drizzle SNAPSHOT (meta/0000_snapshot.json)
// predates that fix and still thinks those columns are "create_at". So `drizzle-kit generate`
// diffs schema-vs-snapshot, sees "create_at gone / createAt new", and PROMPTS a rename-or-drop.
// Accepting that prompt emits `RENAME COLUMN` or `DROP "create_at" + ADD "createAt"` →
// **DATA LOSS in those 7 log tables**. The app runs fine today; the trap only fires if someone
// runs generate and accepts the prompt. Walk around it: hand-write migrations.
//
// HOW TO ACTUALLY DEFUSE IT later (Option B — re-baseline), and is it safe?
//   * Run `drizzle-kit pull` (introspect dev) → regenerates schema.ts + snapshot from the live
//     DB so they agree again; after that `generate` is clean.
//   * DATA SAFETY: `drizzle-kit pull` is READ-ONLY on the database — it reads the catalog and
//     writes LOCAL FILES only. It executes NO DDL/DML, so pull itself CANNOT lose data.
//     (Data loss in this whole story comes ONLY from `generate`+apply or `push`, never `pull`.)
//   * The real cost of B is to the CODE, not the data: pull OVERWRITES this file (loses these
//     comments + the index intent) and may quietly restructure other mappings, so it needs a
//     careful diff + `tsc` + `next build` + a runtime query re-verify before trusting it.
//   * Verdict: deferred on purpose. We don't use the generate/migrate workflow, so B fixes a
//     problem we don't have while risking new code drift. Do B only if/when we adopt drizzle
//     generate for real — otherwise this warning is the fix.
// ------------------------------------------------------------------------------------

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
]);

export const logAi = pgTable("log_ai", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	userId: varchar("user_id", { length: 255 }).notNull(),
	aiType: varchar("ai_type", { length: 255 }).notNull(),
	createAt: varchar("create_at", { length: 255 }).notNull(),
	message: text().notNull(),
});

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

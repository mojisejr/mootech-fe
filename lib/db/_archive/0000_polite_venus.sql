-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_base" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"element" varchar(255) NOT NULL,
	"note" text NOT NULL,
	"power" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_be_careful" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"power" varchar(255) NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_character" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_character_for_share" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_color" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"element" varchar(255) NOT NULL,
	"level" varchar(255) NOT NULL,
	"sequence" bigint NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_elemental_characteristics_calculate" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"detail" varchar(255) NOT NULL,
	"weight" double precision NOT NULL,
	"gain_elements" json
);
--> statement-breakpoint
CREATE TABLE "analytic_elemental_characteristics_element_result" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"level" varchar(255) NOT NULL,
	"element" varchar(255) NOT NULL,
	"sequence" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_elemental_characteristics_result" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"level" varchar(255) NOT NULL,
	"remark" varchar(255) NOT NULL,
	"start_score" double precision NOT NULL,
	"end_score" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_feature" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"element" varchar(255) NOT NULL,
	"behavior" text NOT NULL,
	"occupations" text NOT NULL,
	"colors" text NOT NULL,
	"sacred_things" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_habit" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"level" varchar(255) NOT NULL,
	"note" text NOT NULL,
	"power" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_love" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_occupation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"sequence" bigint NOT NULL,
	"note" text NOT NULL,
	"topic" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_sacred_thing" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_element" varchar(255) NOT NULL,
	"element" varchar(255) NOT NULL,
	"level" varchar(255) NOT NULL,
	"sequence" bigint NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar100_year" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"start_year" bigint NOT NULL,
	"start_month" bigint NOT NULL,
	"start_date" bigint NOT NULL,
	"start_time" varchar(255) NOT NULL,
	"end_year" bigint NOT NULL,
	"end_month" bigint NOT NULL,
	"end_date" bigint NOT NULL,
	"end_time" varchar(255) NOT NULL,
	"big_start_year" bigint NOT NULL,
	"big_start_month" bigint NOT NULL,
	"big_start_date" bigint NOT NULL,
	"big_start_time" varchar(255) NOT NULL,
	"big_end_year" bigint NOT NULL,
	"big_end_month" bigint NOT NULL,
	"big_end_date" bigint NOT NULL,
	"big_end_time" varchar(255) NOT NULL,
	"small_start_year" bigint NOT NULL,
	"small_start_month" bigint NOT NULL,
	"small_start_date" bigint NOT NULL,
	"small_start_time" varchar(255) NOT NULL,
	"small_end_year" bigint NOT NULL,
	"small_end_month" bigint NOT NULL,
	"small_end_date" bigint NOT NULL,
	"small_end_time" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chinese_calendar_desc_above" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chinese_calendar_desc_below" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_above" (
	"id" bigint PRIMARY KEY NOT NULL,
	"chinese_symbol" varchar(255) NOT NULL,
	"pronunciation" varchar(255) NOT NULL,
	"power" varchar(255) NOT NULL,
	"element" varchar(255) NOT NULL,
	"direction" varchar(255) NOT NULL,
	"color" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_below" (
	"id" bigint PRIMARY KEY NOT NULL,
	"constellation" varchar(255) NOT NULL,
	"chinese_symbol" varchar(255) NOT NULL,
	"pronunciation" varchar(255) NOT NULL,
	"power" varchar(255) NOT NULL,
	"element" varchar(255) NOT NULL,
	"direction" varchar(255) NOT NULL,
	"color" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_hidden_zodiac" (
	"below_id" bigint PRIMARY KEY NOT NULL,
	"hidden_zodiac" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_month_chinese" (
	"month_chinese_id" bigint PRIMARY KEY NOT NULL,
	"start_day" bigint NOT NULL,
	"start_month" bigint NOT NULL,
	"end_day" bigint NOT NULL,
	"end_month" bigint NOT NULL,
	"start_date" varchar(255) NOT NULL,
	"end_date" varchar(255) NOT NULL,
	"chinese_horoscope_8_square_below_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "color" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"hex" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compatibility_love" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"year_above_id" bigint NOT NULL,
	"year_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compatibility_love_description" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compatibility_love_rating" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"start_score" double precision NOT NULL,
	"end_score" double precision NOT NULL,
	"rating" bigint NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compatibility_work" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"year_above_id" bigint NOT NULL,
	"year_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compatibility_work_description" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"note" text NOT NULL,
	"boss" text NOT NULL,
	"employee" text NOT NULL,
	"friend" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compatibility_work_rating" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"start_score" double precision NOT NULL,
	"end_score" double precision NOT NULL,
	"rating" bigint NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "direction" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "element_cycle" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"element" varchar(255) NOT NULL,
	"power" varchar(255) NOT NULL,
	"gender" varchar(255) NOT NULL,
	"element_friend" varchar(255) NOT NULL,
	"element_work" varchar(255) NOT NULL,
	"element_career" varchar(255) NOT NULL,
	"element_fortune" varchar(255) NOT NULL,
	"element_spouse" varchar(255) NOT NULL,
	"element_supporter" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"create_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fortune_stick" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mascot_id" bigint NOT NULL,
	"create_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fortune_telling" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"no" bigint NOT NULL,
	"image" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fortune_telling_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_no" bigint NOT NULL,
	"create_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heavenly_spirit_card" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"no" bigint NOT NULL,
	"message_from_heaven" text NOT NULL,
	"image" text NOT NULL,
	"sacred_things" text NOT NULL,
	"keyword_th" text NOT NULL,
	"keyword_en" text NOT NULL,
	"vision" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heavenly_spirit_card_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"card_no" bigint NOT NULL,
	"create_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_activity" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"createat" varchar(255) NOT NULL,
	"activity_id" bigint NOT NULL,
	"point" bigint NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_ai" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"ai_type" varchar(255) NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_matching" (
	"matching_id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"createat" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"dob" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"is_remember_time" boolean NOT NULL,
	"gender" varchar(255),
	"your_name" varchar(255) NOT NULL,
	"your_dob" varchar(255) NOT NULL,
	"your_time" varchar(255) NOT NULL,
	"your_is_remember_time" boolean NOT NULL,
	"your_gender" varchar(255),
	"result" text NOT NULL,
	"friend_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "log_member_pay_as_use" (
	"user_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"total" bigint NOT NULL,
	"id" varchar(36) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_save_image" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"createat" varchar(255) NOT NULL,
	"page" varchar(255) DEFAULT 'PROFILE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_survey" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"createat" varchar(255) NOT NULL,
	"code" varchar(255) NOT NULL,
	"result" text NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_calculate" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"createat" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"dob" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"gender" varchar(255),
	"is_remember_time" boolean NOT NULL,
	"place_name" varchar(255),
	"code" varchar(255) NOT NULL,
	"result" text NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_work_vibe" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"createat" varchar(255) NOT NULL,
	"type" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"dob" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"is_remember_time" boolean NOT NULL,
	"gender" varchar(255),
	"your_name" varchar(255) NOT NULL,
	"your_dob" varchar(255) NOT NULL,
	"your_time" varchar(255) NOT NULL,
	"your_is_remember_time" boolean NOT NULL,
	"your_gender" varchar(255),
	"result" text NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_love_mate" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"createat" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"dob" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"is_remember_time" boolean NOT NULL,
	"gender" varchar(255),
	"your_name" varchar(255) NOT NULL,
	"your_dob" varchar(255) NOT NULL,
	"your_time" varchar(255) NOT NULL,
	"your_is_remember_time" boolean NOT NULL,
	"your_gender" varchar(255),
	"result" text NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mascot" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"url" varchar(255) NOT NULL,
	"gender" varchar(255),
	"day_above_element" varchar(255) NOT NULL,
	"power" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mascot_v2" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_below_id" bigint NOT NULL,
	"power" varchar(255) NOT NULL,
	"element" varchar(255) NOT NULL,
	"url" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	"mascot_name" varchar(255) NOT NULL,
	"behaviour" text NOT NULL,
	"person" text NOT NULL,
	"work" text NOT NULL,
	"wealth" text NOT NULL,
	"health" text NOT NULL,
	"love" text NOT NULL,
	"family" text NOT NULL,
	"sacred_item" text NOT NULL,
	"url_share" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching" (
	"create_at" varchar(255) NOT NULL,
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"friend_id" text NOT NULL,
	"matching_type" varchar(255) NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"username" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" varchar(255) NOT NULL,
	"role" varchar(255) NOT NULL,
	"update_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_payment" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"plan_code" text NOT NULL,
	"package_code" text NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"start_at" varchar(255) NOT NULL,
	"expire_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_payment_code" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"owner_by" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_payment_code_log" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"member_payment_code_id" text NOT NULL,
	"user_id" text NOT NULL,
	"code" text NOT NULL,
	"create_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_payment_log" (
	"plan_code" text NOT NULL,
	"package_code" text NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"start_at" varchar(255) NOT NULL,
	"expire_at" varchar(255) NOT NULL,
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"payment_id" text NOT NULL,
	"code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_pay_as_use" (
	"total" bigint NOT NULL,
	"update_at" varchar(255) NOT NULL,
	"user_id" varchar(255) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"tel" varchar(255) NOT NULL,
	"message" varchar(255) NOT NULL,
	"ref_code" varchar(255) NOT NULL,
	"code" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"expire_at" varchar(255) NOT NULL,
	"verify_at" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"payment_plan" text NOT NULL,
	"payment_package" text NOT NULL,
	"payment_package_name" text NOT NULL,
	"payment_amount" double precision NOT NULL,
	"file" text NOT NULL,
	"date" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"amount" double precision NOT NULL,
	"status" varchar(255) DEFAULT 'WAIT' NOT NULL,
	"note" text,
	"submit_at" varchar(255) NOT NULL,
	"approve_at" varchar(255),
	"approve_by" varchar(255),
	"email" text NOT NULL,
	"order_id" text NOT NULL,
	"payment_by" varchar(255) DEFAULT 'TRANSFER' NOT NULL,
	"charge_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_package" (
	"plan_code" text NOT NULL,
	"package_code" text NOT NULL,
	"id" bigserial PRIMARY KEY NOT NULL,
	"description" text NOT NULL,
	"buffer_day" bigint DEFAULT '0' NOT NULL,
	"amount" double precision DEFAULT '0' NOT NULL,
	"expire" varchar(255) NOT NULL,
	"max_user" bigint DEFAULT '1' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_plan" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"plan_code" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_customer" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"year_above_id" bigint NOT NULL,
	"year_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_code" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"plan_code" text NOT NULL,
	"package_code" text NOT NULL,
	"description" text NOT NULL,
	"expire" varchar(255) NOT NULL,
	"max_use" bigint DEFAULT '1' NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"is_active" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member_with_friend" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text,
	"surname" text,
	"picture_url" text,
	"create_at" varchar(255) NOT NULL,
	"update_at" varchar(255) NOT NULL,
	"dob" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"is_remember_time" boolean NOT NULL,
	"gender" varchar(255),
	"place_name" text NOT NULL,
	"is_member" boolean NOT NULL,
	"member_id" text NOT NULL,
	"is_notify" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_customer_description" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_education" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"month_above_id" bigint NOT NULL,
	"month_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_education_description" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_finance" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"above_id" bigint NOT NULL,
	"below_id" bigint NOT NULL,
	"fortune_above_id" bigint NOT NULL,
	"fortune_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_finance_description" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_finance_extra" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_friendly" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_finance_fortune" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"is_above" boolean NOT NULL,
	"is_real" boolean NOT NULL,
	"chinese_symbol_id" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_knowledge" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"time_above_id" bigint NOT NULL,
	"time_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "power_knowledge_description" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_work" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_below_id" bigint NOT NULL,
	"month_above_id" bigint NOT NULL,
	"month_below_id" bigint NOT NULL,
	"score" double precision NOT NULL,
	"details" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prediction_work_description" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scared_thing" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"code" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"description" text NOT NULL,
	"image" text NOT NULL,
	"is_show" boolean NOT NULL,
	"element" text NOT NULL,
	"product_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"user_id" varchar(36) PRIMARY KEY NOT NULL,
	"name" text,
	"picture_url" text,
	"tel" varchar(255),
	"email" text,
	"create_at" varchar(255) NOT NULL,
	"update_at" varchar(255) NOT NULL,
	"surname" text,
	"refer_code" text,
	"login_at" varchar(255) NOT NULL,
	"dob" varchar(255) NOT NULL,
	"time" varchar(255) NOT NULL,
	"is_remember_time" boolean NOT NULL,
	"gender" varchar(255),
	"result_code" text NOT NULL,
	"place_name" text NOT NULL,
	"used_point" bigint DEFAULT '0' NOT NULL,
	"total_point" bigint DEFAULT '20' NOT NULL,
	"is_refresh" boolean NOT NULL,
	"share_img_profile_url" text NOT NULL,
	"account_name" text
);
--> statement-breakpoint
CREATE TABLE "user_friend_get_friend" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text,
	"refer_user_id" text,
	"create_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_matching" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"friend_id" text NOT NULL,
	"matching_type" varchar(255) NOT NULL,
	"create_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_provider" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider" text NOT NULL,
	"name" text,
	"picture_url" text,
	"email" text NOT NULL,
	"id_token" text NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"update_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "use_provider" (
	"user_id" varchar(255) PRIMARY KEY NOT NULL,
	"name" text,
	"picture_url" text,
	"email" text NOT NULL,
	"create_at" varchar(255) NOT NULL,
	"update_at" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytic_life" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"day_above_id" bigint NOT NULL,
	"day_above_below_id" bigint NOT NULL,
	"score" bigint NOT NULL,
	"is_above" boolean NOT NULL,
	"description" text NOT NULL,
	"child" text NOT NULL,
	"teen" text NOT NULL,
	"adult" text NOT NULL,
	"elder" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_ascendant" (
	"year_above_id" bigint NOT NULL,
	"ascendant_above_id" bigint NOT NULL,
	"ascendant_below_id" bigint NOT NULL,
	CONSTRAINT "idx_17701_primary" PRIMARY KEY("year_above_id","ascendant_above_id","ascendant_below_id")
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_counting_im" (
	"above_id" bigint NOT NULL,
	"below_id" bigint NOT NULL,
	"element" varchar(255) NOT NULL,
	CONSTRAINT "idx_17709_primary" PRIMARY KEY("above_id","below_id")
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_month_hong_hou_tung" (
	"month_chinese_id" bigint NOT NULL,
	"year_above_id" bigint NOT NULL,
	"month_below_id" bigint NOT NULL,
	"month_above_id" bigint NOT NULL,
	CONSTRAINT "idx_17720_primary" PRIMARY KEY("month_chinese_id","year_above_id")
);
--> statement-breakpoint
CREATE TABLE "holiday" (
	"day" bigint NOT NULL,
	"month" bigint NOT NULL,
	"year" bigint NOT NULL,
	"date" varchar(255) NOT NULL,
	"description" varchar(255) NOT NULL,
	CONSTRAINT "idx_17831_primary" PRIMARY KEY("day","month","year")
);
--> statement-breakpoint
CREATE TABLE "chinese_horoscope8_square_time_hong_hou_tung" (
	"time_chinese_id" bigint NOT NULL,
	"day_above_id" bigint NOT NULL,
	"start_time" varchar(255) NOT NULL,
	"end_time" varchar(255) NOT NULL,
	"time_above_id" bigint NOT NULL,
	"time_below_id" bigint NOT NULL,
	CONSTRAINT "idx_17723_primary" PRIMARY KEY("time_chinese_id","day_above_id")
);
--> statement-breakpoint
CREATE TABLE "chinese_calendar" (
	"day" bigint NOT NULL,
	"month" bigint NOT NULL,
	"year" bigint NOT NULL,
	"is_thai_buddhist_day" boolean NOT NULL,
	"is_chinese_buddhist_day" boolean NOT NULL,
	"chinese_time_codes" text NOT NULL,
	"chinese_time_ranges" text NOT NULL,
	"scared_thing" varchar(255) NOT NULL,
	"color_1" varchar(255) NOT NULL,
	"color_2" varchar(255) NOT NULL,
	"direction_good" varchar(255) NOT NULL,
	"direction_bad" varchar(255) NOT NULL,
	"is_doctor_day" boolean NOT NULL,
	"is_good_day" boolean NOT NULL,
	"is_thian_chai" boolean NOT NULL,
	"desc_1" varchar(255) NOT NULL,
	"desc_2" varchar(255) NOT NULL,
	"percentage" double precision NOT NULL,
	"above_1" bigint NOT NULL,
	"above_2" bigint NOT NULL,
	"above_3" bigint NOT NULL,
	"below_1" bigint NOT NULL,
	"below_2" bigint NOT NULL,
	"below_3" bigint NOT NULL,
	"time_change" varchar(255) NOT NULL,
	CONSTRAINT "idx_17672_primary" PRIMARY KEY("day","month","year","percentage","above_1","above_2","above_3","below_1","below_2","below_3")
);
--> statement-breakpoint
CREATE INDEX "idx_17837_idx_07f4db96621b76d710322d0330" ON "log_activity" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17867_idx_d9ad34068424b937e8091ee2ba" ON "log_matching" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17880_idx_0d3a2328bbbb156b0c292eac08" ON "log_save_image" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17888_idx_30fe18a08c1c49be225ac9ab75" ON "log_survey" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17888_idx_ae653a048f9293d99b70f68ba9" ON "log_survey" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17851_idx_385729c804d03bd4b22c151ac4" ON "log_calculate" USING btree ("code" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17851_idx_7f3196edaae4f8c9e45375471c" ON "log_calculate" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17895_idx_ae56335ed1cd4d4f2f28e09fac" ON "log_work_vibe" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_17859_idx_225062e6eabb0158e6e89e4b41" ON "log_love_mate" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_member_payment_user_id" ON "member_payment" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_payment_user_id" ON "payment" USING btree ("user_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_matching_user_id" ON "user_matching" USING btree ("user_id" text_ops);
*/
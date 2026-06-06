enum AI_CODE_RESPONSE {
  SUCCESS = 200,
  EXPIRED = 402,
  NO_PLAN = 403,
  OUT_OF_LIMIT = 404,
}

enum AI_CODE_RESPONSE_MESSAGE {
  SUCCESS = 'SUCCESS',
  EXPIRED = 'หมดอายุ',
  NO_PLAN = 'ยังไม่ได้สมัครสมาชิก',
  OUT_OF_LIMIT = 'เกิน Limit ต่อวัน กรุณาลองใหม่อีกครั้งในวันถัดไป หรือ สมัครสมาชิก',
}

export { AI_CODE_RESPONSE, AI_CODE_RESPONSE_MESSAGE };

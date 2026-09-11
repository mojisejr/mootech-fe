import { callApiWithStatus, type ApiResult } from '../../utils/fetch'

// ลบเพื่อน (status-aware) — DELETE /api/member-with-friend?user_id=..&id=..
// scope ที่ user_id + row id ฝั่ง server: ลบได้เฉพาะเพื่อนของตัวเอง. never throws (callApiWithStatus).
// โหลด endpoint แบบ dynamic เพื่อไม่ให้ next/config (getConfig) ถูกเรียกตอน import ทำให้รันใต้ node/vitest ไม่ได้.
export const MemberWithFriendDeleteApi = async (user_id: string, id: string): Promise<ApiResult> => {
  const { API } = await import('./endpoint')
  // method DELETE → buildAxiosRequest ต่อ body เป็น query string (getParamsQuery) ไม่ใช่ JSON body
  return callApiWithStatus(API.member_with_friend.delete, 'DELETE', '', { user_id, id }, null)
}

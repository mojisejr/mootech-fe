// DEV-ONLY visual harness — renders AccountScreen with mock wallet/missions so the QI-coin
// balance icon + daily missions (อ่านดวง/แชร์) are visible WITHOUT login/wallet state.
import { AccountScreen } from "@/features/v2-account/components/AccountScreen"

const MOCK = {
  wallet: { qi: 100845, history: [] },
  ent: {
    tier: "free",
    quota: { card: { limit: 1, used: 0 }, chat: { limit: 3, used: 0 } },
    credits: {},
  },
  board: {
    anonId: "dev",
    date: "2026-09-08",
    missions: [
      { id: "read_fortune", title: "อ่านดวงวันนี้", category: "daily", period: "daily", target: 1, progress: 0, rewardCoins: 5, completed: false, actionHref: "/v2/destiny" },
      { id: "share_fortune", title: "แชร์ดวงวันนี้", category: "daily", period: "daily", target: 1, progress: 0, rewardCoins: 10, completed: false, actionHref: "/v2/qi/referral" },
    ],
  },
} as never

export default function AccountPreviewPage() {
  return <AccountScreen preview={MOCK} />
}

// features/v2-shell/components/LogoutModal.tsx — the "ออกจากระบบหรือเปล่า?" confirm, shared by any v2 page
// whose avatar opens the logout menu (home, service hub). Extracted verbatim from home's local LogoutModal
// so home's modal pixels/behaviour are unchanged. The caller owns open/close state + the logout action
// (useV2Logout → onConfirm); this is presentational.
export function LogoutModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6" role="dialog" aria-modal="true" aria-label="ยืนยันออกจากระบบ">
      <button type="button" aria-label="ปิด" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xs rounded-3xl bg-white p-6 text-center shadow-xl">
        <p className="text-lg font-bold leading-7 text-v3-navy">ออกจากระบบหรือเปล่า?</p>
        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-full border border-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-sapphire">ยกเลิก</button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-full bg-v3-sapphire px-4 py-2.5 text-sm font-semibold text-v3-lime">ออกจากระบบ</button>
        </div>
      </div>
    </div>
  )
}

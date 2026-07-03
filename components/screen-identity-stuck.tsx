import { signOut } from "next-auth/react";

// Escape hatch shown when identity fails to resolve within the timeout on a
// deep-link / LINE entry (#mumate-my-destiny-mountgate-hang, Fix B″). Instead of
// leaving the user on an infinite <ScreenLoading/> spinner, give them an explicit
// way out: re-login. signOut -> /login, where the Google-external escort (Fix A)
// takes over if they are still inside the LINE in-app browser.
export default function ScreenIdentityStuck() {
  const handleRelogin = () => {
    signOut({ callbackUrl: "/login" });
  };

  return (
    <div className="w-full min-h-screen flex flex-col items-center justify-center gap-5 px-8 text-center font-ibm bg-white">
      <p className="text-lg font-semibold text-[#333]">
        เข้าสู่ระบบไม่สำเร็จ
      </p>
      <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
        เราเชื่อมต่อบัญชีของคุณไม่ได้ในตอนนี้
        <br />
        กรุณาเข้าสู่ระบบอีกครั้ง
      </p>
      <button
        onClick={handleRelogin}
        className="rounded-full bg-[#4B96E5] px-10 py-3 text-white font-semibold shadow-md active:scale-95 transition-transform"
      >
        เข้าสู่ระบบอีกครั้ง
      </button>
    </div>
  );
}

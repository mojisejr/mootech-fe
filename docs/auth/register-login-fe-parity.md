# FE-native register-login parity table

The parallel endpoint is `POST /api/auth/register-login-fe`. Nothing calls it in
production yet. The existing BE `POST /user/register-login` remains the live path
and the rollback path.

| Legacy branch | FE-native slice-1 behavior | Reason / later gate |
|---|---|---|
| Existing Google or LINE provider identity, one `user_id` | Return that member and refresh login/profile fields in one transaction | Preserved. Provider identity comes from the signed NextAuth session, never the request body. |
| Repeated provider rows that all point to the same `user_id` | Treat as the same member | Tolerated until slice 2 cleans duplicates and adds the unique index. |
| One provider identity points to several `user_id` values | `409`, no write | Never choose an account owner by row order. Manual recovery is owner-gated. |
| Provider row exists but its `user` row is gone | `409`, no write | The BE returns a null-shaped success. The new path refuses the orphan explicitly so it cannot create or bind a second account silently. |
| First Google or LINE login | Create one UUID `user`, one provider row, referral code, and the legacy signup activity in one transaction | Preserved without calling BE. A provider-scoped advisory lock prevents two FE requests creating two members before the unique index exists. |
| Matching email exists on another provider | Create a separate member; do not join by email | Intentional change. Email is optional profile/recovery data, not proof of account ownership. Explicit linking is slice 3. |
| Referral code supplied during registration | `422`, no write | Intentionally refused in slice 1. Referral/friend/QI ownership must be agreed before this route reproduces those writes. |
| Welcome/signup points | Insert the legacy `log_activity(activity_id=1, point=20)` row inside the same transaction | Preserved. Any newer QI/referral reward remains outside this identity slice. |
| LINE Messaging API `checkUserId` and S3 image copy | Trust the LINE identity already verified by NextAuth; store the verified profile image URL | Intentional replacement. OAuth verification belongs at NextAuth; Messaging API membership is not identity proof. Object-storage migration is not claimed here. |

The provider-independent MuMate identifier remains `user.user_id`. The provider
subject is only a credential attached through `user_provider`; the current
`id_token` column name is legacy terminology and contains the stable provider
account subject, not a short-lived OAuth token.

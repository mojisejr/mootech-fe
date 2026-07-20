// MuMate v2 — profile-form wiring hook. REUSES the existing profile-save endpoint
// (ChineseHoroscopeCalculate = the /chinese-horoscope backend write + chart compute) and the same
// userId source (MEMBER_ID cookie) as pages/register — it does NOT introduce a new save path. The
// time-building logic is copied verbatim from pages/register onSubmit so behaviour matches exactly.
// The page composes the fields (BirthDayInput + name/gender/time/checkbox) into Lamun's RegisterView.
import { useEffect, useMemo, useState } from 'react'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { ChineseHoroscopeCalculate } from '@/constants/api/api-chinese-horoscope'

export type Gender = 'MALE' | 'FEMALE'

export function useV2ProfileForm(onSaved: (code: string) => void) {
  const [cookies] = useCookies([CookieKey.MEMBER_ID, CookieKey.MEMBER_NAME, CookieKey.MEMBER_IMAGE])
  const userId: string = cookies[CookieKey.MEMBER_ID] ?? ''
  const displayImage: string = cookies[CookieKey.MEMBER_IMAGE] ?? ''

  // Prefill the account name from the OAuth profile (set by the self-heal / register-login).
  const [name, setName] = useState<string>(cookies[CookieKey.MEMBER_NAME] ?? '')
  const [surname, setSurname] = useState<string>('')
  const [gender, setGender] = useState<Gender>('MALE')
  const [birthDay, setBirthDay] = useState<string>('')
  const [timeHourBirth, setTimeHourBirth] = useState<string>('')
  const [timeMinuteBirth, setTimeMinuteBirth] = useState<string>('')
  const [isRememberTimeBirth, setIsRememberTimeBirth] = useState<boolean>(true)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // #4: the useState initializer for `name` runs during the 'loading' render, BEFORE the self-heal
  // writes MEMBER_NAME — so it captures an empty cookie. Sync it in once the cookie lands (only if
  // the user hasn't typed their own name yet). useCookies re-renders on MEMBER_NAME change.
  useEffect(() => {
    const cookieName = cookies[CookieKey.MEMBER_NAME]
    setName((prev) => (prev === '' && cookieName ? cookieName : prev))
  }, [cookies])

  // #3: when the birth time is provided, validate it's numeric and in-range, so buildTime() can
  // never POST '99:00' / 'NaN:NaN' to the profile-save. Empty is allowed (buildTime → '00').
  const isTimeValid = useMemo(() => {
    if (!isRememberTimeBirth) return true
    const hourOk = timeHourBirth === '' || (/^\d+$/.test(timeHourBirth) && Number(timeHourBirth) <= 23)
    const minOk = timeMinuteBirth === '' || (/^\d+$/.test(timeMinuteBirth) && Number(timeMinuteBirth) <= 59)
    return hourOk && minOk
  }, [isRememberTimeBirth, timeHourBirth, timeMinuteBirth])

  const canSubmit = useMemo(
    () => Boolean(userId && name.trim() && birthDay) && isTimeValid,
    [userId, name, birthDay, isTimeValid],
  )

  // Copied verbatim from pages/register onSubmit — zero-pad hour/min, blank when time unknown.
  const buildTime = (): string => {
    if (!isRememberTimeBirth) return ''
    let min = timeMinuteBirth
    let hr = timeHourBirth
    min = min === '' ? '00' : parseInt(timeMinuteBirth) < 10 ? `0${parseInt(timeMinuteBirth)}` : `${parseInt(timeMinuteBirth)}`
    hr = hr === '' ? '00' : parseInt(timeHourBirth) < 10 ? `0${parseInt(timeHourBirth)}` : `${parseInt(timeHourBirth)}`
    return `${hr}:${min}`
  }

  const onSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const time = buildTime()
      // Same param order as pages/register callApiCalculate → ChineseHoroscopeCalculate.
      const result: any = await ChineseHoroscopeCalculate(
        userId,
        name,
        birthDay,
        time,
        gender,
        displayImage,
        surname,
        name, // account_name (register uses accountName; prefilled == name here)
        '', // family_code — not collected in slice 1
      )
      if (result?.code) {
        onSaved(result.code)
      } else {
        setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
      }
    } catch {
      setError('บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    userId,
    fields: {
      name, setName,
      surname, setSurname,
      gender, setGender,
      birthDay, setBirthDay,
      timeHourBirth, setTimeHourBirth,
      timeMinuteBirth, setTimeMinuteBirth,
      isRememberTimeBirth, setIsRememberTimeBirth,
    },
    canSubmit,
    isTimeValid,
    submitting,
    error,
    onSubmit,
  }
}

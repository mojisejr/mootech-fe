// #451 — RTL auto-cleanup ไม่ยิงเมื่อ vitest globals:false ⇒ เรียกมือ
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
afterEach(() => cleanup())

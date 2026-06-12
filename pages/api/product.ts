// MIGRATED from NestJS GET /product  (Phase 3, #mootech-fullstack-supabase-fold)
// Pure reference read -> Supabase via Drizzle. Parity target: ProductService.getProduct.
// Returns array of { id, name, description, image, url } (matches NestJS getRawMany()).
import type { NextApiRequest, NextApiResponse } from 'next'
import { and, eq, ne, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { product } from '@/lib/db/schema'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const page = (req.query.page as string) ?? ''
    const element = (req.query.element as string) ?? ''
    const percentageLove = Number(req.query.percentage_love ?? 0)

    // base filter (same as NestJS: is_show = true AND product_type != '')
    const conds: any[] = [eq(product.isShow, true), ne(product.productType, '')]

    if (page === 'LOVE') {
      const loveType = percentageLove > 50 ? 'UPSKILL_LOVE' : 'LOVE'
      conds.push(or(eq(product.productType, loveType), eq(product.productType, 'HOLY')))
    } else if (page === 'WORK') {
      conds.push(
        or(
          eq(product.productType, 'WORK'),
          eq(product.productType, 'UPSKILL_WORK'),
          eq(product.productType, 'HOLY'),
        ),
      )
    } else if (page === 'PROFILE') {
      conds.push(
        or(
          and(eq(product.element, element), eq(product.productType, 'ELEMENT')),
          ne(product.productType, 'ELEMENT'),
        ),
      )
    }

    const rows = await db
      .select({
        id: product.id,
        name: product.name,
        description: product.description,
        image: product.image,
        url: product.url,
      })
      .from(product)
      .where(and(...conds))

    // NestJS returned MySQL int ids (number); bigserial comes back as bigint -> coerce
    const out = rows.map((r) => ({ ...r, id: Number(r.id) }))
    return res.status(200).json(out)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}

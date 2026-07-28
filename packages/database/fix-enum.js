const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Show current values
  const current = await p.$queryRawUnsafe(`SELECT id, "paymentMethod" FROM invoices WHERE "paymentMethod" IN ('CHEQUE','VIREMENT_BANCAIRE','MOBILE_MONEY')`)
  console.log('Current old values:', current)

  // Add new enum values first
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE_BOA'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VIREMENT_BOA'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE_NSIA'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VIREMENT_NSIA'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CHEQUE_ECOBANK'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'VIREMENT_ECOBANK'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'WAVE'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'ORANGE_MONEY'`)
  await p.$executeRawUnsafe(`ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'DJAMO'`)
  console.log('Added new enum values')

  // Update invoices
  await p.$executeRawUnsafe(`UPDATE invoices SET "paymentMethod" = 'VIREMENT_BOA' WHERE "paymentMethod" = 'VIREMENT_BANCAIRE'`)
  await p.$executeRawUnsafe(`UPDATE invoices SET "paymentMethod" = 'CHEQUE_BOA' WHERE "paymentMethod" = 'CHEQUE'`)
  await p.$executeRawUnsafe(`UPDATE invoices SET "paymentMethod" = 'ORANGE_MONEY' WHERE "paymentMethod" = 'MOBILE_MONEY'`)
  console.log('Updated invoices')

  // Verify
  const remaining = await p.$queryRawUnsafe(`SELECT id, "paymentMethod" FROM invoices WHERE "paymentMethod" IN ('CHEQUE','VIREMENT_BANCAIRE','MOBILE_MONEY')`)
  console.log('Remaining old values:', remaining)

  await p.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })

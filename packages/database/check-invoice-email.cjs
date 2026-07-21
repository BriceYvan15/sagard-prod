const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const inv = await p.invoice.findUnique({
    where: { id: '6d544a95-87f9-4ecd-9501-632201038d81' },
    include: { client: { include: { contacts: true } }, lead: true }
  })
  if (!inv) { console.log('Invoice not found'); return }
  console.log('Reference:', inv.reference)
  console.log('Status:', inv.status)
  console.log('Client:', inv.client?.name ?? inv.lead?.companyName)
  console.log('Client email:', inv.client?.email)
  console.log('Contacts:', JSON.stringify(inv.client?.contacts?.map(c => ({ email: c.email, isPrimary: c.isPrimary })), null, 2))
  console.log('Lead email:', inv.lead?.contactEmail)
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

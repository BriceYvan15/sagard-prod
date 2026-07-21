const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const inv = await p.invoice.findUnique({
    where: { id: '6d544a95-87f9-4ecd-9501-632201038d81' },
    include: { client: { select: { email: true, contacts: { select: { email: true, isPrimary: true } } } }, lead: { select: { contactEmail: true } } }
  })
  if (!inv) { console.log('Not found'); return }
  console.log('client.email:', inv.client?.email)
  console.log('contacts:', JSON.stringify(inv.client?.contacts, null, 2))
  console.log('lead.contactEmail:', inv.lead?.contactEmail)

  // Simulate the logic
  let destEmail = ''
  let clientName = ''
  if (inv.client) {
    const primaryContact = inv.client.contacts.find(c => c.isPrimary)
    destEmail = primaryContact?.email || inv.client.contacts[0]?.email || inv.client.email || ''
  } else if (inv.lead) {
    destEmail = inv.lead.contactEmail || ''
  }
  console.log('destEmail result:', JSON.stringify(destEmail))
  console.log('destEmail truthy?', !!destEmail)
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

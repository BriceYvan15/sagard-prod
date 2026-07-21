const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const ids = ['6d544a95-87f9-4ecd-9501-632201038d81', '7b36eef9-af89-49cf-b814-90a23f1207d3']
  for (const id of ids) {
    const inv = await p.invoice.findUnique({
      where: { id },
      include: { client: { select: { email: true, contacts: { select: { email: true, isPrimary: true } } } }, lead: { select: { contactEmail: true } } }
    })
    if (!inv) { console.log(id, '→ NOT FOUND'); continue }
    let destEmail = ''
    if (inv.client) {
      const primaryContact = inv.client.contacts.find(c => c.isPrimary)
      destEmail = primaryContact?.email || inv.client.contacts[0]?.email || inv.client.email || ''
    } else if (inv.lead) {
      destEmail = inv.lead.contactEmail || ''
    }
    console.log(id, '→ destEmail:', JSON.stringify(destEmail), '| client.email:', inv.client?.email, '| contacts:', JSON.stringify(inv.client?.contacts))
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Get first user to assign as agent
  const user = await p.user.findFirst({ select: { id: true, firstName: true, lastName: true } })
  if (!user) { console.log('No user found'); return }
  console.log('Using agent:', user.firstName, user.lastName, user.id)

  // Update all visitor logs that have no agentId
  const result = await p.visitorLog.updateMany({
    where: { agentId: null },
    data: { agentId: user.id },
  })
  console.log(`Updated ${result.count} visitor logs with agentId`)

  // Verify
  const visits = await p.visitorLog.findMany({
    select: { reference: true, agentId: true, agent: { select: { firstName: true, lastName: true } } },
    take: 5,
    orderBy: { checkIn: 'desc' },
  })
  console.log(JSON.stringify(visits, null, 2))
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

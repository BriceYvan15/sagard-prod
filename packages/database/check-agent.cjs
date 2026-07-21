const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const visits = await p.visitorLog.findMany({
    select: { reference: true, agentId: true, agent: { select: { firstName: true, lastName: true } } },
    take: 5,
    orderBy: { checkIn: 'desc' },
  })
  console.log(JSON.stringify(visits, null, 2))
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

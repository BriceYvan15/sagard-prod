const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const agents = await p.agent.findMany({
    include: {
      user: { select: { firstName: true, lastName: true } },
      deployments: { select: { id: true, isActive: true, site: { select: { name: true } } } },
    },
    take: 10,
  })
  for (const a of agents) {
    console.log(a.user.firstName, a.user.lastName, '| deployments:', JSON.stringify(a.deployments))
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

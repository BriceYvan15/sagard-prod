const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Simulate exactly what the API does
  const agents = await p.agent.findMany({
    include: {
      user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true, photoUrl: true, status: true } },
      deployments: { where: { isActive: true }, select: { id: true, site: { select: { id: true, name: true, district: true } } } },
      equipments: { where: { returnedAt: null }, select: { id: true, equipment: { select: { name: true, code: true } } } },
    },
    orderBy: { matricule: 'asc' },
  })
  
  for (const a of agents) {
    const siteName = a.deployments?.find(d => d.isActive)?.site?.name
    console.log(a.user.firstName, a.user.lastName, '| deployments count:', a.deployments?.length, '| siteName:', siteName ?? 'Non affecté')
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

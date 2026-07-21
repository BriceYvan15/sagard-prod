const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  // Get today's pointages with check-in GPS
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const pointages = await p.pointage.findMany({
    where: { date: today, status: { in: ['EN_COURS', 'PRESENT', 'RETARD'] } },
    include: {
      agent: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      deployment: { include: { site: { select: { name: true, latitude: true, longitude: true } } } },
    },
  })
  
  console.log('=== Pointages en cours aujourd\'hui ===')
  for (const pt of pointages) {
    console.log(`Agent: ${pt.agent.user.firstName} ${pt.agent.user.lastName}`)
    console.log(`  Status: ${pt.status}`)
    console.log(`  checkInLat: ${pt.checkInLat}, checkInLng: ${pt.checkInLng}`)
    console.log(`  Site: ${pt.deployment?.site?.name ?? '—'}`)
    console.log(`  Site lat/lng: ${pt.deployment?.site?.latitude}, ${pt.deployment?.site?.longitude}`)
    console.log('---')
  }
  
  // Also check all agents with active deployments
  const agents = await p.agent.findMany({
    include: {
      user: { select: { firstName: true, lastName: true } },
      deployments: { where: { isActive: true }, select: { site: { select: { name: true, latitude: true, longitude: true } } } },
    },
  })
  
  console.log('\n=== Agents avec déploiements actifs ===')
  for (const a of agents) {
    const site = a.deployments?.[0]?.site
    console.log(`Agent: ${a.user.firstName} ${a.user.lastName} | Site: ${site?.name ?? 'N/A'} | lat: ${site?.latitude}, lng: ${site?.longitude}`)
  }
}

main().then(() => p.$disconnect()).catch(e => { console.error(e); p.$disconnect() })

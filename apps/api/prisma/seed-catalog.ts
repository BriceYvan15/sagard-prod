import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SERVICES = [
  { code: 'SG-J', description: 'Agent sécurité jour' },
  { code: 'SG-N', description: 'Agent sécurité nuit' },
  { code: 'ARM-J', description: 'Agent armé jour' },
  { code: 'ARM-N', description: 'Agent armé nuit' },
  { code: 'CYNO-J', description: 'Cynophile jour' },
  { code: 'CYNO-N', description: 'Cynophile nuit' },
  { code: 'SSI', description: 'Sécurité incendie' },
  { code: 'EVT', description: 'Assistance événementielle' },
  { code: 'CCTV', description: 'Vidéosurveillance' },
  { code: 'ACS', description: "Contrôle d'accès" },
  { code: 'AIS', description: 'Anti-intrusion' },
  { code: 'PM', description: 'Portail motorisé' },
  { code: 'BBE', description: 'Barbelé électrifié' },
  { code: 'NET', description: 'Réseau informatique' },
  { code: 'SC360', description: 'SecureCare360°' },
]

async function main() {
  console.log('Seeding service catalog...')
  for (let i = 0; i < SERVICES.length; i++) {
    await prisma.serviceCatalog.upsert({
      where: { code: SERVICES[i].code },
      update: { description: SERVICES[i].description, sortOrder: i + 1 },
      create: { ...SERVICES[i], sortOrder: i + 1 },
    })
  }
  console.log(`✅ ${SERVICES.length} services inserted.`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

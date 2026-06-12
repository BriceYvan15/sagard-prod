import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('admin123', 12)

  const users = [
    { email: 'dg@sagard.ci', phone: '+2250700000001', role: 'DIRECTEUR_GENERAL', firstName: 'Directeur', lastName: 'SAGARD' },
    { email: 'rh@sagard.ci', phone: '+2250700000002', role: 'RH', firstName: 'Responsable', lastName: 'RH' },
    { email: 'ops@sagard.ci', phone: '+2250700000003', role: 'CHEF_OPERATIONS', firstName: 'Chef', lastName: 'OPERATIONS' },
    { email: 'commercial@sagard.ci', phone: '+2250700000004', role: 'COMMERCIAL', firstName: 'Agent', lastName: 'COMMERCIAL' },
    { email: 'comptable@sagard.ci', phone: '+2250700000005', role: 'COMPTABLE', firstName: 'Agent', lastName: 'COMPTABLE' },
  ]

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        phone: u.phone,
        passwordHash: hash,
        role: u.role as any,
        firstName: u.firstName,
        lastName: u.lastName,
        status: 'ACTIF',
      },
    })
  }

  console.log(`✅ ${users.length} utilisateurs créés (mot de passe: admin123)`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

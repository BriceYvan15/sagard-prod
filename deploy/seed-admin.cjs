const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding SAGARD database...');
  const hash = await bcrypt.hash('sagard2024!', 12);

  const users = [
    { email: 'dg@sagard.ci',         phone: '+22500000001', role: 'DIRECTEUR_GENERAL',    firstName: 'Directeur',  lastName: 'Général',    whatsapp: '+22500000001' },
    { email: 'commercial@sagard.ci', phone: '+22500000002', role: 'COMMERCIAL',           firstName: 'Kouamé',     lastName: 'Yves',       whatsapp: '+22500000002' },
    { email: 'comptable@sagard.ci',  phone: '+22500000003', role: 'COMPTABLE',            firstName: 'Adjoua',     lastName: 'Marie',      whatsapp: '+22500000003' },
    { email: 'rh@sagard.ci',         phone: '+22500000004', role: 'RH',                   firstName: 'Brou',       lastName: 'Pauline',    whatsapp: '+22500000004' },
    { email: 'ops@sagard.ci',        phone: '+22500000005', role: 'CHEF_OPERATIONS',      firstName: 'Koné',       lastName: 'Ibrahim',    whatsapp: '+22500000005' },
    { email: 'controleur@sagard.ci', phone: '+22500000006', role: 'CONTROLEUR',           firstName: 'Traoré',     lastName: 'Seydou',     whatsapp: '+22500000006' },
  ];

  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (!existing) {
      await prisma.user.create({ data: {
        email: u.email, phone: u.phone, role: u.role,
        firstName: u.firstName, lastName: u.lastName,
        whatsappPhone: u.whatsapp, passwordHash: hash, status: 'ACTIF'
      }});
      console.log('  Created:', u.email);
    } else {
      console.log('  Exists:', u.email);
    }
  }
  console.log('Done!');
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());

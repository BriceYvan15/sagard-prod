import { PrismaClient, Role } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding SAGARD database...')

  const hash = (p: string) => bcrypt.hash(p, 12)

  // ── Utilisateurs ──────────────────────────────────
  const users = [
    { email: 'dg@sagard.ci',          phone: '+22500000001', role: Role.DIRECTEUR_GENERAL,   firstName: 'Directeur',  lastName: 'Général',    whatsapp: '+22500000001' },
    { email: 'commercial@sagard.ci',  phone: '+22500000002', role: Role.COMMERCIAL,          firstName: 'Kouamé',     lastName: 'Yves',       whatsapp: '+22500000002' },
    { email: 'comptable@sagard.ci',   phone: '+22500000003', role: Role.COMPTABLE,           firstName: 'Adjoua',     lastName: 'Marie',      whatsapp: '+22500000003' },
    { email: 'rh@sagard.ci',          phone: '+22500000004', role: Role.RH,                  firstName: 'Brou',       lastName: 'Pauline',    whatsapp: '+22500000004' },
    { email: 'ops@sagard.ci',         phone: '+22500000005', role: Role.CHEF_OPERATIONS,     firstName: 'Koné',       lastName: 'Ibrahim',    whatsapp: '+22500000005' },
    { email: 'controleur@sagard.ci',  phone: '+22500000006', role: Role.CONTROLEUR,          firstName: 'Traoré',     lastName: 'Seydou',     whatsapp: '+22500000006' },
    { email: 'surface@sagard.ci',     phone: '+22500000007', role: Role.TECHNICIENNE_SURFACE,firstName: 'Coulibaly',  lastName: 'Fatoumata',  whatsapp: '+22500000007' },
    { email: 'accueil@sagard.ci',     phone: '+22500000008', role: Role.AGENT_ACCUEIL,       firstName: 'Diallo',     lastName: 'Aïssatou',   whatsapp: '+22500000008' },
    { email: 'agent1@sagard.ci',      phone: '+22500000009', role: Role.AGENT_TERRAIN,       firstName: 'Ouédraogo',  lastName: 'Moussa',     whatsapp: '+22500000009' },
    { email: 'agent2@sagard.ci',      phone: '+22500000010', role: Role.AGENT_TERRAIN,       firstName: 'Sanogo',     lastName: 'Drissa',     whatsapp: '+22500000010' },
    { email: 'client@sonatel.ci',     phone: '+22500000011', role: Role.CLIENT,              firstName: 'Gestion',    lastName: 'Sonatel CI', whatsapp: '+22500000011' },
  ]

  const createdUsers: Record<string, any> = {}
  for (const u of users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } })
    if (!existing) {
      const user = await prisma.user.create({
        data: {
          email: u.email, phone: u.phone, role: u.role,
          firstName: u.firstName, lastName: u.lastName,
          whatsappPhone: u.whatsapp,
          passwordHash: await hash('sagard2024!'),
          status: 'ACTIF',
        },
      })
      createdUsers[u.role] = user
      console.log(`  ✓ User ${u.email}`)
    } else {
      createdUsers[u.role] = existing
    }
  }

  // ── Agents ──────────────────────────────────
  const agentUsers = await prisma.user.findMany({ where: { role: 'AGENT_TERRAIN' } })
  for (let i = 0; i < agentUsers.length; i++) {
    const u = agentUsers[i]
    const existing = await prisma.agent.findUnique({ where: { userId: u.id } })
    if (!existing) {
      await prisma.agent.create({
        data: {
          userId: u.id,
          matricule: `AGT-${String(i + 1).padStart(4, '0')}`,
          position: 'Agent de sécurité',
          shift: i % 2 === 0 ? 'JOUR' : 'NUIT',
          status: 'EN_POSTE',
          hireDate: new Date('2023-01-15'),
          baseSalary: 80000,
        },
      })
    }
  }

  const controleurUser = await prisma.user.findUnique({ where: { email: 'controleur@sagard.ci' } })
  if (controleurUser) {
    const existing = await prisma.agent.findUnique({ where: { userId: controleurUser.id } })
    if (!existing) {
      await prisma.agent.create({
        data: {
          userId: controleurUser.id,
          matricule: 'CTR-0001',
          position: 'Contrôleur de zone',
          shift: 'MIXTE',
          status: 'EN_POSTE',
          hireDate: new Date('2022-06-01'),
          baseSalary: 120000,
        },
      })
    }
  }
  console.log('  ✓ Agents créés')

  // ── Clients ──────────────────────────────────
  const clientsData = [
    { name: 'SONATEL CÔTE D\'IVOIRE',  sector: 'Télécommunications',   city: 'Abidjan', district: 'Plateau',     address: 'Rue du Commerce, Plateau' },
    { name: 'BANK OF AFRICA CI',       sector: 'Banque & Finance',     city: 'Abidjan', district: 'Plateau',     address: 'Avenue Général De Gaulle' },
    { name: 'CANAL+ AFRIQUE',          sector: 'Médias',               city: 'Abidjan', district: 'Marcory',     address: 'Zone 4, Marcory' },
    { name: 'CFAO MOTORS CI',          sector: 'Automobile',           city: 'Abidjan', district: 'Treichville', address: 'Boulevard de Marseille' },
    { name: 'RÉSIDENCE LES ACACIAS',   sector: 'Immobilier',           city: 'Abidjan', district: 'Cocody',      address: 'II Plateaux, Cocody' },
  ]

  const createdClients: any[] = []
  for (const c of clientsData) {
    const existing = await prisma.client.findFirst({ where: { name: c.name } })
    if (!existing) {
      const client = await prisma.client.create({
        data: { ...c, status: 'ACTIF' },
      })
      createdClients.push(client)
    } else {
      createdClients.push(existing)
    }
  }
  console.log('  ✓ Clients créés')

  // ── Sites ──────────────────────────────────
  const sitesData = [
    { name: 'Tour SONATEL — Plateau',    clientIdx: 0, district: 'Plateau',     riskLevel: 'ELEVE'  as any },
    { name: 'Agence BOA — Zone 4',       clientIdx: 1, district: 'Marcory',     riskLevel: 'ELEVE'  as any },
    { name: 'Studios CANAL+',            clientIdx: 2, district: 'Marcory',     riskLevel: 'MOYEN'  as any },
    { name: 'Showroom CFAO Treichville', clientIdx: 3, district: 'Treichville', riskLevel: 'MOYEN'  as any },
    { name: 'Résidence Les Acacias',     clientIdx: 4, district: 'Cocody',      riskLevel: 'FAIBLE' as any },
  ]

  const createdSites: any[] = []
  for (const s of sitesData) {
    const existing = await prisma.site.findFirst({ where: { name: s.name } })
    if (!existing) {
      const site = await prisma.site.create({
        data: {
          name: s.name,
          clientId: createdClients[s.clientIdx].id,
          address: `${s.district}, Abidjan`,
          city: 'Abidjan',
          district: s.district,
          riskLevel: s.riskLevel,
          status: 'ACTIF',
        },
      })
      createdSites.push(site)
    } else {
      createdSites.push(existing)
    }
  }
  console.log('  ✓ Sites créés')

  // ── Contrats ──────────────────────────────────
  const contractsData = [
    { clientIdx: 0, siteIdx: 0, type: 'Gardiennage 24h/24', monthly: 450000, agents: 4 },
    { clientIdx: 1, siteIdx: 1, type: 'Gardiennage + Rondes', monthly: 380000, agents: 3 },
    { clientIdx: 2, siteIdx: 2, type: 'Surveillance diurne', monthly: 220000, agents: 2 },
    { clientIdx: 3, siteIdx: 3, type: 'Gardiennage nuit', monthly: 190000, agents: 2 },
    { clientIdx: 4, siteIdx: 4, type: 'Gardiennage résidentiel', monthly: 150000, agents: 1 },
  ]

  for (let i = 0; i < contractsData.length; i++) {
    const c = contractsData[i]
    const ref = `CTR-2024-${String(i + 1).padStart(3, '0')}`
    const existing = await prisma.clientContract.findUnique({ where: { reference: ref } })
    if (!existing) {
      await prisma.clientContract.create({
        data: {
          reference: ref,
          clientId: createdClients[c.clientIdx].id,
          type: c.type,
          startDate: new Date('2024-01-01'),
          endDate: new Date('2024-12-31'),
          monthlyAmount: c.monthly,
          nbAgentsRequired: c.agents,
          status: 'ACTIF',
        },
      })
    }
  }
  console.log('  ✓ Contrats créés')

  // ── Équipements ──────────────────────────────────
  const equipments = [
    { code: 'EQ-001', name: 'Matraque télescopique', category: 'Armement' },
    { code: 'EQ-002', name: 'Gilet pare-balles NIJ II', category: 'Protection' },
    { code: 'EQ-003', name: 'Radio Motorola XT460', category: 'Communication' },
    { code: 'EQ-004', name: 'Lampe torche tactique', category: 'Outillage' },
    { code: 'EQ-005', name: 'Menottes de sécurité', category: 'Armement' },
  ]

  for (const eq of equipments) {
    const existing = await prisma.equipment.findUnique({ where: { code: eq.code } })
    if (!existing) {
      await prisma.equipment.create({ data: { ...eq, status: 'DISPONIBLE' } })
    }
  }
  console.log('  ✓ Équipements créés')

  // ── Véhicules ──────────────────────────────────
  const vehicles = [
    { plateNumber: 'CI-0001-A', type: 'MOTO' as any, brand: 'Yamaha', model: 'YBR 125', year: 2022 },
    { plateNumber: 'CI-0002-A', type: 'MOTO' as any, brand: 'Honda',  model: 'XR 150',  year: 2023 },
    { plateNumber: 'CI-0003-B', type: 'VOITURE' as any, brand: 'Toyota', model: 'Hilux', year: 2021 },
  ]

  for (const v of vehicles) {
    const existing = await prisma.vehicle.findUnique({ where: { plateNumber: v.plateNumber } })
    if (!existing) {
      await prisma.vehicle.create({ data: { ...v, status: 'DISPONIBLE', mileage: 0 } })
    }
  }
  console.log('  ✓ Véhicules créés')

  console.log('\n🎉 Seed terminé avec succès!')
  console.log('\n📝 Identifiants de connexion:')
  console.log('   DG:           dg@sagard.ci          / sagard2024!')
  console.log('   Commercial:   commercial@sagard.ci  / sagard2024!')
  console.log('   Comptable:    comptable@sagard.ci   / sagard2024!')
  console.log('   RH:           rh@sagard.ci          / sagard2024!')
  console.log('   Opérations:   ops@sagard.ci         / sagard2024!')
  console.log('   Contrôleur:   controleur@sagard.ci  / sagard2024!')
  console.log('   Agent:        agent1@sagard.ci      / sagard2024!')
  console.log('   Client:       client@sonatel.ci     / sagard2024!')
}

main()
  .catch(e => { console.error('❌ Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())

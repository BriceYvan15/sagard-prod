import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding operations test data...')

  // 1. Créer des utilisateurs agents de test
  const usersData = [
    { email: 'kouame.yao@sagard.ci', firstName: 'Kouamé', lastName: 'Yao', phone: '+2250701000001' },
    { email: 'awa.traore@sagard.ci', firstName: 'Awa', lastName: 'Traoré', phone: '+2250701000002' },
    { email: 'jean.konan@sagard.ci', firstName: 'Jean', lastName: 'Konan', phone: '+2250701000003' },
    { email: 'fatou.diallo@sagard.ci', firstName: 'Fatou', lastName: 'Diallo', phone: '+2250701000004' },
    { email: 'serge.bamba@sagard.ci', firstName: 'Serge', lastName: 'Bamba', phone: '+2250701000005' },
    { email: 'marie.kone@sagard.ci', firstName: 'Marie', lastName: 'Koné', phone: '+2250701000006' },
  ]

  const users: any[] = []
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        phone: u.phone,
        passwordHash: '$2b$10$DUMMY_HASH_NOT_FOR_LOGIN',
        role: 'AGENT_TERRAIN',
        status: 'ACTIF',
      },
    })
    users.push(user)
  }
  console.log(`  ✓ ${users.length} utilisateurs agents créés/vérifiés`)

  // 2. Créer des agents
  const agents: any[] = []
  const matricules = ['SGD-001', 'SGD-002', 'SGD-003', 'SGD-004', 'SGD-005', 'SGD-006']
  for (let i = 0; i < users.length; i++) {
    const agent = await prisma.agent.upsert({
      where: { matricule: matricules[i] },
      update: {},
      create: {
        matricule: matricules[i],
        userId: users[i].id,
        status: 'DISPONIBLE',
        hireDate: new Date('2024-01-15'),
        position: i < 2 ? 'Agent sécurité jour' : i < 4 ? 'Agent sécurité nuit' : 'Cynophile',
      },
    })
    agents.push(agent)
  }
  console.log(`  ✓ ${agents.length} agents créés/vérifiés`)

  // 3. Créer des clients de test puis des sites
  const clientsData = [
    { code: 'CLI-NSIA', name: 'Banque NSIA', email: 'contact@nsia.ci', phone: '+2252000001', address: 'Rue du Commerce', city: 'Abidjan' },
    { code: 'CLI-SOLIBRA', name: 'SOLIBRA SA', email: 'contact@solibra.ci', phone: '+2252000002', address: 'Zone industrielle', city: 'Abidjan' },
    { code: 'CLI-AMBFR', name: 'Ambassade de France', email: 'security@ambafrance-ci.org', phone: '+2252000003', address: 'Cocody Ambassades', city: 'Abidjan' },
    { code: 'CLI-CFAO', name: 'CFAO Motors', email: 'admin@cfao.ci', phone: '+2252000004', address: 'Boulevard VGE', city: 'Abidjan' },
  ]

  const clients: any[] = []
  for (const c of clientsData) {
    const client = await prisma.client.upsert({
      where: { code: c.code },
      update: {},
      create: {
        code: c.code,
        name: c.name,
        email: c.email,
        phone: c.phone,
        address: c.address,
        city: c.city,
        status: 'ACTIF',
        segment: 'ENTREPRISE_PRIVEE' as any,
      },
    })
    clients.push(client)
  }
  console.log(`  ✓ ${clients.length} clients créés/vérifiés`)

  const sitesData = [
    { code: 'SITE-BNK01', name: 'Banque NSIA - Plateau', city: 'Abidjan', address: 'Rue du Commerce, Plateau', siteType: 'BANQUE' as const, clientIdx: 0 },
    { code: 'SITE-IND01', name: 'Usine SOLIBRA - Yopougon', city: 'Abidjan', address: 'Zone industrielle Yopougon', siteType: 'USINE' as const, clientIdx: 1 },
    { code: 'SITE-VIL01', name: 'Résidence Ambassadeur France', city: 'Abidjan', address: 'Cocody Ambassades', siteType: 'VILLA' as const, clientIdx: 2 },
    { code: 'SITE-BUR01', name: 'Tour CFAO - Marcory', city: 'Abidjan', address: 'Boulevard VGE, Marcory', siteType: 'BUREAU' as const, clientIdx: 3 },
  ]

  const sites: any[] = []
  for (const s of sitesData) {
    const site = await prisma.site.upsert({
      where: { code: s.code },
      update: {},
      create: {
        code: s.code,
        name: s.name,
        city: s.city,
        address: s.address,
        siteType: s.siteType,
        status: 'ACTIF',
        clientId: clients[s.clientIdx].id,
      },
    })
    sites.push(site)
  }
  console.log(`  ✓ ${sites.length} sites créés/vérifiés`)

  // 4. Créer des déploiements
  const deploymentsData = [
    { agentIdx: 0, siteIdx: 0, shift: 'JOUR', state: 'ACTIF', startDate: new Date('2025-05-01') },
    { agentIdx: 1, siteIdx: 0, shift: 'NUIT', state: 'ACTIF', startDate: new Date('2025-05-01') },
    { agentIdx: 2, siteIdx: 1, shift: 'NUIT', state: 'ACTIF', startDate: new Date('2025-04-15') },
    { agentIdx: 3, siteIdx: 2, shift: 'JOUR', state: 'ACTIF', startDate: new Date('2025-05-10') },
    { agentIdx: 4, siteIdx: 3, shift: 'JOUR', state: 'ACTIF', startDate: new Date('2025-06-01') },
    { agentIdx: 5, siteIdx: 1, shift: 'JOUR', state: 'BROUILLON', startDate: new Date('2025-06-15') },
  ]

  for (const d of deploymentsData) {
    const ref = `DEP-2025-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    await prisma.agentDeployment.create({
      data: {
        reference: ref,
        agentId: agents[d.agentIdx].id,
        siteId: sites[d.siteIdx].id,
        shift: d.shift as any,
        shiftKind: d.shift as any,
        role: 'AGENT',
        state: d.state as any,
        startDate: d.startDate,
        isActive: d.state === 'ACTIF',
      },
    })
  }
  console.log(`  ✓ ${deploymentsData.length} déploiements créés`)

  // 5. Créer des pointages (aujourd'hui)
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const pointagesData = [
    { agentIdx: 0, siteIdx: 0, shift: 'JOUR', checkInTime: new Date(`${todayStr}T06:00:00`), checkOutTime: null as Date | null },
    { agentIdx: 3, siteIdx: 2, shift: 'JOUR', checkInTime: new Date(`${todayStr}T06:30:00`), checkOutTime: null as Date | null },
    { agentIdx: 4, siteIdx: 3, shift: 'JOUR', checkInTime: new Date(`${todayStr}T07:00:00`), checkOutTime: new Date(`${todayStr}T12:00:00`) as Date | null },
    { agentIdx: 1, siteIdx: 0, shift: 'NUIT', checkInTime: new Date(`${todayStr}T18:00:00`), checkOutTime: null as Date | null },
    { agentIdx: 2, siteIdx: 1, shift: 'NUIT', checkInTime: new Date(`${todayStr}T18:30:00`), checkOutTime: null as Date | null },
  ]

  for (const p of pointagesData) {
    await prisma.pointage.create({
      data: {
        agentId: agents[p.agentIdx].id,
        siteId: sites[p.siteIdx].id,
        deploymentId: null,
        date: new Date(todayStr),
        shift: p.shift as any,
        status: p.checkOutTime ? 'TERMINE' : 'EN_COURS',
        checkInTime: p.checkInTime,
        checkOutTime: p.checkOutTime,
        pointingMethod: 'MANUEL',
      },
    })
  }
  console.log(`  ✓ ${pointagesData.length} pointages créés`)

  // 6. Créer des incidents
  const incidentsData = [
    {
      title: 'Tentative d\'intrusion zone parking',
      siteIdx: 0,
      type: 'INTRUSION' as const,
      severity: 'ELEVE' as const,
      state: 'OUVERT' as const,
      description: 'Un individu a tenté de franchir le grillage du parking à 02h30. L\'agent l\'a repéré via la caméra 3 et a donné l\'alerte.',
    },
    {
      title: 'Vol de câbles électriques',
      siteIdx: 1,
      type: 'VOL' as const,
      severity: 'MOYEN' as const,
      state: 'INVESTIGATION' as const,
      description: 'Constat le matin : 15m de câble cuivre dérobés sur la façade nord. Traces de passage par le toit.',
    },
    {
      title: 'Abandon de poste - Agent Bamba',
      siteIdx: 3,
      type: 'FAUTE_AGENT' as const,
      severity: 'MOYEN' as const,
      state: 'RESOLU' as const,
      description: 'L\'agent Bamba a quitté son poste pendant 45 min sans prévenir. Trouvé au restaurant voisin.',
      resolution: 'Avertissement écrit remis à l\'agent. Renforcement du contrôle par ronde.',
    },
    {
      title: 'Incendie local technique',
      siteIdx: 2,
      type: 'INCENDIE' as const,
      severity: 'CRITIQUE' as const,
      state: 'CLOS' as const,
      description: 'Départ de feu dans le local onduleur à 14h15. Extincteur utilisé par l\'agent Diallo.',
      resolution: 'Feu maîtrisé. Pompiers informés. Électricien intervenu pour sécuriser le circuit.',
    },
  ]

  for (const inc of incidentsData) {
    const ref = `INC-${now.getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    await prisma.incident.create({
      data: {
        reference: ref,
        title: inc.title,
        siteId: sites[inc.siteIdx].id,
        incidentType: inc.type,
        severity: inc.severity,
        state: inc.state,
        description: inc.description,
        resolution: (inc as any).resolution ?? null,
        incidentDatetime: new Date(Date.now() - Math.random() * 7 * 24 * 3600 * 1000),
      },
    })
  }
  console.log(`  ✓ ${incidentsData.length} incidents créés`)

  // 7. Créer des rapports journaliers
  const reportsData = [
    { siteIdx: 0, shift: 'JOUR', state: 'VALIDE', date: new Date(`${todayStr}`), summary: 'Journée calme. RAS sur le site. Rondes effectuées.', agentsExpected: 2, agentCount: 2, roundsDone: 4 },
    { siteIdx: 1, shift: 'NUIT', state: 'SOUMIS', date: new Date(`${todayStr}`), summary: 'Nuit agitée suite au vol de câbles. Ronde renforcée.', agentsExpected: 1, agentCount: 1, roundsDone: 6 },
    { siteIdx: 2, shift: 'JOUR', state: 'BROUILLON', date: new Date(`${todayStr}`), summary: 'En cours de rédaction.', agentsExpected: 1, agentCount: 1, roundsDone: 2 },
    { siteIdx: 3, shift: 'JOUR', state: 'VALIDE', date: new Date(Date.now() - 86400000), summary: 'Journée normale. 12 visiteurs enregistrés.', agentsExpected: 1, agentCount: 1, roundsDone: 3, visitorsCount: 12 },
  ]

  for (const r of reportsData) {
    const ref = `RPT-${now.getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
    await prisma.dailyReport.create({
      data: {
        reference: ref,
        siteId: sites[r.siteIdx].id,
        date: r.date,
        shift: r.shift as any,
        state: r.state as any,
        summary: r.summary,
        agentsExpected: r.agentsExpected,
        agentCount: r.agentCount,
        roundsDone: r.roundsDone,
        visitorsCount: (r as any).visitorsCount ?? 0,
      },
    })
  }
  console.log(`  ✓ ${reportsData.length} rapports journaliers créés`)

  console.log('\n✅ Données de test opérations insérées avec succès !')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())

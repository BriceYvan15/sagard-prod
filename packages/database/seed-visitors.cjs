const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Use the first site as default (SAGARD headquarters)
  const site = await prisma.site.findFirst({ select: { id: true, name: true } })
  if (!site) throw new Error('No site found')
  console.log('Using site:', site.name, site.id)

  const existing = await prisma.visitorLog.count()
  console.log('Existing visitors:', existing)

  const visitors = [
    { visitorName: 'Kouassi N\'Guessan Jean', visitorCompany: 'Société BTP Africa', visitorPhone: '07 08 45 12 33', idType: 'CNI', idNumber: 'CNI-2208914567', visitPurpose: 'REUNION', hostName: 'M. Konan Bertin', plateNumber: 'AB 4521 CD', badgeNo: 'B-001', checkInOffset: '2 hours', checkOut: null, isBlacklisted: false, notes: 'Réunion mensuelle de suivi chantier' },
    { visitorName: 'Aminata Traoré', visitorCompany: 'Pharmacie Sainte-Anne', visitorPhone: '05 56 78 90 12', idType: 'CNI', idNumber: 'CNI-1905678234', visitPurpose: 'CLIENT', hostName: 'Mme. Aya Kouassi', plateNumber: '', badgeNo: 'B-002', checkInOffset: '1 hour 30 minutes', checkOut: null, isBlacklisted: false, notes: null },
    { visitorName: 'Ibrahim Cissé', visitorCompany: 'DHL Express CI', visitorPhone: '01 23 45 67 89', idType: 'BADGE', idNumber: 'BADGE-DHL-445', visitPurpose: 'LIVRAISON', hostName: 'Réception', plateNumber: 'CE 8901 FG', badgeNo: 'B-003', checkInOffset: '45 minutes', checkOut: null, isBlacklisted: false, notes: 'Colis urgent pour la direction' },
    { visitorName: 'Fatou Diabaté', visitorCompany: null, visitorPhone: '07 77 88 99 00', idType: 'CNI', idNumber: 'CNI-2103456789', visitPurpose: 'CANDIDATURE', hostName: 'RH - M. Yao', plateNumber: '', badgeNo: 'B-004', checkInOffset: '20 minutes', checkOut: null, isBlacklisted: false, notes: 'Candidature poste agent de sécurité' },
    { visitorName: 'Marc-André Kouadio', visitorCompany: 'Orange CI', visitorPhone: '27 22 44 88 99', idType: 'PASSEPORT', idNumber: 'P-CI002345', visitPurpose: 'REUNION', hostName: 'M. Diallo', plateNumber: 'DF 3344 HI', badgeNo: 'B-005', checkInOffset: '10 minutes', checkOut: null, isBlacklisted: false, notes: 'Réunion partenariat commercial' },
    { visitorName: 'Sandra Aka', visitorCompany: 'MTN CI', visitorPhone: '05 01 23 45 67', idType: 'CNI', idNumber: 'CNI-1801234567', visitPurpose: 'REUNION', hostName: 'M. Konan Bertin', plateNumber: '', badgeNo: 'B-006', checkInOffset: '5 hours', checkOutOffset: '3 hours 30 minutes', isBlacklisted: false, notes: 'Réunion terminée - accord commercial validé' },
    { visitorName: 'Yao Konan Justin', visitorCompany: 'Entreprise KONE', visitorPhone: '07 44 55 66 77', idType: 'CNI', idNumber: 'CNI-1509876543', visitPurpose: 'MAINTENANCE', hostName: 'Technique', plateNumber: 'GH 7788 JK', badgeNo: 'B-007', checkInOffset: '4 hours', checkOutOffset: '2 hours', isBlacklisted: false, notes: 'Maintenance climatisation bureau 3ème étage' },
    { visitorName: 'Awa Bamba', visitorCompany: null, visitorPhone: '01 99 88 77 66', idType: 'CNI', idNumber: 'CNI-2304567890', visitPurpose: 'FAMILLE', hostName: 'M. Touré', plateNumber: '', badgeNo: 'B-008', checkInOffset: '3 hours', checkOutOffset: '2 hours 15 minutes', isBlacklisted: false, notes: null },
    { visitorName: 'Olivier Gnagne', visitorCompany: 'Coca-Cola CI', visitorPhone: '07 12 34 56 78', idType: 'PERMIS', idNumber: 'PERMIS-CI-998877', visitPurpose: 'LIVRAISON', hostName: 'Réception', plateNumber: 'DJ 5566 LM', badgeNo: 'B-009', checkInOffset: '6 hours', checkOutOffset: '5 hours 45 minutes', isBlacklisted: false, notes: 'Livraison boissons cafeteria' },
    { visitorName: 'Christelle N\'Guessan', visitorCompany: 'SGA Logistics', visitorPhone: '05 67 89 01 23', idType: 'CNI', idNumber: 'CNI-2009876543', visitPurpose: 'ENTRETIEN', hostName: 'RH - Mme. Brou', plateNumber: '', badgeNo: 'B-010', checkInOffset: '7 hours', checkOutOffset: '5 hours', isBlacklisted: false, notes: 'Entretien d\'embauche - poste commercial' },
    { visitorName: 'Moussa Bamba', visitorCompany: 'SOTRA', visitorPhone: '01 44 55 66 00', idType: 'CNI', idNumber: 'CNI-1701234567', visitPurpose: 'REUNION', hostName: 'M. Diallo', plateNumber: 'AB 1122 CD', badgeNo: 'B-011', checkInOffset: '1 day 3 hours', checkOutOffset: '1 day 1 hour', isBlacklisted: false, notes: 'Réunion transport personnel' },
    { visitorName: 'Estelle Kouadio', visitorCompany: 'PWC Audit', visitorPhone: '07 33 44 55 66', idType: 'PASSEPORT', idNumber: 'P-FR-123456', visitPurpose: 'REUNION', hostName: 'Direction Financière', plateNumber: 'CE 4455 FG', badgeNo: 'B-012', checkInOffset: '1 day 5 hours', checkOutOffset: '1 day 2 hours', isBlacklisted: false, notes: 'Audit annuel - clôture exercice' },
    { visitorName: 'Karim Ouattara', visitorCompany: null, visitorPhone: '05 78 90 12 34', idType: 'CNI', idNumber: 'CNI-2401234567', visitPurpose: 'CANDIDATURE', hostName: 'RH - M. Yao', plateNumber: '', badgeNo: 'B-013', checkInOffset: '1 day 6 hours', checkOutOffset: '1 day 5 hours', isBlacklisted: false, notes: 'Dépôt CV spontané' },
    { visitorName: 'Patricia Yapo', visitorCompany: 'Cabinet Yapo & Associés', visitorPhone: '01 77 66 55 44', idType: 'CNI', idNumber: 'CNI-1609876543', visitPurpose: 'CLIENT', hostName: 'Mme. Aya Kouassi', plateNumber: 'GH 9900 JK', badgeNo: 'B-014', checkInOffset: '2 days 4 hours', checkOutOffset: '2 days 2 hours', isBlacklisted: false, notes: 'Consultation juridique' },
    { visitorName: 'Drissa Coulibaly', visitorCompany: 'Sahel Energies', visitorPhone: '07 56 78 90 12', idType: 'CNI', idNumber: 'CNI-1405678901', visitPurpose: 'REUNION', hostName: 'M. Konan Bertin', plateNumber: 'DJ 7788 LM', badgeNo: 'B-015', checkInOffset: '2 days 6 hours', checkOutOffset: '2 days 4 hours', isBlacklisted: true, notes: 'Visiteur signalé sur liste noire - accès limité' },
  ]

  let refNum = existing + 1
  let inserted = 0

  for (const v of visitors) {
    const checkIn = new Date(Date.now() - parseOffset(v.checkInOffset))
    const checkOut = v.checkOutOffset ? new Date(Date.now() - parseOffset(v.checkOutOffset)) : null
    const reference = `VIS-${String(refNum).padStart(5, '0')}`

    await prisma.visitorLog.create({
      data: {
        reference,
        siteId: site.id,
        visitorName: v.visitorName,
        visitorCompany: v.visitorCompany,
        visitorPhone: v.visitorPhone,
        idType: v.idType,
        idNumber: v.idNumber,
        visitPurpose: v.visitPurpose,
        hostName: v.hostName,
        plateNumber: v.plateNumber || null,
        badgeNo: v.badgeNo,
        checkIn,
        checkOut,
        durationMin: checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / 60000 * 10) / 10 : null,
        badgeReturned: checkOut ? true : false,
        isBlacklisted: v.isBlacklisted,
        notes: v.notes,
      },
    })
    refNum++
    inserted++
  }

  console.log(`Inserted ${inserted} fictitious visitors`)
  const total = await prisma.visitorLog.count()
  console.log('Total visitors now:', total)
}

function parseOffset(str) {
  const parts = str.split(' ')
  let ms = 0
  for (let i = 0; i < parts.length; i += 2) {
    const num = parseInt(parts[i])
    const unit = parts[i + 1]
    if (unit === 'minutes' || unit === 'minute') ms += num * 60 * 1000
    else if (unit === 'hours' || unit === 'hour') ms += num * 60 * 60 * 1000
    else if (unit === 'days' || unit === 'day') ms += num * 24 * 60 * 60 * 1000
  }
  return ms
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })

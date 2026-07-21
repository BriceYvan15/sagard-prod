const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Check existing tables
  const tables = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema='public' ORDER BY table_name
  `
  console.log('Tables:', tables.map(t => t.table_name).join(', '))

  // Check if visitor_logs table exists
  const hasVisitorLogs = tables.some(t => t.table_name === 'visitor_logs')
  console.log('Has visitor_logs:', hasVisitorLogs)

  // Check sites
  const sites = await prisma.site.findMany({ take: 5, select: { id: true, name: true } })
  console.log('Sites:', JSON.stringify(sites))

  // Check existing visitor count
  if (hasVisitorLogs) {
    const count = await prisma.visitorLog.count()
    console.log('Existing visitors:', count)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(e => { console.error(e); prisma.$disconnect(); process.exit(1) })

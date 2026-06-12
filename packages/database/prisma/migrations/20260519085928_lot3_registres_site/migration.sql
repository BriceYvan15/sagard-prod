-- CreateEnum
CREATE TYPE "VisitPurpose" AS ENUM ('REUNION', 'LIVRAISON', 'MAINTENANCE', 'CLIENT', 'FAMILLE', 'AUTRE');

-- CreateEnum
CREATE TYPE "IdDocType" AS ENUM ('CNI', 'PASSEPORT', 'PERMIS', 'BADGE', 'AUTRE');

-- CreateEnum
CREATE TYPE "KeyType" AS ENUM ('PRINCIPALE', 'MASTER', 'ARMOIRE', 'VEHICULE', 'PORTE', 'PORTAIL', 'AUTRE');

-- CreateEnum
CREATE TYPE "KeyState" AS ENUM ('DISPONIBLE', 'SORTIE', 'PERDUE');

-- CreateEnum
CREATE TYPE "KeyMovementType" AS ENUM ('SORTIE', 'RETOUR', 'PERTE');

-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('TENUE', 'ARME_FEU', 'ARME_NON_LETALE', 'RADIO', 'DETECTEUR', 'LAMPE', 'PROTECTION', 'TELEPHONE', 'CANIN', 'CLE', 'ACCESSOIRE_VEHICULE', 'AUTRE');

-- CreateEnum
CREATE TYPE "EquipmentState" AS ENUM ('EN_STOCK', 'ATTRIBUE', 'EN_MAINTENANCE', 'PERDU', 'ENDOMMAGE', 'REFORME');

-- CreateEnum
CREATE TYPE "EquipmentMovementType" AS ENUM ('ATTRIBUTION', 'RETOUR', 'TRANSFERT', 'MAINTENANCE', 'PERTE');

-- CreateEnum
CREATE TYPE "EquipmentCondition" AS ENUM ('NEUF', 'BON', 'USE', 'ENDOMMAGE');

-- CreateEnum
CREATE TYPE "BlacklistReason" AS ENUM ('VOL', 'AGRESSION', 'INTRUSION', 'DECISION_JUSTICE', 'DEMANDE_CLIENT', 'AUTRE');

-- CreateTable
CREATE TABLE "visitor_logs" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorCompany" TEXT,
    "visitorPhone" TEXT,
    "idType" "IdDocType" NOT NULL DEFAULT 'CNI',
    "idNumber" TEXT,
    "visitPurpose" "VisitPurpose" NOT NULL DEFAULT 'REUNION',
    "hostName" TEXT,
    "plateNumber" TEXT,
    "checkIn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOut" TIMESTAMP(3),
    "durationMin" DOUBLE PRECISION,
    "badgeNo" TEXT,
    "badgeReturned" BOOLEAN NOT NULL DEFAULT false,
    "agentId" TEXT,
    "photoUrl" TEXT,
    "notes" TEXT,
    "isBlacklisted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitor_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklists" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "idNumber" TEXT,
    "reason" "BlacklistReason" NOT NULL,
    "description" TEXT,
    "photoUrl" TEXT,
    "incidentId" TEXT,
    "dateStart" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateEnd" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blacklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blacklist_sites" (
    "id" TEXT NOT NULL,
    "blacklistId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,

    CONSTRAINT "blacklist_sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "keys" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "keyType" "KeyType" NOT NULL DEFAULT 'PORTE',
    "state" "KeyState" NOT NULL DEFAULT 'DISPONIBLE',
    "currentHolderId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_movements" (
    "id" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "movementType" "KeyMovementType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT,
    "visitorLogId" TEXT,
    "issuedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "key_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_equipments" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "barcode" TEXT,
    "name" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL DEFAULT 'TENUE',
    "state" "EquipmentState" NOT NULL DEFAULT 'EN_STOCK',
    "siteId" TEXT,
    "employeeId" TEXT,
    "purchaseDate" DATE,
    "purchaseValue" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'XOF',
    "supplierId" TEXT,
    "warrantyEnd" DATE,
    "lastCheckDate" DATE,
    "nextCheckDate" DATE,
    "weaponCaliber" TEXT,
    "weaponAuthorization" TEXT,
    "weaponAuthorizationExp" DATE,
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_equipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_movements" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "movementType" "EquipmentMovementType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "employeeId" TEXT,
    "siteId" TEXT,
    "condition" "EquipmentCondition" NOT NULL DEFAULT 'BON',
    "userId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "visitor_logs_reference_key" ON "visitor_logs"("reference");

-- CreateIndex
CREATE INDEX "visitor_logs_siteId_checkIn_idx" ON "visitor_logs"("siteId", "checkIn");

-- CreateIndex
CREATE INDEX "visitor_logs_idNumber_idx" ON "visitor_logs"("idNumber");

-- CreateIndex
CREATE INDEX "blacklists_idNumber_idx" ON "blacklists"("idNumber");

-- CreateIndex
CREATE UNIQUE INDEX "blacklist_sites_blacklistId_siteId_key" ON "blacklist_sites"("blacklistId", "siteId");

-- CreateIndex
CREATE INDEX "keys_siteId_state_idx" ON "keys"("siteId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "keys_code_siteId_key" ON "keys"("code", "siteId");

-- CreateIndex
CREATE INDEX "key_movements_keyId_date_idx" ON "key_movements"("keyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "site_equipments_code_key" ON "site_equipments"("code");

-- CreateIndex
CREATE INDEX "site_equipments_siteId_state_idx" ON "site_equipments"("siteId", "state");

-- CreateIndex
CREATE INDEX "site_equipments_category_state_idx" ON "site_equipments"("category", "state");

-- CreateIndex
CREATE INDEX "equipment_movements_equipmentId_date_idx" ON "equipment_movements"("equipmentId", "date");

-- AddForeignKey
ALTER TABLE "visitor_logs" ADD CONSTRAINT "visitor_logs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_sites" ADD CONSTRAINT "blacklist_sites_blacklistId_fkey" FOREIGN KEY ("blacklistId") REFERENCES "blacklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blacklist_sites" ADD CONSTRAINT "blacklist_sites_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "keys" ADD CONSTRAINT "keys_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_movements" ADD CONSTRAINT "key_movements_keyId_fkey" FOREIGN KEY ("keyId") REFERENCES "keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_movements" ADD CONSTRAINT "key_movements_visitorLogId_fkey" FOREIGN KEY ("visitorLogId") REFERENCES "visitor_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "site_equipments" ADD CONSTRAINT "site_equipments_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_movements" ADD CONSTRAINT "equipment_movements_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "site_equipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

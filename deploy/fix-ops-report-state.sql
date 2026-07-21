ALTER TABLE incidents ALTER COLUMN "opsReportState" DROP DEFAULT;
ALTER TABLE incidents ALTER COLUMN "opsReportState" TYPE "OpsReportState" USING "opsReportState"::"OpsReportState";
ALTER TABLE incidents ALTER COLUMN "opsReportState" SET DEFAULT 'PENDING'::"OpsReportState";

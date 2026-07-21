-- Insert fictitious visitor data for SAGARD headquarters
-- First, get or create a default site
DO $$
DECLARE
    site_id TEXT;
    visitor_count INTEGER;
    ref_num INTEGER;
BEGIN
    -- Get the first site, or create one if none exists
    SELECT id INTO site_id FROM "Site" LIMIT 1;
    IF site_id IS NULL THEN
        site_id := gen_random_uuid()::text;
        INSERT INTO "Site" (id, name, code, address, city, country, phone, status, createdAt, updatedAt)
        VALUES (site_id, 'SAGARD Siège', 'SIEGE', 'Cocody Riviera', 'Abidjan', 'Côte d''Ivoire', '+225 27 22 00 00', 'ACTIF', NOW(), NOW());
    END IF;

    -- Get current count for reference numbering
    SELECT COUNT(*) INTO visitor_count FROM "visitor_logs";

    -- Insert 15 fictitious visitors with varied data
    -- Some present (no checkOut), some already checked out, some today, some previous days

    -- Today's visitors - still present
    INSERT INTO "visitor_logs" (id, reference, "siteId", "visitorName", "visitorCompany", "visitorPhone", "idType", "idNumber", "visitPurpose", "hostName", "plateNumber", "badgeNo", "checkIn", "checkOut", "isBlacklisted", "notes", "createdAt", "updatedAt")
    VALUES
    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 1)::text, 5, '0')), site_id, 'Kouassi N''Guessan Jean', 'Société BTP Africa', '07 08 45 12 33', 'CNI', 'CNI-2208914567', 'REUNION', 'M. Konan Bertin', 'AB 4521 CD', 'B-001', NOW() - INTERVAL '2 hours', NULL, false, 'Réunion mensuelle de suivi chantier', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 2)::text, 5, '0')), site_id, 'Aminata Traoré', 'Pharmacie Sainte-Anne', '05 56 78 90 12', 'CNI', 'CNI-1905678234', 'CLIENT', 'Mme. Aya Kouassi', '', 'B-002', NOW() - INTERVAL '1 hour 30 minutes', NULL, false, NULL, NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 3)::text, 5, '0')), site_id, 'Ibrahim Cissé', 'DHL Express CI', '01 23 45 67 89', 'BADGE', 'BADGE-DHL-445', 'LIVRAISON', 'Réception', 'CE 8901 FG', 'B-003', NOW() - INTERVAL '45 minutes', NULL, false, 'Colis urgent pour la direction', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 4)::text, 5, '0')), site_id, 'Fatou Diabaté', '', '07 77 88 99 00', 'CNI', 'CNI-2103456789', 'CANDIDATURE', 'RH - M. Yao', '', 'B-004', NOW() - INTERVAL '20 minutes', NULL, false, 'Candidature poste agent de sécurité', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 5)::text, 5, '0')), site_id, 'Marc-André Kouadio', 'Orange CI', '27 22 44 88 99', 'PASSEPORT', 'P-CI002345', 'REUNION', 'M. Diallo', 'DF 3344 HI', 'B-005', NOW() - INTERVAL '10 minutes', NULL, false, 'Réunion partenariat commercial', NOW(), NOW()),

    -- Today's visitors - already checked out
    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 6)::text, 5, '0')), site_id, 'Sandra Aka', 'MTN CI', '05 01 23 45 67', 'CNI', 'CNI-1801234567', 'REUNION', 'M. Konan Bertin', '', 'B-006', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '3 hours 30 minutes', false, 'Réunion terminée - accord commercial validé', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 7)::text, 5, '0')), site_id, 'Yao Konan Justin', 'Entreprise KONE', '07 44 55 66 77', 'CNI', 'CNI-1509876543', 'MAINTENANCE', 'Technique', 'GH 7788 JK', 'B-007', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours', false, 'Maintenance climatisation bureau 3ème étage', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 8)::text, 5, '0')), site_id, 'Awa Bamba', '', '01 99 88 77 66', 'CNI', 'CNI-2304567890', 'FAMILLE', 'M. Touré', '', 'B-008', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours 15 minutes', false, NULL, NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 9)::text, 5, '0')), site_id, 'Olivier Gnagne', 'Coca-Cola CI', '07 12 34 56 78', 'PERMIS', 'PERMIS-CI-998877', 'LIVRAISON', 'Réception', 'DJ 5566 LM', 'B-009', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '5 hours 45 minutes', false, 'Livraison boissons cafeteria', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 10)::text, 5, '0')), site_id, 'Christelle N''Guessan', 'SGA Logistics', '05 67 89 01 23', 'CNI', 'CNI-2009876543', 'ENTRETIEN', 'RH - Mme. Brou', '', 'B-010', NOW() - INTERVAL '7 hours', NOW() - INTERVAL '5 hours', false, 'Entretien d''embauche - poste commercial', NOW(), NOW()),

    -- Yesterday's visitors
    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 11)::text, 5, '0')), site_id, 'Moussa Bamba', 'SOTRA', '01 44 55 66 00', 'CNI', 'CNI-1701234567', 'REUNION', 'M. Diallo', 'AB 1122 CD', 'B-011', NOW() - INTERVAL '1 day 3 hours', NOW() - INTERVAL '1 day 1 hour', false, 'Réunion transport personnel', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 12)::text, 5, '0')), site_id, 'Estelle Kouadio', 'PWC Audit', '07 33 44 55 66', 'PASSEPORT', 'P-FR-123456', 'REUNION', 'Direction Financière', 'CE 4455 FG', 'B-012', NOW() - INTERVAL '1 day 5 hours', NOW() - INTERVAL '1 day 2 hours', false, 'Audit annuel - clôture exercice', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 13)::text, 5, '0')), site_id, 'Karim Ouattara', '', '05 78 90 12 34', 'CNI', 'CNI-2401234567', 'CANDIDATURE', 'RH - M. Yao', '', 'B-013', NOW() - INTERVAL '1 day 6 hours', NOW() - INTERVAL '1 day 5 hours', false, 'Dépôt CV spontané', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 14)::text, 5, '0')), site_id, 'Patricia Yapo', 'Cabinet Yapo & Associés', '01 77 66 55 44', 'CNI', 'CNI-1609876543', 'CLIENT', 'Mme. Aya Kouassi', 'GH 9900 JK', 'B-014', NOW() - INTERVAL '2 days 4 hours', NOW() - INTERVAL '2 days 2 hours', false, 'Consultation juridique', NOW(), NOW()),

    (gen_random_uuid()::text, CONCAT('VIS-', LPAD((visitor_count + 15)::text, 5, '0')), site_id, 'Drissa Coulibaly', 'Sahel Energies', '07 56 78 90 12', 'CNI', 'CNI-1405678901', 'REUNION', 'M. Konan Bertin', 'DJ 7788 LM', 'B-015', NOW() - INTERVAL '2 days 6 hours', NOW() - INTERVAL '2 days 4 hours', true, 'Visiteur signalé sur liste noire - accès limité', NOW(), NOW());

    RAISE NOTICE 'Inserted 15 fictitious visitors for site: %', site_id;
END $$;

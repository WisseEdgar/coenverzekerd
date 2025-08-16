-- Update existing documents with correct insurance type categorization
UPDATE documents SET 
  insurance_type_id = (SELECT id FROM insurance_types WHERE name = 'Glasverzekering')
WHERE filename = 'bgl19glasverzekering.pdf';

UPDATE documents SET 
  insurance_type_id = (SELECT id FROM insurance_types WHERE name = 'Verzuimverzekering')
WHERE filename = 'verzuimverzekering-voorwaarden-loondoorbetaling-module-tijd-INC-VC-11-251.pdf';

UPDATE documents SET 
  insurance_type_id = (SELECT id FROM insurance_types WHERE name = 'Werkmaterieel verhuurverzekering')
WHERE filename = 'wvp22-werkmaterieel-verhuurverzekering.pdf';

UPDATE documents SET 
  insurance_type_id = (SELECT id FROM insurance_types WHERE name = 'Bedrijfswagenverzekering')
WHERE filename = 'WBW25B-bedrijfswagenverzekering.pdf';

UPDATE documents SET 
  insurance_type_id = (SELECT id FROM insurance_types WHERE name = 'Autoverzekering')
WHERE filename = 'wap22-motorrijtuigenverzekering.pdf';

UPDATE documents SET 
  insurance_type_id = (SELECT id FROM insurance_types WHERE name = 'AOV (Arbeidsongeschiktheidsverzekering)')
WHERE filename IN (
  'VoorwaardenBestuurdersAOVnummer30127345.pdf', 
  'Voorwaarden-collectieve-aov-cao-pv-00-241.pdf', 
  'Voorwaarden Collectieve AOV.pdf'
);
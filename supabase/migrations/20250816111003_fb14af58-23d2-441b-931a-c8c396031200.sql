-- Merge duplicate insurance types, keeping the most descriptive/complete names

-- 1. Merge AOV variants - keep 'AOV (Arbeidsongeschiktheidsverzekering)'
UPDATE documents SET insurance_type_id = '8ca40d44-208c-4106-8571-1817b6f12f9e' 
WHERE insurance_type_id = '35c5f0c8-6881-40c5-9b6f-4d7bfb6ecb0d';

-- 2. Merge Autoverzekering variants - keep 'Autoverzekering' (capitalized)
UPDATE documents SET insurance_type_id = '2b317e4a-7eec-41cd-b411-b0fa808da28c' 
WHERE insurance_type_id = 'ce3160e1-9012-4fd2-9c4b-6972710f52d9';

-- 3. Merge Bedrijfsaansprakelijkheidsverzekering variants - keep capitalized version
UPDATE documents SET insurance_type_id = '17a7c218-8c00-4376-960f-0c153757fb14' 
WHERE insurance_type_id = '6af72b8a-38b7-40c3-9b0f-07d74d1fc7d9';

-- 4. Merge Bestuurdersaansprakelijkheid variants - keep capitalized 'Bestuurdersaansprakelijkheid'
UPDATE documents SET insurance_type_id = '1eb137aa-3427-4044-b566-a86604106cf9' 
WHERE insurance_type_id IN ('830133a3-9197-44cd-880e-7d8dc948cd77', '991ce59e-48d1-4550-92ec-ec8db610bee4');

-- 5. Merge Gebouwenverzekering variants - keep capitalized version
UPDATE documents SET insurance_type_id = 'cc9ab2b0-15c9-4a41-8309-de954fe713f3' 
WHERE insurance_type_id = '4d3f0228-9f55-426c-9720-2f92ec0f31f0';

-- 6. Merge Huurdersbelangverzekering variants - keep simple 'Huurdersbelangverzekering'
UPDATE documents SET insurance_type_id = '064db327-269b-40fc-a5f0-51cafce1bf68' 
WHERE insurance_type_id IN ('397d60ca-5d2d-4c20-abe5-cbe73f1384b9', '9bf3a0b0-fb64-4f77-b174-fab3731a5041');

-- 7. Merge Inventarisverzekering variants - keep capitalized version
UPDATE documents SET insurance_type_id = '7c11f19e-ca49-44c7-96e9-170be46ae8f4' 
WHERE insurance_type_id = '4e9fec57-5e3c-41a2-bea7-4d536a71917f';

-- 8. Merge Voorraadverzekering variants - keep capitalized version 
UPDATE documents SET insurance_type_id = 'fc9b8e34-e85e-4cf1-be8a-e5b06f1c8b2f' 
WHERE insurance_type_id = 'e1a3d9c8-5f7b-4a2e-9d0c-1e6f8a4b9c3d';

-- Delete the merged (now unused) insurance types
DELETE FROM insurance_types WHERE id IN (
  '35c5f0c8-6881-40c5-9b6f-4d7bfb6ecb0d', -- AOV
  'ce3160e1-9012-4fd2-9c4b-6972710f52d9', -- autoverzekering
  '6af72b8a-38b7-40c3-9b0f-07d74d1fc7d9', -- bedrijfsaansprakelijkheidsverzekering
  '830133a3-9197-44cd-880e-7d8dc948cd77', -- bestuurdersaansprakelijkheid
  '991ce59e-48d1-4550-92ec-ec8db610bee4', -- bestuurdersaansprakelijkheidsverzekering
  '4d3f0228-9f55-426c-9720-2f92ec0f31f0', -- gebouwenverzekering
  '397d60ca-5d2d-4c20-abe5-cbe73f1384b9', -- huurdersbelangverzekering
  '9bf3a0b0-fb64-4f77-b174-fab3731a5041', -- Huurdersbelangverzekering (tenant's interest insurance)
  '4e9fec57-5e3c-41a2-bea7-4d536a71917f'  -- inventarisverzekering
);

-- Also clean up the null entry and other problematic entries
DELETE FROM insurance_types WHERE id = '6d08f032-2b60-4d50-9296-3dbbb4cf995f'; -- null entry
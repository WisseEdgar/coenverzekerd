-- Assign all documents without insurance company to Centraal Beheer
UPDATE documents 
SET insurance_company_id = '7d9ec935-64e3-46e8-b00f-40b730719c77'
WHERE insurance_company_id IS NULL;
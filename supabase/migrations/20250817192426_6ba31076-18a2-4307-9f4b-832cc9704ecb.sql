-- Insert sample test data for the RAG system
-- Insert sample insurers
INSERT INTO insurers (name, kvk, website) 
SELECT name, kvk, website FROM (VALUES 
  ('ASR', '30070400', 'https://www.asr.nl'),
  ('Allianz', '24264121', 'https://www.allianz.nl'),
  ('Nationale Nederlanden', '33076048', 'https://www.nn.nl')
) AS ins(name, kvk, website)
WHERE NOT EXISTS (SELECT 1 FROM insurers WHERE insurers.name = ins.name);

-- Insert sample products
WITH insurer_ids AS (
  SELECT id, name FROM insurers WHERE name IN ('ASR', 'Allianz', 'Nationale Nederlanden')
)
INSERT INTO products (insurer_id, name, line_of_business, version_label, version_date, language) 
SELECT 
  i.id,
  product_name,
  lob,
  version_label,
  version_date::date,
  'nl'
FROM insurer_ids i
CROSS JOIN (VALUES 
  ('Bedrijfsaansprakelijkheid Plus', 'liability', 'v2024.1', '2024-01-01'),
  ('Algemene Bedrijfsverzekering', 'property', 'v2024.1', '2024-01-01'),
  ('Cyber Security Verzekering', 'cyber', 'v2024.1', '2024-01-01'),
  ('Particuliere Aansprakelijkheid', 'liability', 'v2024.1', '2024-01-01'),
  ('Auto Verzekering WA+', 'motor', 'v2024.1', '2024-01-01')
) AS products_data(product_name, lob, version_label, version_date)
WHERE NOT EXISTS (
  SELECT 1 FROM products p 
  WHERE p.insurer_id = i.id 
  AND p.name = product_name 
  AND p.line_of_business = lob
);
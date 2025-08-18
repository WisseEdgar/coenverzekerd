-- First check if we have any insurers for manual uploads
DO $$
DECLARE 
  insurer_id UUID;
  product_id UUID;
BEGIN
  -- Check if "Manual Uploads" insurer exists, if not create it
  SELECT id INTO insurer_id FROM insurers WHERE name = 'Manual Uploads';
  
  IF insurer_id IS NULL THEN
    INSERT INTO insurers (name, kvk, website) 
    VALUES ('Manual Uploads', NULL, NULL) 
    RETURNING id INTO insurer_id;
  END IF;
  
  -- Check if "Manual Text" product exists, if not create it
  SELECT id INTO product_id FROM products WHERE name = 'Manual Text' AND insurer_id = insurer_id;
  
  IF product_id IS NULL THEN
    INSERT INTO products (insurer_id, name, line_of_business, jurisdiction, language)
    VALUES (insurer_id, 'Manual Text', 'General', 'NL', 'nl');
  END IF;
END $$;
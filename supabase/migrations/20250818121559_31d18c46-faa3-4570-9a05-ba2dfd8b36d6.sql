-- Create insurer and product for manual uploads
DO $$
DECLARE 
  manual_insurer_id UUID;
  manual_product_id UUID;
BEGIN
  -- Check if "Manual Uploads" insurer exists, if not create it
  SELECT i.id INTO manual_insurer_id FROM insurers i WHERE i.name = 'Manual Uploads';
  
  IF manual_insurer_id IS NULL THEN
    INSERT INTO insurers (name, kvk, website) 
    VALUES ('Manual Uploads', NULL, NULL) 
    RETURNING id INTO manual_insurer_id;
  END IF;
  
  -- Check if "Manual Text" product exists, if not create it
  SELECT p.id INTO manual_product_id FROM products p WHERE p.name = 'Manual Text' AND p.insurer_id = manual_insurer_id;
  
  IF manual_product_id IS NULL THEN
    INSERT INTO products (insurer_id, name, line_of_business, jurisdiction, language)
    VALUES (manual_insurer_id, 'Manual Text', 'General', 'NL', 'nl');
  END IF;
END $$;
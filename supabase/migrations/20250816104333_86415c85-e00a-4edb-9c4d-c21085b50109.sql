-- Add missing insurance types found in the uploaded documents
INSERT INTO insurance_types (name, description) VALUES 
  ('Glasverzekering', 'Verzekering tegen schade aan glas in gebouwen en voertuigen'),
  ('Verzuimverzekering', 'Verzekering tegen inkomstenverlies bij ziekte van werknemers'),
  ('Werkmaterieel verhuurverzekering', 'Verzekering voor verhuur van werkmaterieel en machines'),
  ('Bedrijfswagenverzekering', 'Verzekering specifiek voor bedrijfswagens en commerciële voertuigen'),
  ('AOV (Arbeidsongeschiktheidsverzekering)', 'Verzekering tegen inkomensverlies bij arbeidsongeschiktheid')
ON CONFLICT (name) DO NOTHING;
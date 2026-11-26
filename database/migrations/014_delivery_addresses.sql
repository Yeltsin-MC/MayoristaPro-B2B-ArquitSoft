-- Entrega en Ayacucho: dirección de cada empresa (negocio del comprador o almacén del proveedor)
-- y la modalidad de entrega elegida en cada solicitud de cotización.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address text CHECK (char_length(address) <= 200);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS district text CHECK (char_length(district) <= 60);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS province text CHECK (char_length(province) <= 60);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS department text CHECK (char_length(department) <= 60);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_reference text CHECK (char_length(address_reference) <= 200);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_name text CHECK (char_length(contact_name) <= 100);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_phone text CHECK (contact_phone ~ '^\+?[0-9 ]{6,15}$');

-- Copia de la entrega al momento de pedir: no cambia si la empresa edita su dirección después.
-- modalidad: envio (a su negocio), recojo (en el almacén del proveedor) o agencia (de transporte).
ALTER TABLE quotation_requests ADD COLUMN IF NOT EXISTS delivery jsonb
  CHECK (delivery IS NULL OR (jsonb_typeof(delivery) = 'object' AND delivery->>'modalidad' IN ('envio', 'recojo', 'agencia')));

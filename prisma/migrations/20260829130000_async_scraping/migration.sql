-- La extracción pasa a ser asíncrona: la corrida de Apify se lanza y se reconcilia
-- después, así que el job necesita recordar de dónde recuperar sus resultados.
ALTER TABLE "scraping_jobs" ADD COLUMN "apifyDatasetId" TEXT;

-- Secreto por job que autentica la llamada del webhook de Apify.
ALTER TABLE "scraping_jobs" ADD COLUMN "webhookToken" TEXT;

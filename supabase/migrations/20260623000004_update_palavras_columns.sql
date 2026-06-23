-- Add Enabled and Icf columns to the palavras table
ALTER TABLE public.palavras 
ADD COLUMN IF NOT EXISTS "Enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "Icf" NUMERIC(6, 2) DEFAULT 0.00;

-- Index for optimized queries by Length and Enabled
CREATE INDEX IF NOT EXISTS idx_palavras_length_enabled ON public.palavras ("Length", "Enabled");

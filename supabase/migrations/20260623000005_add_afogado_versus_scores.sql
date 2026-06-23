-- Add new columns for Afogado mode to versus_results table
ALTER TABLE public.versus_results 
ADD COLUMN IF NOT EXISTS gabriel_afogado_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS alessandra_afogado_score INTEGER NOT NULL DEFAULT 0;

-- Add new columns for special modes to versus_results table
ALTER TABLE public.versus_results 
ADD COLUMN IF NOT EXISTS gabriel_bomb_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gabriel_crossword_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS gabriel_blitz_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS alessandra_bomb_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS alessandra_crossword_score INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS alessandra_blitz_score INTEGER NOT NULL DEFAULT 0;

-- Create policies for UPDATE and DELETE on versus_results if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'versus_results' AND policyname = 'Allow public update versus_results'
    ) THEN
        CREATE POLICY "Allow public update versus_results" ON public.versus_results FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'versus_results' AND policyname = 'Allow public delete versus_results'
    ) THEN
        CREATE POLICY "Allow public delete versus_results" ON public.versus_results FOR DELETE USING (true);
    END IF;
END
$$;

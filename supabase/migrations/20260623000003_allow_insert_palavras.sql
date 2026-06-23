-- Enable RLS and add public access policies to the palavras table
ALTER TABLE public.palavras ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'palavras' AND policyname = 'Allow public read palavras'
    ) THEN
        CREATE POLICY "Allow public read palavras" ON public.palavras FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'palavras' AND policyname = 'Allow public insert palavras'
    ) THEN
        CREATE POLICY "Allow public insert palavras" ON public.palavras FOR INSERT WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'palavras' AND policyname = 'Allow public update palavras'
    ) THEN
        CREATE POLICY "Allow public update palavras" ON public.palavras FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'palavras' AND policyname = 'Allow public delete palavras'
    ) THEN
        CREATE POLICY "Allow public delete palavras" ON public.palavras FOR DELETE USING (true);
    END IF;
END
$$;

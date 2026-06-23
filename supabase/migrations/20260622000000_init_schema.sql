-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Seed initial players
INSERT INTO public.profiles (name)
VALUES ('Gabriel'), ('Alessandra')
ON CONFLICT (name) DO NOTHING;

-- Create daily challenges table
CREATE TABLE IF NOT EXISTS public.challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL DEFAULT CURRENT_DATE,
    word_1 TEXT NOT NULL,          -- Word for Mode 1
    words_2 TEXT[] NOT NULL,        -- 2 Words for Mode 2
    words_4 TEXT[] NOT NULL,        -- 4 Words for Mode 4
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create match results table
CREATE TABLE IF NOT EXISTS public.results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Mode 1 stats
    mode_1_score INTEGER NOT NULL DEFAULT 0,
    mode_1_time INTEGER NOT NULL DEFAULT 0, -- in seconds
    mode_1_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Mode 2 stats
    mode_2_score INTEGER NOT NULL DEFAULT 0,
    mode_2_time INTEGER NOT NULL DEFAULT 0, -- in seconds
    mode_2_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Mode 4 stats
    mode_4_score INTEGER NOT NULL DEFAULT 0,
    mode_4_time INTEGER NOT NULL DEFAULT 0, -- in seconds
    mode_4_attempts INTEGER NOT NULL DEFAULT 0,
    
    -- Overall stats
    total_score NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(profile_id, date)
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_results_profile_date ON public.results(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_results_date ON public.results(date);
CREATE INDEX IF NOT EXISTS idx_challenges_date ON public.challenges(date);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- Simple public read/write access policies (no strict auth as per user's requests)
CREATE POLICY "Allow public read profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert profiles" ON public.profiles FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read challenges" ON public.challenges FOR SELECT USING (true);
CREATE POLICY "Allow public insert challenges" ON public.challenges FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public read results" ON public.results FOR SELECT USING (true);
CREATE POLICY "Allow public insert results" ON public.results FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update results" ON public.results FOR UPDATE USING (true);

-- Create versus results table
CREATE TABLE IF NOT EXISTS public.versus_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    
    -- Gabriel stats
    gabriel_termo_score INTEGER NOT NULL DEFAULT 0,
    gabriel_dueto_score INTEGER NOT NULL DEFAULT 0,
    gabriel_quarteto_score INTEGER NOT NULL DEFAULT 0,
    gabriel_total_score INTEGER NOT NULL DEFAULT 0,
    
    -- Alessandra stats
    alessandra_termo_score INTEGER NOT NULL DEFAULT 0,
    alessandra_dueto_score INTEGER NOT NULL DEFAULT 0,
    alessandra_quarteto_score INTEGER NOT NULL DEFAULT 0,
    alessandra_total_score INTEGER NOT NULL DEFAULT 0,
    
    -- Result
    winner TEXT NOT NULL, -- 'Gabriel', 'Alessandra', 'Empate'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    UNIQUE(date)
);

-- Enable RLS & simple policies for versus_results
ALTER TABLE public.versus_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read versus_results" ON public.versus_results FOR SELECT USING (true);
CREATE POLICY "Allow public insert versus_results" ON public.versus_results FOR INSERT WITH CHECK (true);

-- Create words table
CREATE TABLE IF NOT EXISTS public.words (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    word TEXT UNIQUE NOT NULL,
    length INTEGER NOT NULL,
    used_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    source TEXT NOT NULL DEFAULT 'IA'
);

-- Seed initial words
INSERT INTO public.words (word, length, source) VALUES
('BOLA', 4, 'Dicionário'), ('CASA', 4, 'Dicionário'), ('MESA', 4, 'Dicionário'), ('ROSA', 4, 'Dicionário'), ('GATO', 4, 'Dicionário'),
('TERMO', 5, 'Dicionário'), ('PORTA', 5, 'Dicionário'), ('VENTO', 5, 'Dicionário'), ('CHAVE', 5, 'Dicionário'), ('PLACA', 5, 'Dicionário'),
('CANETA', 6, 'Dicionário'), ('JANELA', 6, 'Dicionário'), ('PAREDE', 6, 'Dicionário'), ('CAMISA', 6, 'Dicionário'), ('SAPATO', 6, 'Dicionário'),
('CADERNO', 7, 'Dicionário'), ('ESPELHO', 7, 'Dicionário'), ('TECLADO', 7, 'Dicionário'), ('CELULAR', 7, 'Dicionário'), ('GARRAFA', 7, 'Dicionário'),
('TELEFONE', 8, 'Dicionário'), ('FLORESTA', 8, 'Dicionário'), ('PROBLEMA', 8, 'Dicionário'), ('PERGUNTA', 8, 'Dicionário'), ('RESPOSTA', 8, 'Dicionário'),
('COMPUTADOR', 10, 'Dicionário'), ('TECNOLOGIA', 10, 'Dicionário')
ON CONFLICT (word) DO NOTHING;

-- Create word generation jobs table
CREATE TABLE IF NOT EXISTS public.word_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL, -- 'Pending', 'Processing', 'Completed', 'Failed'
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    finished_at TIMESTAMP WITH TIME ZONE,
    requested_words INTEGER NOT NULL,
    generated_words INTEGER NOT NULL DEFAULT 0,
    error_message TEXT
);

-- Create blitz records table
CREATE TABLE IF NOT EXISTS public.blitz_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    duration INTEGER NOT NULL, -- 1, 3, 5, or 10 (minutes)
    words_solved INTEGER NOT NULL,
    attempts_used INTEGER NOT NULL,
    max_streak INTEGER NOT NULL,
    avg_time_per_word NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(duration)
);

-- Enable RLS
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.word_generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blitz_records ENABLE ROW LEVEL SECURITY;

-- Simple public access policies
CREATE POLICY "Allow public read words" ON public.words FOR SELECT USING (true);
CREATE POLICY "Allow public insert words" ON public.words FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update words" ON public.words FOR UPDATE USING (true);

CREATE POLICY "Allow public read jobs" ON public.word_generation_jobs FOR SELECT USING (true);
CREATE POLICY "Allow public insert jobs" ON public.word_generation_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update jobs" ON public.word_generation_jobs FOR UPDATE USING (true);

CREATE POLICY "Allow public read blitz_records" ON public.blitz_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert blitz_records" ON public.blitz_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update blitz_records" ON public.blitz_records FOR UPDATE USING (true);




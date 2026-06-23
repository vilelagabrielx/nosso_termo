create table public.palavras (
  "Id" bigint not null,
  "Word" text null,
  "Length" bigint null,
  "UsedCount" bigint null,
  "LastUsedAt" text null,
  "CreatedAt" timestamp with time zone null,
  "Source" text null,
  constraint palavras_pkey primary key ("Id")
) TABLESPACE pg_default;

create table public.palavras (
  "Id" bigint not null,
  "Word" text not null,
  "Length" smallint not null,
  "UsedCount" integer not null default 0,
  "LastUsedAt" timestamp with time zone null,
  "CreatedAt" timestamp with time zone null default now(),
  "Source" text null,
  "Icf" numeric(10, 4) null,
  "Enabled" boolean not null default true,
  constraint palavras_pkey primary key ("Id")
) TABLESPACE pg_default;

create index IF not exists idx_palavras_length on public.palavras using btree ("Length") TABLESPACE pg_default;

create index IF not exists idx_palavras_length_used on public.palavras using btree ("Length", "UsedCount") TABLESPACE pg_default;

create unique INDEX IF not exists ux_palavras_word on public.palavras using btree (lower("Word")) TABLESPACE pg_default;

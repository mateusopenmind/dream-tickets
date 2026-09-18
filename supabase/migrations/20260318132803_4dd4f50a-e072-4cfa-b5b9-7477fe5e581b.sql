
-- Add missing columns to emissoes
ALTER TABLE public.emissoes
  ADD COLUMN IF NOT EXISTS data_voo_ida date,
  ADD COLUMN IF NOT EXISTS milhas_real numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxas_real numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outros_real numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS codigo_la text,
  ADD COLUMN IF NOT EXISTS percentual_cb numeric,
  ADD COLUMN IF NOT EXISTS pagar_facial text,
  ADD COLUMN IF NOT EXISTS data_pagto_facial date,
  ADD COLUMN IF NOT EXISTS data_recebimento timestamptz,
  ADD COLUMN IF NOT EXISTS obs_pix text,
  ADD COLUMN IF NOT EXISTS id_externo text UNIQUE,
  ADD COLUMN IF NOT EXISTS cancelar boolean DEFAULT false;

-- Create lookup tables
CREATE TABLE public.operacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.programas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.origens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.emissores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.origens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emissores ENABLE ROW LEVEL SECURITY;

-- RLS policies for operacoes
CREATE POLICY "Authenticated users can read operacoes" ON public.operacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert operacoes" ON public.operacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update operacoes" ON public.operacoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Only admin can delete operacoes" ON public.operacoes FOR DELETE TO authenticated USING (is_delete_admin());

-- RLS policies for programas
CREATE POLICY "Authenticated users can read programas" ON public.programas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert programas" ON public.programas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update programas" ON public.programas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Only admin can delete programas" ON public.programas FOR DELETE TO authenticated USING (is_delete_admin());

-- RLS policies for origens
CREATE POLICY "Authenticated users can read origens" ON public.origens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert origens" ON public.origens FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update origens" ON public.origens FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Only admin can delete origens" ON public.origens FOR DELETE TO authenticated USING (is_delete_admin());

-- RLS policies for emissores
CREATE POLICY "Authenticated users can read emissores" ON public.emissores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert emissores" ON public.emissores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update emissores" ON public.emissores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Only admin can delete emissores" ON public.emissores FOR DELETE TO authenticated USING (is_delete_admin());


-- Create update_updated_at function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Clientes table
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome_fantasia TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Contas table
CREATE TABLE public.contas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read contas" ON public.contas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert contas" ON public.contas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update contas" ON public.contas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete contas" ON public.contas FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_contas_updated_at BEFORE UPDATE ON public.contas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cartoes table
CREATE TABLE public.cartoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read cartoes" ON public.cartoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert cartoes" ON public.cartoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update cartoes" ON public.cartoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete cartoes" ON public.cartoes FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_cartoes_updated_at BEFORE UPDATE ON public.cartoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Emissoes table
CREATE TABLE public.emissoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data_emissao DATE NOT NULL,
  hora TIME,
  localizador TEXT NOT NULL,
  programa TEXT,
  nome_operacao TEXT,
  emissor TEXT,
  origem_venda TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  cartao_id UUID REFERENCES public.cartoes(id) ON DELETE SET NULL,
  passageiros_qtd INTEGER DEFAULT 1,
  milhas_cobrado DECIMAL DEFAULT 0,
  preco_milheiro DECIMAL DEFAULT 0,
  taxas_cobrado DECIMAL DEFAULT 0,
  outros_cobrado DECIMAL DEFAULT 0,
  preco_total DECIMAL DEFAULT 0,
  status_pix TEXT DEFAULT 'EM ABERTO',
  valor_recebido DECIMAL DEFAULT 0,
  observacao TEXT,
  txid TEXT,
  reprocessar BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.emissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read emissoes" ON public.emissoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert emissoes" ON public.emissoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update emissoes" ON public.emissoes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete emissoes" ON public.emissoes FOR DELETE TO authenticated USING (true);
CREATE TRIGGER update_emissoes_updated_at BEFORE UPDATE ON public.emissoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

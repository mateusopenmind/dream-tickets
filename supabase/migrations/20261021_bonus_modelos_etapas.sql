-- Modelos de Bônus com várias etapas em sequência (ex.: 4x 10.000 a cada 3 meses e,
-- quando acabar, 6x 12.000 todo mês). Cada etapa: {rotulo, pontos, frequencia_meses, repeticoes}.
-- As colunas pontos/frequencia_meses/repeticoes continuam espelhando a 1ª etapa (compatibilidade).
alter table public.bonus_modelos
  add column if not exists etapas jsonb not null default '[]'::jsonb;

update public.bonus_modelos
   set etapas = jsonb_build_array(jsonb_build_object(
         'rotulo', null,
         'pontos', pontos,
         'frequencia_meses', frequencia_meses,
         'repeticoes', repeticoes))
 where etapas = '[]'::jsonb;

comment on column public.bonus_modelos.etapas is
  'Etapas em sequência do modelo: [{rotulo, pontos, frequencia_meses, repeticoes}]. Cada etapa começa quando a anterior termina.';

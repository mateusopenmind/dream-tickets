// Conteúdo central da Ajuda do DreamTickets.
// Fonte única usada pela página de Ajuda e pelos botões "?" de cada tela.
// As regras aqui refletem exatamente as validações do sistema.

export interface CampoRegra {
  campo: string;
  regra: string;
}

export interface SecaoAjuda {
  chave: string;            // identifica a seção (usada pelo botão ? contextual)
  telaChave: string;        // chave da TELA no controle de acesso (RBAC)
  titulo: string;
  resumo: string;
  passos: string[];
  regras: CampoRegra[];
  observacoes?: string[];
}

export const AJUDA: SecaoAjuda[] = [
  {
    chave: "geral",
    telaChave: "emissoes",
    titulo: "Visão Geral",
    resumo:
      "Como funciona o DreamTickets de ponta a ponta: cadastrar a emissão, gerar a cobrança Pix, enviar por WhatsApp e acompanhar o pagamento.",
    passos: [
      "1) Cadastre clientes, contas e cartões (menus correspondentes). São a base das emissões.",
      "2) Crie a emissão em 'Nova Emissão' com todos os dados obrigatórios (o ID e a data/hora são gerados sozinhos).",
      "3) Na lista de Emissões, clique no avião (✈️) para Cobrar: o sistema gera o Pix no banco (Sicredi; se o Sicredi estiver indisponível, usa o C6 automaticamente), grava na emissão e envia a mensagem (resumo + QR + copia-e-cola) por WhatsApp para o usuário que emitiu.",
      "4) Depois de cobrada, o botão de cobrar some (vira ✓). Para reenviar a mesma cobrança use a tela 'Reprocessamento' — não gera Pix novo.",
      "5) Quando o cliente paga, o banco avisa o sistema na hora e o status vira PAGO automaticamente, com valor e data do recebimento gravados; há ainda uma conferência automática a cada 15 minutos como garantia. Você é avisado do pagamento na tela (notificação com o nº da emissão e o valor) e por WhatsApp.",
    ],
    regras: [
      { campo: "Estados da cobrança", regra: "EM ABERTO (gerada, aguardando), PAGO (cliente pagou) e CANCELADO. O status é atualizado pelo sistema." },
      { campo: "Banco emissor do Pix", regra: "O Pix sai pelo Sicredi; se o Sicredi falhar, o sistema tenta o C6 na sequência (o banco usado fica registrado na emissão). Independe de qual usuário está emitindo." },
      { campo: "Validade do Pix", regra: "O Pix gerado vale por 1 ano (máximo aceito pelos bancos) — o cliente pode pagar a qualquer momento nesse período." },
      { campo: "Forma de cobrança", regra: "Hoje somente Pix. Cartão (C6 Pay) está pronto, porém desativado por ora." },
      { campo: "Destino do WhatsApp", regra: "A mensagem de cobrança vai para o WhatsApp do usuário que está emitindo (cadastrado em Usuários), não para o cliente." },
      { campo: "Sem duplicar", regra: "Uma emissão só pode gerar uma cobrança. Reenvios usam o mesmo Pix pela tela de Reprocessamento." },
      { campo: "Cancelar emissão", regra: "O botão 'Cancelar emissão' cancela a cobrança no banco em que foi gerada (Sicredi ou C6) e marca a emissão como CANCELADO. Você recebe a confirmação na tela e por WhatsApp. Cobrança já PAGA não pode ser cancelada." },
      { campo: "Pix cancelado", regra: "Emissão com Pix CANCELADO volta a ficar livre: o dono pode editar, gerar uma nova cobrança (o avião volta a aparecer) ou excluir. Ao recobrar, o sistema gera um novo Pix (novo TXID), atualiza o Banco Emissor e limpa a marcação de cancelamento." },
      { campo: "Excluir emissão", regra: "O dono da emissão pode excluir emissões SEM cobrança gerada ou com Pix CANCELADO. Com cobrança ativa/paga, só o administrador de exclusão." },
      { campo: "Visibilidade", regra: "Cada usuário enxerga somente as PRÓPRIAS emissões (as que ele criou). Administradores e super admins enxergam todas. Vale para a lista, dashboard, Reprocessamento, Pagamento Facial e avisos em tempo real." },
      { campo: "Conciliação bancária", regra: "Cada cobrança grava os identificadores do banco (txid, e2eid do pagamento, referência do checkout) para conciliação automática com o extrato." },
      { campo: "Padrão de mensagens", regra: "Todos os avisos (tela e WhatsApp) usam o nº da emissão (ID, ex.: MO00001) como referência — o Localizador aparece como informação complementar. Horários sempre no fuso de Brasília." },
    ],
    observacoes: [
      "O app se adapta a telas estreitas (celular): as tabelas viram cartões.",
      "Cada usuário só enxerga as telas (e a ajuda) que tem permissão.",
    ],
  },
  {
    chave: "emissoes",
    telaChave: "emissoes",
    titulo: "Emissões",
    resumo:
      "Tela principal. Lista todas as emissões com filtros, busca e ordenação, e é de onde você cria, edita e cobra uma emissão.",
    passos: [
      "Use os botões 'Mês Atual', 'Cobrança em Aberto' e 'Cobrança Pendente' (emissões ainda sem cobrança gerada) para filtrar rapidamente a lista.",
      "Há também filtro por Programa e por período (datas De/Até). Use 'Limpar filtros' para remover programa e datas de uma vez.",
      "Digite no campo de busca para localizar por qualquer dado da tabela: ID (MO...), localizador, programa, operação, cliente, conta, valores e status.",
      "Clique em qualquer cabeçalho da tabela (Data, Total, Total Milhas, etc.) para ordenar; clique de novo para inverter a ordem. A coluna Total Milhas mostra a soma: Qtde Milhas + Bagagens e Assentos quando informados em milhas.",
      "Clique em 'Nova Emissão' para abrir a tela de cadastro.",
      "Em cada linha, o lápis abre a edição, a lixeira remove, e o avião (✈️) inicia a cobrança.",
      "Ao clicar no avião, abre uma janela de confirmação com os dados principais (incluindo Bagagens e Assentos). Confira e clique em 'Confirmar e enviar' para gerar a cobrança Pix — via Sicredi, com o C6 de reserva automática (copia-e-cola + QR enviados por WhatsApp). 'Cancelar' volta para editar. (A cobrança por cartão está desativada no momento.)",
      "Depois de emitida, o botão de cobrar some e aparece '✓ Cobrança emitida em [data]' — para reenviar a mesma cobrança use a tela de Reprocessamento (não gera cobrança duplicada). Quando a cobrança é PAGA, nenhuma ação fica disponível (some Reprocessar/Cancelar) e mostra 'Cobrança paga'.",
    ],
    regras: [
      { campo: "ID", regra: "Identificador único da emissão gerado pelo sistema (começa com as iniciais do usuário, ex.: MO00001). Aparece na tabela e no topo da tela de edição." },
      { campo: "Total", regra: "Calculado automaticamente: (Milhas × Milheiro ÷ 1000) + Taxas + Bagagens + Assentos + Outros, arredondado em 2 casas. Taxas/Bagagens/Assentos informados em MILHAS entram no Total convertidos pelo Preço Milheiro (milhas × milheiro ÷ 1000)." },
      { campo: "Status da Cobrança", regra: "Preenchido pelo sistema (EM ABERTO, PAGO ou CANCELADO). Não é editado manualmente." },
      { campo: "Cobrança (Pix)", regra: "Ao cobrar, o sistema gera o Pix no Sicredi (ou no C6, se o Sicredi estiver indisponível) e envia a mensagem (resumo + QR + copia-e-cola) por WhatsApp para o usuário que está emitindo. Validade do Pix: 1 ano. A cobrança por cartão está desativada no momento." },
      { campo: "Cobrança já emitida", regra: "Emissão com cobrança gerada não mostra mais o botão de cobrar (vira ✓). Para reenviar, use a tela de Reprocessamento — nunca gera cobrança duplicada." },
      { campo: "Excluir (lixeira)", regra: "Ao clicar na lixeira, abre uma confirmação ('A emissão MO000XX será excluída definitivamente. Tem certeza?') com Não/Sim. O dono pode excluir enquanto a emissão não tem cobrança gerada (ou com Pix CANCELADO). Depois de cobrada, só o administrador de exclusão." },
    ],
    observacoes: [
      "Em telas estreitas (celular), a tabela vira cartões empilhados — sem rolagem horizontal.",
      "A mensagem de cobrança vai para o WhatsApp do usuário que emitiu (cadastrado em Usuários), não para o cliente.",
      "A lista é paginada em 100 registros por página. Use os controles no rodapé (‹ 1 2 3 ›) para navegar; busca, filtros e ordenação valem sobre todos os registros, não só a página atual.",
    ],
  },
  {
    chave: "nova_emissao",
    telaChave: "emissoes",
    titulo: "Nova Emissão / Editar Emissão",
    resumo:
      "Cadastro de uma emissão. A maioria dos campos é obrigatória. Data e hora geram automaticamente o campo de data/hora no banco, e o ID da emissão é gerado pelo sistema.",
    passos: [
      "Preencha os dados gerais: data, hora, localizador, programa, operação, data do voo, emissor, conta, cliente e nº de pax.",
      "Em 'Valores Cobrados', informe milhas, milheiro, taxas, bagagens, assentos e outros — o Preço Total é calculado sozinho somando tudo. Em Taxas, Bagagens e Assentos, escolha no seletor ao lado do campo se o valor é em R$ ou em MILHAS.",
      "Preencha o cartão utilizado e a origem da venda.",
      "Os campos com erro ficam com borda vermelha e mostram a mensagem na hora — corrija antes de salvar.",
      "Clique em 'Salvar Emissão'. Ao salvar uma nova emissão, o sistema já abre automaticamente a janela de confirmação de cobrança — confira os dados e clique em 'Confirmar e enviar' para gerar o Pix na hora (ou 'Cancelar' para cobrar depois pela lista). Na edição, a aba Geral mostra as ações conforme o estado da cobrança: se ainda não cobrada → botão 'Cobrar'; se já cobrada e em aberto → 'Reprocessar' e 'Cancelar emissão'; se PAGA → nenhuma ação, só o aviso 'Cobrança paga'.",
    ],
    regras: [
      { campo: "Localizador", regra: "Obrigatório. Sem espaços, em maiúsculas, com 6 ou 13 caracteres." },
      { campo: "Programa", regra: "Obrigatório. Mostra apenas os programas que a conta selecionada participa (e a conta filtra pelas que têm o programa). Configure os programas de cada conta em Contas." },
      { campo: "Código LA", regra: "Aparece SOMENTE quando o programa é Latam (junto com % Cashback e Facial Realizada). Obrigatório, deve começar com 'LA' e ter 13 caracteres. Se digitar algo diferente, o campo fica vermelho com o aviso." },
      { campo: "% Cashback / Facial Realizada", regra: "Campos exclusivos do programa Latam — ficam ocultos nos demais programas e só aparecem ao selecionar Latam." },
      { campo: "Qtde Milhas", regra: "Deve ser 0 ou no mínimo 1.000. Número inteiro." },
      { campo: "Nº de Pax", regra: "Obrigatório, no mínimo 1 passageiro." },
      { campo: "CPFs Otimizados", regra: "Aparece ao lado do Nº de Pax SOMENTE quando o programa é Smiles. Opcional; se preenchido, deve ser entre 1 e o Nº de Pax." },
      { campo: "Data do Voo (Ida)", regra: "Não pode ser anterior à Data de Emissão." },
      { campo: "Valores Cobrados", regra: "Ordem dos campos: Qtde Milhas, Preço Milheiro, Taxas, Bagagens, Assentos, Outros e Preço Total. Qtde Milhas e Preço Milheiro são obrigatórios; Taxas, Bagagens, Assentos e Outros são opcionais (0 por padrão). Nenhum valor pode ser negativo. Taxas, Bagagens e Assentos têm um seletor R$/Milhas: em R$ somam direto no Preço Total; em MILHAS entram no Total convertidos pelo Preço Milheiro e também somam no Total de Milhas da emissão (gravado no banco e exibido na lista: Qtde Milhas + Taxas + Bagagens + Assentos quando em milhas)." },
      { campo: "Valores Reais (Milhas, Taxas, Bagagens, Assentos, Outros)", regra: "Todos obrigatórios — devem estar preenchidos. Aceitam 0, mas não podem ser negativos. Taxas, Bagagens e Assentos têm seletor R$/Milhas próprio, independente dos Cobrados (dá para cobrar em R$ e registrar o custo real em milhas). Use 'Copiar dos Valores Cobrados' para preencher rápido — ele copia valores e tipos." },
      { campo: "Ajustes (Reais ≠ Cobrados)", regra: "Quando os Valores Reais diferem dos Cobrados, abre a seção de Ajustes com campos liberados por programa: Cupom (% — Smiles/Azul Viagens), Hack Upgrade (Smiles), Retarifação (Smiles/Latam/Azul Liminar/Azul Viagens/Interline/Iberia), Desconto Promocional (Smiles/Latam) e Campo Aberto (todos). É obrigatório preencher ao menos um." },
      { campo: "Valores (Milheiro/Taxas/Bagagens/Assentos/Outros/Reais)", regra: "Não podem ser negativos. Mostrados com 2 casas decimais." },
      { campo: "Outros", regra: "Quando informa um valor em 'Outros', abre o campo 'Descrição de Outros' (obrigatório) para registrar do que se trata a cobrança. Bagagens e assentos agora têm campos próprios — use 'Outros' para o que não se encaixar neles." },
      { campo: "Valores Reais", regra: "Use o botão 'Copiar dos Valores Cobrados' para preencher milhas, taxas, bagagens, assentos e outros reais iguais aos cobrados, inclusive o tipo R$/Milhas (o caso mais comum). Depois é só ajustar o que for diferente. Tipo diferente entre Cobrado e Real também conta como diferença e abre os Ajustes." },
      { campo: "Obrigatórios", regra: "Data, Hora, Localizador, Programa, Operação, Emissor, Origem, Cliente, Conta, Cartão Utilizado, Data do Voo e Nº de Pax." },
      { campo: "ID Emissão / Data-Hora", regra: "Gerados automaticamente pelo sistema; o ID é único e começa com as iniciais do usuário (ex.: MO00001)." },
      { campo: "Facial Realizada?", regra: "Aparece SOMENTE quando o programa é Latam. Já vem marcado como Sim por padrão (caso mais comum) — desmarque se a emissão não for pagamento facial. O valor e a data do facial NÃO são informados aqui — o pagamento é lançado depois na tela 'Pagamento Facial'." },
    ],
    observacoes: [
      "Na tela de Nova Emissão o ID ainda não existe — aparece a marcação 'ID gerado ao salvar'. Na edição, o ID já gerado aparece no topo, ao lado do título.",
      "A aba 'Cobrança' (somente leitura) mostra a forma, o Banco Emissor (Sicredi ou C6), o status, o TXID e o copia-e-cola do Pix, além de data/valor recebido. A Observação registra automaticamente por qual banco e em que data/hora (Brasília) o Pix foi emitido. Tudo preenchido pelo sistema.",
      "As listas de Cliente, Conta e Cartão Utilizado vêm ordenadas pelo código.",
      "O toggle 'Cancelar' foi removido — o cancelamento é feito pelo botão 'Cancelar emissão' na aba Geral (ações disponíveis ao editar).",
    ],
  },
  {
    chave: "reprocessamento",
    telaChave: "reprocessamento",
    titulo: "Reprocessamento",
    resumo:
      "Reenvia por WhatsApp a cobrança Pix (mensagem completa + QR Code) de emissões que já têm Pix gerado e ainda estão em aberto. Não gera um novo Pix — reaproveita o copia-e-cola já existente.",
    passos: [
      "A tela lista apenas emissões com Pix gerado e status EM ABERTO. Já abre filtrada pelo mês atual (pode desativar o filtro).",
      "Use a busca e os cabeçalhos para localizar/ordenar.",
      "Clique em 'Reenviar' na linha e confirme para reenviar a cobrança daquele cliente por WhatsApp.",
      "Para reenviar todas da lista de uma vez, use o botão 'Reenviar todas' no topo (com confirmação).",
    ],
    regras: [
      { campo: "Quais aparecem", regra: "Somente emissões com pix_copia_cola preenchido e status_pix = EM ABERTO." },
      { campo: "Reenviar", regra: "Reenvia a mensagem completa + QR Code do MESMO Pix por WhatsApp (para o usuário que emitiu), lendo só o banco de dados — não chama a API do banco nem gera novo Pix. Funciona igual para cobranças do Sicredi e do C6." },
      { campo: "Reenviar todas", regra: "Dispara o reenvio para todas as emissões da lista filtrada, uma a uma, e mostra o total enviado ao final." },
      { campo: "Pagas/canceladas", regra: "Não aparecem aqui — só cobranças EM ABERTO podem ser reenviadas." },
      { campo: "Acesso", regra: "Tela controlada por permissão — liberada pelo super admin (ou admin, dentro das telas que possui)." },
    ],
    observacoes: [
      "Em telas estreitas, a lista vira cartões com o botão Reenviar em cada um.",
      "A lista é paginada em 100 por página. 'Reenviar todas' age sobre toda a lista filtrada (não só a página exibida).",
    ],
  },
  {
    chave: "clientes",
    telaChave: "clientes",
    titulo: "Clientes",
    resumo:
      "Cadastro de clientes com todos os campos necessários para a emissão de NFS-e. Permite buscar dados na Receita pelo CNPJ.",
    passos: [
      "Clique em 'Novo' — o sistema já sugere o próximo código (padrão A###).",
      "Para PJ, informe o CNPJ e clique em buscar na Receita para preencher razão social, endereço e demais dados automaticamente.",
      "Confira/complete os campos obrigatórios de NFS-e e salve.",
      "Use a busca e a ordenação por cabeçalho para localizar clientes.",
    ],
    regras: [
      { campo: "Código", regra: "Obrigatório e único. Sugerido automaticamente no formato A### (ex.: A201)." },
      { campo: "Nome Fantasia", regra: "Obrigatório." },
      { campo: "CNPJ/CPF", regra: "Obrigatório e único (não pode repetir entre clientes)." },
      { campo: "Razão Social", regra: "Obrigatória quando o tipo é PJ (CNPJ)." },
      { campo: "Endereço", regra: "CEP, Logradouro, Número, Bairro, Município e UF são obrigatórios (necessários para NFS-e)." },
      { campo: "CEP (preenchimento automático)", regra: "Ao digitar o CEP completo (8 dígitos) ou sair do campo, o sistema busca o endereço online e preenche Logradouro, Bairro, Município e UF automaticamente. Só resta completar o Número." },
      { campo: "E-mail", regra: "Obrigatório — a NFS-e é enviada por e-mail." },
      { campo: "Telefone", regra: "Obrigatório. Escolha o país (padrão Brasil +55) e digite o número — a máscara é aplicada sozinha. No Brasil, ao começar com 9 usa o formato de celular (DD) 9XXXX-XXXX; senão, fixo (DD) XXXX-XXXX. É salvo com o código do país (ex.: +55 (54) 99999-9999)." },
      { campo: "Código IBGE", regra: "Buscado automaticamente; não aparece na tela." },
    ],
    observacoes: [
      "A lista é paginada em 100 por página; a busca e a ordenação valem sobre todos os clientes.",
    ],
  },
  {
    chave: "contas",
    telaChave: "contas",
    titulo: "Contas",
    resumo: "Contas de milhas (próprias ou de parceiros) usadas nas emissões, com os programas que cada conta participa e o saldo de milhas de cada programa.",
    passos: [
      "Clique em 'Novo', informe código e nome e os demais dados da conta.",
      "Selecione um programa no campo e clique em 'Adicionar' para incluí-lo na conta. Só programas adicionados podem ser usados nesta conta na emissão.",
      "Depois de adicionado: marcar = Ativo, desmarcar = Inativo (não apaga, mantém o saldo). A lixeira remove o programa da conta — mas não é permitido remover um programa que já tenha emissão nesta conta (nesse caso, apenas inative).",
      "Preencha o Nº Smiles e o Pix de envio quando aplicável.",
      "Salve. Na lista, a coluna 'Saldos de milhas' mostra só os programas com saldo, do maior para o menor.",
      "Use os filtros por Tipo (Própria/Terceiro) e por Programa (mostra só as contas que participam do programa escolhido), além da busca.",
    ],
    regras: [
      { campo: "Código", regra: "Obrigatório e único (não pode repetir entre contas)." },
      { campo: "Nome", regra: "Obrigatório." },
      { campo: "Programas e saldo", regra: "Marque os programas que a conta participa; cada um mostra Ativo/Inativo e o saldo. Desmarcar não apaga o saldo (fica Inativo, preservado). O saldo é atualizado automaticamente; apenas o super admin pode digitá-lo para teste." },
      { campo: "Nº Smiles", regra: "Número/login Smiles — usado para a atualização automática do saldo Smiles (quando ligada)." },
      { campo: "Demais campos", regra: "Nascimento, CPF, fone, e-mail, tipo e Pix de envio são opcionais." },
    ],
    observacoes: [
      "Na coluna de saldos só aparecem programas com saldo maior que zero, ordenados do maior para o menor.",
      "A lista é paginada em 100 por página.",
    ],
  },
  {
    chave: "cartoes",
    telaChave: "cartoes",
    titulo: "Cartões / Formas de Pagamento",
    resumo: "Cartões e formas de pagamento usados nas emissões.",
    passos: [
      "Clique em 'Novo', informe código e nome.",
      "Complete bandeira, titular, datas e limite se quiser.",
      "Salve. Use a busca, o filtro por Bandeira e a ordenação por cabeçalho para localizar.",
    ],
    regras: [
      { campo: "Código", regra: "Obrigatório e único." },
      { campo: "Nome", regra: "Obrigatório." },
      { campo: "Demais campos", regra: "Bandeira, titular, CPF/CNPJ, dia de fechamento, vencimento e limite são opcionais." },
    ],
    observacoes: [
      "A lista é paginada em 100 por página e pode ser filtrada por bandeira.",
    ],
  },
  {
    chave: "relatorio_saldos",
    telaChave: "relatorio_saldos",
    titulo: "Relatório de Saldos",
    resumo: "Mostra o saldo de milhas de cada conta por programa, com filtros e exportação.",
    passos: [
      "A tabela traz uma linha por conta + programa (código, conta, tipo, programa, status, saldo e data de atualização).",
      "Use os filtros: Programa, Tipo (Própria/Terceiro), Status (ativos/inativos), Saldo (com/sem) e a busca livre.",
      "Clique nos cabeçalhos para ordenar por qualquer coluna.",
      "Use 'Exportar CSV' para baixar os dados filtrados (abre no Excel).",
    ],
    regras: [
      { campo: "Total", regra: "O rodapé soma o total de milhas das linhas filtradas (Ativas, Inativas e Total geral) — considerando todos os registros, não só a página." },
      { campo: "Saldo", regra: "Vem do cadastro da conta (atualizado pela automação). Não é editado aqui." },
      { campo: "Acesso", regra: "Tela controlada por permissão — liberada pelo super admin (ou admin, dentro das telas que possui)." },
    ],
    observacoes: [
      "A lista é paginada em 100 por página; filtros, totais e exportação CSV consideram todos os registros filtrados, não apenas a página atual.",
    ],
  },
  {
    chave: "pagamento_facial",
    telaChave: "pagamento_facial",
    titulo: "Pagamento Facial",
    resumo: "Controla os pagamentos faciais das emissões Latam marcadas como facial. Lista os pendentes agrupados por conta e permite quitar várias de uma vez. (Facial é exclusivo do programa Latam.)",
    passos: [
      "A tela lista as emissões com 'É facial?' = Sim e ainda NÃO pagas, agrupadas por conta (código + nome), mostrando o nº da emissão, data, localizador e programa.",
      "Marque as emissões que vai pagar — pode marcar uma a uma ou a conta inteira pelo checkbox do cabeçalho do grupo.",
      "Clique em 'Pagar selecionados'. Informe o valor por emissão (padrão R$ 20) e a data do pagamento, e confirme.",
      "As emissões pagas saem da lista de pendentes. Use 'Ver pagos' para consultar o histórico (com valor e data de pagamento).",
    ],
    regras: [
      { campo: "Quais aparecem", regra: "Somente emissões com a flag 'É facial?' marcada e facial_pago = falso (pendentes). 'Ver pagos' mostra as já quitadas." },
      { campo: "Valor padrão", regra: "R$ 20 por emissão, editável no momento do pagamento. O total é valor × quantidade de emissões selecionadas." },
      { campo: "Pagamento em lote", regra: "Várias emissões da mesma conta (ou de contas diferentes) podem ser pagas de uma vez com a mesma data e valor." },
      { campo: "Acesso", regra: "Tela controlada por permissão — liberada pelo super admin (ou admin, dentro das telas que possui)." },
    ],
    observacoes: [
      "O valor e a data do facial não são preenchidos na emissão — só aqui, na hora de pagar.",
      "Os cartões do topo mostram o total de emissões pendentes e o valor estimado a pagar.",
      "Toda sexta-feira às 8h o sistema envia automaticamente por WhatsApp a lista dos faciais pendentes para o responsável efetuar os Pix no banco e dar baixa nesta tela.",
    ],
  },
  {
    chave: "usuarios",
    telaChave: "usuarios",
    titulo: "Usuários",
    resumo:
      "Gestão de usuários e permissões (somente para administradores). O ID Padrão de cada usuário é a base do prefixo dos IDs de emissão.",
    passos: [
      "Crie o usuário com nome, e-mail, papel e ID Padrão.",
      "O usuário recebe uma senha temporária e é obrigado a trocá-la no primeiro acesso.",
      "Use 'Resetar senha' para gerar nova senha temporária.",
      "Use 'Alterar minha senha' para trocar a sua própria senha.",
      "O super admin pode liberar qualquer tela para qualquer usuário. O admin também pode liberar telas para operadores, mas apenas as telas a que ele próprio tem acesso.",
    ],
    regras: [
      { campo: "ID Padrão", regra: "Iniciais usadas para gerar o ID de emissão (ex.: MO00001). Deve ser único por usuário." },
      { campo: "Papel", regra: "Define o acesso: super admin vê tudo; admin gerencia usuários; demais veem apenas as telas liberadas." },
      { campo: "Liberar telas", regra: "Super admin libera qualquer tela. Admin libera telas só para operadores e apenas as telas a que ele mesmo tem acesso (as demais telas do operador são preservadas)." },
      { campo: "Excluir", regra: "O botão de excluir só aparece para quem tem permissão (super admin / admin)." },
      { campo: "WhatsApp", regra: "Número do usuário. É para esse WhatsApp que as cobranças que ele emite são enviadas (resumo + QR/copia-e-cola). Sem WhatsApp, o envio não acontece." },
      { campo: "Senha", regra: "Deve ser forte: mínimo 8 caracteres, com letra maiúscula, minúscula, número e caractere especial. As senhas temporárias geradas pelo sistema já seguem essa regra." },
    ],
    observacoes: [
      "O botão 'Liberar telas' só aparece para usuários do tipo operador.",
      "A própria Ajuda respeita as permissões: cada usuário vê apenas o manual das telas a que tem acesso.",
    ],
  },
];

export function ajudaPorChave(chave: string): SecaoAjuda | undefined {
  return AJUDA.find((s) => s.chave === chave);
}

// Seções de ajuda visíveis para o usuário, conforme as telas a que ele tem acesso.
// Passe o conjunto de chaves de tela (de useMinhasTelas). Use isSuper=true para mostrar tudo.
export function ajudaVisiveis(telas: Set<string> | undefined, isSuper: boolean): SecaoAjuda[] {
  if (isSuper) return AJUDA;
  return AJUDA.filter((s) => telas?.has(s.telaChave));
}

// True se o usuário pode ver a ajuda da tela informada (super admin vê tudo).
export function podeVerAjuda(chave: string, telas: Set<string> | undefined, isSuper: boolean): boolean {
  if (isSuper) return true;
  const s = ajudaPorChave(chave);
  return !!s && !!telas?.has(s.telaChave);
}

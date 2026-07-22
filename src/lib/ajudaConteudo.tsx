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
      { campo: "Coluna Status", regra: "Mostra a situação da emissão: verde 'Ativa' quando a emissão existe normalmente; amarelo quando ela está vinculada a um reembolso, indicando o tipo (Reembolso Total, Reembolso Parcial ou Reembolso Taxas)." },
      { campo: "Banco emissor do Pix", regra: "O Pix sai pelo Sicredi; se o Sicredi falhar, o sistema tenta o C6 na sequência (o banco usado fica registrado na emissão). Independe de qual usuário está emitindo." },
      { campo: "Validade do Pix", regra: "O Pix gerado vale por 1 ano (máximo aceito pelos bancos) — o cliente pode pagar a qualquer momento nesse período." },
      { campo: "Forma de cobrança", regra: "Hoje somente Pix. Cartão (C6 Pay) está pronto, porém desativado por ora." },
      { campo: "Destino do WhatsApp", regra: "A mensagem de cobrança vai para o WhatsApp do usuário que está emitindo (cadastrado em Usuários), não para o cliente." },
      { campo: "Sem duplicar", regra: "Uma emissão só pode gerar uma cobrança. Reenvios usam o mesmo Pix pela tela de Reprocessamento." },
      { campo: "Cancelar Cobrança", regra: "O botão 'Cancelar Cobrança' cancela a cobrança no banco em que foi gerada (Sicredi ou C6) e marca a emissão como CANCELADO. Você recebe a confirmação na tela e por WhatsApp. Cobrança já PAGA não pode ser cancelada." },
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
    chave: "buscar_emissao",
    telaChave: "buscar_emissao",
    titulo: "Buscar Emissão",
    resumo:
      "Consulta única e somente leitura de qualquer emissão. Digite o localizador (ou ID/cliente) e o sistema traz todos os dados da emissão de forma compacta — inclusive emissões de outros usuários e as terceirizadas.",
    passos: [
      "Digite no campo de busca o Localizador, o ID da emissão (ex.: BR000061) ou o cliente (código ou nome) e pressione Enter ou clique em 'Buscar'.",
      "Cada resultado aparece como um cartão com todos os dados da emissão: cliente, programa, operação, milhas, valores, status, dono etc.",
      "O selo indica se é emissão 'Própria' (avião) ou 'Terceirizada' (prédio), e mostra quem é o dono da emissão.",
      "O botão 'Editar' só aparece para administradores (qualquer emissão) e para o dono (a própria emissão). Para os demais, a tela é apenas de consulta.",
    ],
    regras: [
      { campo: "O que traz", regra: "Emissões próprias, de outros usuários e terceirizadas, todas juntas. A busca casa por parte do Localizador, do ID da emissão ou do código/nome do cliente." },
      { campo: "Somente leitura", regra: "A tela é de consulta. Ninguém edita emissões de outros usuários por aqui — apenas administradores. O dono pode editar as próprias." },
      { campo: "Editar", regra: "Abre o formulário normal da emissão (própria ou terceirizada), respeitando as mesmas regras das telas de Emissões." },
    ],
    observacoes: [
      "Esta tela fica liberada para todos os usuários.",
      "A consulta é limitada aos 200 resultados mais recentes; refine o termo se precisar.",
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
      "Clique em 'Salvar Emissão'. Ao salvar uma nova emissão, o sistema já abre automaticamente a janela de confirmação de cobrança — confira os dados e clique em 'Confirmar e enviar' para gerar o Pix na hora (ou 'Cancelar' para cobrar depois pela lista). Na edição, a aba Geral mostra as ações conforme o estado da cobrança: se ainda não cobrada → botão 'Cobrar'; se já cobrada e em aberto → 'Reprocessar' e 'Cancelar Cobrança'; se PAGA → nenhuma ação, só o aviso 'Cobrança paga'.",
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
      { campo: "Compra após emissão (só Valores Reais)", regra: "Há uma caixa de marcar em Bagagens e outra em Assentos (independentes), logo abaixo de cada campo. Marque quando aquele item foi comprado depois da emissão — serve para, no futuro, conciliar com os itens/valores da fatura do cartão. Ficam desmarcadas por padrão." },
      { campo: "Ajustes (Reais ≠ Cobrados)", regra: "Quando os Valores Reais diferem dos Cobrados, abre a seção de Ajustes com campos liberados por programa: Cupom (% — Smiles/Azul Viagens), Hack Upgrade (Smiles), Retarifação (Smiles/Latam/Azul Liminar/Azul Viagens/Interline/Iberia), Taxa de Resgate (Azul Liminar), Desconto Promocional (Smiles/Latam) e Campo Aberto (todos). É obrigatório preencher ao menos um." },
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
      "O toggle 'Cancelar' foi removido — o cancelamento é feito pelo botão 'Cancelar Cobrança' na aba Geral (ações disponíveis ao editar).",
    ],
  },
  {
    chave: "reprocessamento",
    telaChave: "reprocessamento",
    titulo: "Reprocessamento",
    resumo:
      "Reenvia por WhatsApp a cobrança Pix (mensagem completa + QR Code) de emissões que já têm Pix gerado e ainda estão em aberto. Não gera um novo Pix — reaproveita o copia-e-cola já existente.",
    passos: [
      "A tela junta Emissões diretas e Emissões Terceirizadas na mesma lista — use os botões 'Todas / Direta / Terceirizada' para filtrar por tipo, e a coluna 'Tipo' mostra de qual vem cada linha.",
      "Lista apenas emissões com Pix gerado e status EM ABERTO. Já abre filtrada pelo mês atual (pode desativar o filtro).",
      "Use a busca e os cabeçalhos para localizar/ordenar.",
      "Clique em 'Reenviar' na linha e confirme para reenviar a cobrança daquele cliente por WhatsApp.",
      "Para reenviar todas da lista de uma vez, use o botão 'Reenviar todas' no topo (com confirmação) — respeita o filtro Direta/Terceirizada aplicado.",
    ],
    regras: [
      { campo: "Quais aparecem", regra: "Emissões diretas e Terceirizadas com pix_copia_cola preenchido e status_pix = EM ABERTO. O filtro Direta/Terceirizada só restringe a visualização, não o cadastro." },
      { campo: "Reenviar", regra: "Reenvia a mensagem completa + QR Code do MESMO Pix por WhatsApp (para o usuário que emitiu), lendo só o banco de dados — não chama a API do banco nem gera novo Pix. Funciona igual para cobranças do Sicredi e do C6, e para Emissões diretas ou Terceirizadas." },
      { campo: "Reenviar todas", regra: "Dispara o reenvio para todas as emissões da lista filtrada (respeitando mês atual e o filtro Direta/Terceirizada), uma a uma, e mostra o total enviado ao final." },
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
      { campo: "CNPJ/CPF", regra: "Obrigatório e único (não pode repetir entre clientes). O tipo (CPF ou CNPJ) é detectado automaticamente pela quantidade de dígitos — não há mais seletor de tipo. Se vier com dígitos a menos (ex.: zero à esquerda perdido), o sistema completa automaticamente ao salvar." },
      { campo: "Razão Social", regra: "Obrigatória quando o tipo é PJ (CNPJ)." },
      { campo: "Endereço", regra: "CEP, Logradouro, Número, Bairro, Município e UF são obrigatórios (necessários para NFS-e)." },
      { campo: "CEP (preenchimento automático)", regra: "Ao digitar o CEP completo (8 dígitos) ou sair do campo, o sistema busca o endereço online e preenche Logradouro, Bairro, Município e UF automaticamente. Só resta completar o Número." },
      { campo: "E-mail", regra: "Obrigatório — a NFS-e é enviada por e-mail." },
      { campo: "Telefone", regra: "Obrigatório. Escolha o país (padrão Brasil +55) e digite o número — a máscara é aplicada sozinha. No Brasil, ao começar com 9 usa o formato de celular (DD) 9XXXX-XXXX; senão, fixo (DD) XXXX-XXXX. É salvo com o código do país (ex.: +55 (54) 99999-9999)." },
      { campo: "Código IBGE", regra: "Buscado automaticamente; não aparece na tela." },
      { campo: "Nome completo do proprietário", regra: "Obrigatório." },
      { campo: "Origem", regra: "Obrigatório. Selecionada a partir do cadastro 'Origens Clientes' (em Configurações). Identifica de onde veio o cliente (ex.: Balcão Whats ASM, Master Miles, Cliente)." },
      { campo: "Nível", regra: "Obrigatório. Classificação do cliente: Padrão ou Vip (padrão: Padrão)." },
      { campo: "Grupo criado?", regra: "Obrigatório. Indica se o grupo do cliente já foi criado: Sim ou Não (padrão: Não)." },
      { campo: "Telegram", regra: "Opcional. Usuário ou link de contato do cliente no Telegram." },
    ],
    observacoes: [
      "A lista é paginada em 100 por página; a busca e a ordenação valem sobre todos os clientes.",
      "As opções de Origem são mantidas em Configurações → Origens Clientes.",
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
      "Use 'Atualizar agora' para puxar os saldos de Latam e Smiles na hora — ao terminar, a tela recarrega sozinha com os valores novos.",
    ],
    regras: [
      { campo: "Atualizar agora", regra: "Dispara a atualização dos saldos Latam (lê a planilha) e Smiles (lê os e-mails recentes) no momento. Pode levar alguns segundos; ao concluir, a página recarrega automaticamente. Só atualiza o que mudou (não sobrescreve com dados mais antigos)." },
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
    chave: "emissoes_terceirizadas",
    telaChave: "emissoes_terceirizadas",
    titulo: "Emissões Terceirizadas",
    resumo:
      "Emissões feitas com milhas/passagem compradas de um FORNECEDOR externo (em vez de Conta e Emissor próprios). Cobra o cliente por Pix igual às Emissões normais; o custo pago ao fornecedor é controlado separadamente.",
    passos: [
      "Funciona como a lista de Emissões: filtros (Mês Atual, Cobrança em Aberto, Programa, período), busca, ordenação e paginação.",
      "Clique em 'Nova Emissão Terceirizada' para cadastrar. O lápis edita, a lixeira exclui e o avião (✈️) cobra o cliente por Pix.",
      "Depois de paga a emissão pelo cliente, registre o pagamento ao fornecedor na tela 'Pagamento Fornecedores'.",
    ],
    regras: [
      { campo: "Sem Conta/Cartão", regra: "Esta tela não usa Conta nem Cartão Utilizado — a milha vem de um Fornecedor externo (cadastro próprio) e o custo é lançado em 'Custo Milheiro'/'Custo Total'. O campo Emissor existe normalmente (mesmo cadastro das Emissões normais)." },
      { campo: "Fornecedor", regra: "Obrigatório. Selecione no cadastro de Fornecedores (menu Fornecedores). É para a chave Pix desse fornecedor que o pagamento deve ser feito." },
      { campo: "Cobrança ao cliente", regra: "Igual às Emissões normais: Cobrar/Reprocessar/Cancelar via Pix (Sicredi/C6), mesma validade de 1 ano e mesmas regras de edição/exclusão por dono." },
      { campo: "Pagamento ao fornecedor", regra: "Controlado à parte, na tela 'Pagamento Fornecedores' — não interfere na cobrança ao cliente." },
      { campo: "Visibilidade", regra: "Cada usuário vê apenas as próprias emissões terceirizadas; administradores veem todas." },
    ],
  },
  {
    chave: "nova_emissao_terceirizada",
    telaChave: "emissoes_terceirizadas",
    titulo: "Nova Emissão Terceirizada / Editar",
    resumo:
      "Cadastro de uma emissão terceirizada. Mesma lógica das Emissões normais, com as diferenças abaixo.",
    passos: [
      "Preencha os dados gerais: data, hora, localizador, programa, operação, data do voo, Emissor, Fornecedor, cliente e nº de pax.",
      "Em 'Valores Cobrados', informe milhas, milheiro, taxas, bagagens, assentos e outros — o Preço Total (cobrado do cliente) é calculado sozinho.",
      "Em 'Valores Reais', informe Qtde Milhas e o 'Custo Milheiro' (o que você paga ao fornecedor por milheiro, em R$) — o 'Custo Total' é calculado automaticamente (mesma fórmula do Preço Total, usando o Custo Milheiro).",
      "Salve. Ao salvar uma nova emissão, abre a confirmação de cobrança ao cliente (Pix) — igual à tela de Emissões.",
    ],
    regras: [
      { campo: "Emissor", regra: "Obrigatório, mesmo cadastro de Emissores das Emissões normais (Configurações → Emissores)." },
      { campo: "CPFs Otimizados", regra: "Não existe nesta tela (mesmo para o programa Smiles)." },
      { campo: "% Cashback / Pagar facial?", regra: "Não existem nesta tela (mesmo para o programa Latam). Código LA continua obrigatório para Latam." },
      { campo: "Custo Milheiro", regra: "Valor em R$ que você paga ao fornecedor por milheiro de milhas — ao lado de Qtde Milhas, em Valores Reais." },
      { campo: "Custo Total", regra: "Calculado automaticamente: (Milhas Real × Custo Milheiro ÷ 1000) + Taxas + Bagagens + Assentos + Outros (Reais), mesma lógica do Preço Total. Substitui o campo Cartão Utilizado (não existe aqui, pois sempre se usa o cartão do fornecedor)." },
    ],
  },
  {
    chave: "fornecedores",
    telaChave: "fornecedores",
    titulo: "Fornecedores",
    resumo: "Cadastro dos fornecedores externos usados nas Emissões Terceirizadas — código, nome e chave Pix para pagamento.",
    passos: [
      "Clique em 'Novo Fornecedor' e preencha nome (obrigatório) e chave Pix — o código é gerado sozinho (F001, F002...).",
      "Use o botão de status (ativo/inativo) para deixar de oferecer um fornecedor sem apagar o histórico das emissões já lançadas com ele.",
    ],
    regras: [
      { campo: "Código", regra: "Gerado automaticamente pelo sistema em sequência (F001, F002...) ao salvar um novo fornecedor. Não é editável." },
      { campo: "Chave Pix", regra: "Usada na tela Pagamento Fornecedores para saber para onde mandar o Pix." },
      { campo: "Excluir", regra: "Só quem tem permissão de exclusão (super admin/admin) pode remover um fornecedor." },
    ],
  },
  {
    chave: "pagamento_fornecedores",
    telaChave: "pagamento_fornecedores",
    titulo: "Pagamento Fornecedores",
    resumo: "Controla os pagamentos devidos aos fornecedores das Emissões Terceirizadas — agrupado por fornecedor, com a chave Pix à mão.",
    passos: [
      "A tela lista as emissões terceirizadas ainda NÃO pagas ao fornecedor, agrupadas por fornecedor, com o Custo Total de cada uma.",
      "Use o botão 'Chave Pix' ao lado do nome do fornecedor para copiar a chave e fazer o Pix no banco.",
      "Marque as emissões pagas (de um único fornecedor por vez) e clique em 'Pagar selecionados'.",
      "Informe de qual banco saiu o pagamento e a data, e confirme.",
      "Use 'Ver pagos' para consultar o histórico, com data e banco de saída.",
    ],
    regras: [
      { campo: "Quais aparecem", regra: "Emissões terceirizadas com fornecedor_pago = falso. 'Ver pagos' mostra as já quitadas." },
      { campo: "Pagamento em lote", regra: "Várias emissões do MESMO fornecedor podem ser pagas de uma vez, com a mesma data e banco de saída." },
      { campo: "Banco de saída", regra: "Registra de qual conta bancária própria o Pix ao fornecedor foi enviado — não afeta a cobrança ao cliente. Lista de bancos mantida em Configurações → Bancos." },
    ],
    observacoes: [
      "O valor pago é o 'Custo Total' calculado da emissão (não editável nesta tela).",
    ],
  },
  {
    chave: "recebimentos_avulsos",
    telaChave: "recebimentos_avulsos",
    titulo: "Recebimentos Avulsos",
    resumo:
      "Registro manual de recebíveis: use quando o cliente paga uma emissão fora do Pix automático (transferência, boleto, dinheiro, parcelado, etc.). Só administradores têm acesso a esta tela.",
    passos: [
      "Clique em 'Lançar recebimento' e escolha a emissão em aberto (normal ou terceirizada) — a busca traz o ID, o cliente e o saldo ainda pendente.",
      "Informe em quantas parcelas o cliente vai pagar e a data da 1ª parcela. O sistema já sugere datas a cada 30 dias e divide o saldo em partes iguais — ajuste as datas e valores de cada parcela se necessário.",
      "Confirme em 'Lançar': as parcelas ficam com status PREVISTO, aguardando o recebimento de fato.",
      "Quando o dinheiro entrar, clique no ✓ da parcela, confirme a data, o banco e o valor recebido (pode ajustar se vier diferente do previsto).",
      "Use 'Ver recebidos' para consultar o histórico. Parcelas ainda previstas podem ser excluídas (lixeira) caso o lançamento tenha sido um engano.",
    ],
    regras: [
      { campo: "Acesso", regra: "Tela restrita a administradores (super admin e admin) — não é liberada para operadores." },
      { campo: "Vínculo", regra: "Cada lançamento é sempre de UMA emissão específica (normal ou terceirizada). Para dividir entre várias emissões, lance um recebimento avulso para cada uma." },
      { campo: "Parcelas", regra: "Ao lançar, você já define quantas parcelas o cliente vai pagar — o sistema cria todas de uma vez (status PREVISTO). Cada parcela é marcada como recebida individualmente, na data em que o dinheiro realmente entrar." },
      { campo: "Fechamento automático", regra: "Assim que a soma dos valores RECEBIDOS de uma emissão atinge o Preço Total dela, a emissão é marcada automaticamente como PAGO (mesmo status usado pela cobrança Pix), com o valor e a data do último recebimento gravados." },
      { campo: "Pagamento parcial", regra: "Enquanto a soma dos recebidos for menor que o Preço Total, a emissão continua EM ABERTO — o valor já recebido fica registrado, mas o status só muda quando fecha 100%." },
      { campo: "Banco", regra: "Informado apenas ao marcar a parcela como recebida (não é obrigatório no lançamento). Lista mantida em Configurações → Bancos." },
      { campo: "Excluir", regra: "Só parcelas ainda PREVISTAS podem ser excluídas. Uma parcela já marcada como recebida não pode ser apagada — corrija o valor/data reabrindo o registro no relatório, se necessário, junto ao suporte." },
    ],
    observacoes: [
      "Emissões com status PAGO ou CANCELADO não aparecem no seletor — só entram emissões EM ABERTO com saldo pendente.",
      "Use o 'Relatório de Recebimentos' para acompanhar tudo o que foi lançado e recebido por este mecanismo.",
    ],
  },
  {
    chave: "relatorio_recebimentos",
    telaChave: "relatorio_recebimentos",
    titulo: "Relatório de Recebimentos",
    resumo: "Acompanhamento de todos os recebimentos avulsos lançados — previstos e recebidos — com filtros, somatórios e exportação.",
    passos: [
      "Filtre por status (previsto/recebido), tipo de emissão (normal/terceirizada), banco e período.",
      "Os somatórios no topo mostram quantas parcelas há no filtro e o total previsto x recebido.",
      "As tabelas 'Recebido por banco' e 'Por cliente' ajudam a conferir o extrato bancário e a posição de cada cliente.",
      "Use 'Exportar CSV' para levar os dados filtrados para o Excel.",
    ],
    regras: [
      { campo: "Acesso", regra: "Tela restrita a administradores (super admin e admin), assim como a tela de Recebimentos Avulsos." },
      { campo: "Período", regra: "O filtro de data considera a Data de Recebimento quando a parcela já foi recebida, ou a Data Prevista quando ainda está pendente." },
      { campo: "Fonte dos dados", regra: "Mostra exatamente os lançamentos feitos em 'Recebimentos Avulsos' — não inclui cobranças pagas via Pix automático." },
    ],
  },
  {
    chave: "cobrancas_abertas",
    telaChave: "cobrancas_abertas",
    titulo: "Cobranças em Aberto",
    resumo:
      "Relatório enxuto das emissões com cobrança EM ABERTO, para filtrar por cliente, imprimir e enviar no grupo de WhatsApp dele.",
    passos: [
      "Selecione o código do cliente (a lista traz apenas clientes que têm cobrança em aberto).",
      "Confira as emissões listadas: ID, Data/Hora, Localizador, Programa, Operação, Data Voo Ida e Preço Total.",
      "O Total Geral aparece na última linha, somando todas as emissões do filtro.",
      "Clique em 'Imprimir' para abrir a versão limpa do relatório e imprimir ou salvar como PDF/imagem para enviar ao cliente.",
    ],
    regras: [
      { campo: "O que entra", regra: "Toda emissão com status de cobrança EM ABERTO, seja de conta própria ou terceirizada — as duas aparecem juntas, sem separação. Também entram reembolsos a cobrar do cliente (Pix em aberto), com a Operação aparecendo como 'Reembolso Total', 'Reembolso Parcial' ou 'Reembolso Taxas'." },
      { campo: "O que não entra", regra: "Emissões com status PAGO, CANCELADO ou REEMBOLSO." },
      { campo: "Preço Total", regra: "É o valor cheio da emissão. Recebimentos parciais não são descontados nesta tela — para o saldo pendente, use o Relatório de Recebimentos." },
      { campo: "Total Geral", regra: "Soma do Preço Total de todas as emissões exibidas no filtro atual." },
    ],
    observacoes: [
      "Sem cliente selecionado, o relatório mostra as cobranças em aberto de todos os clientes.",
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
  {
    chave: "reembolsos",
    telaChave: "reembolsos",
    titulo: "Reembolsos",
    resumo:
      "Registra o estorno de uma emissão. Não altera os valores da emissão original — a única coisa que muda: se a emissão ainda tiver uma cobrança Pix em aberto, essa cobrança é cancelada.",
    passos: [
      "Clique em 'Novo Reembolso' e digite o Localizador da emissão; clique em Buscar.",
      "Se houver mais de uma emissão com o mesmo localizador, selecione a correta na lista.",
      "Confira os dados compactos da emissão e os sinalizadores de prazo (voo dentro/fora das 24h e voo próximo/≤7 dias após a emissão).",
      "Escolha o Tipo de Reembolso (Total, Parcial ou Taxas) e o Motivo. No Parcial, informe o Nº de Pax (no máximo a quantidade da emissão).",
      "Os campos de 'Reembolso Cliente' (dos Valores Cobrados) e 'Reembolso Dream Tickets' (dos Valores Reais) vêm preenchidos e podem ser editados. No Parcial, Qtde Milhas e Taxas vêm proporcionais aos pax.",
      "Salve. O reembolso fica registrado na lista; a emissão permanece exatamente como estava.",
    ],
    regras: [
      { campo: "Não altera os valores da emissão", regra: "O reembolso não mexe nos valores, milhas ou estoque da emissão original. A única alteração possível é a cobrança: se havia Pix em aberto, ele é cancelado e a emissão fica como CANCELADO." },
      { campo: "Voo dentro das 24h", regra: "Sinaliza se o voo ocorre em até 24h após a emissão (base para regras de arrependimento/cancelamento)." },
      { campo: "Voo próximo", regra: "Sinaliza se o voo ocorre em até 7 dias após a emissão." },
      { campo: "Reembolso Parcial", regra: "Exige o Nº de Pax (máximo = pax da emissão). Qtde Milhas e Taxas são pré-preenchidas proporcionalmente aos pax." },
      { campo: "Queima CPF", regra: "Vem calculada da configuração (Configurações → Taxa Queima CPF): valor por CPF × nº de pax do reembolso. Editável. Ex.: Latam 2 pax = 2 × R$ 120 = R$ 240." },
      { campo: "Multa Programa / Cartão", regra: "Valor em R$ da multa cobrada pelo programa, com o cartão utilizado ao lado e a marcação de 'Taxas de embarque deduzidas'." },
      { campo: "Custo Milheiro (Dream)", regra: "Campo de preenchimento manual — não existe na emissão, é informado no reembolso." },
      { campo: "Resumo / liquidação", regra: "Quando a cobrança da emissão já foi PAGA, a base do resumo é o próprio Reembolso Cliente que você informou — se você descontar valores na mão (sem mexer no nº de pax), é esse valor que vale, sem o sistema refazer conta. Quando a cobrança está EM ABERTO, a base é o Valor pago emissão (zero, pois nada foi recebido). Em ambos os casos abate-se Multa Programa e Queima CPF; o resultado é o Total a Reembolsar (positivo) ou Total a Pagar (negativo)." },
      { campo: "Total a Reembolsar (positivo)", regra: "Temos que devolver ao cliente. Ao salvar, o reembolso entra na tela 'Pagamento de Reembolsos' para ser quitado (valor, data e banco)." },
      { campo: "Total a Pagar (negativo)", regra: "O cliente nos deve a diferença. Ao salvar, é gerada uma cobrança Pix (copia e cola) usando o mesmo fluxo das emissões." },
      { campo: "Cancela cobrança em aberto", regra: "Ao criar o reembolso, se a emissão tiver uma cobrança Pix em aberto, ela é cancelada automaticamente no banco e a emissão fica com a cobrança CANCELADO." },
      { campo: "Emissão trava para o operador", regra: "Depois que uma emissão tem reembolso (a coluna Status dela passa a mostrar 'Reembolso Total/Parcial/Taxas'), ela não pode mais ser editada pelo operador — só administradores. O botão de editar aparece como um cadeado." },
      { campo: "ID do reembolso", regra: "Cada reembolso recebe um ID próprio, gerado automaticamente ao salvar, seguindo a mesma sequência dos IDs de emissão do usuário (mesmo prefixo, ex.: MO000002)." },
    ],
    observacoes: [
      "O reembolso aparece para todos os usuários; qualquer um pode reembolsar a emissão de outro. Só o admin/super admin pode excluir um reembolso (nem o próprio dono).",
      "As taxas de Queima CPF são cadastradas em Configurações → Taxa Queima CPF.",
      "O reembolso não altera os valores da emissão original — apenas cancela uma eventual cobrança Pix em aberto.",
    ],
  },
  {
    chave: "pagamento_reembolsos",
    telaChave: "pagamento_reembolsos",
    titulo: "Pagamento de Reembolsos",
    resumo:
      "Controle dos reembolsos a pagar ao cliente (quando o Total a Reembolsar é positivo). Semelhante ao Pagamento Facial.",
    passos: [
      "A aba 'Pendentes' lista os reembolsos ainda não pagos; 'Pagos' mostra o histórico.",
      "Selecione um ou vários reembolsos e clique em 'Marcar como pago'.",
      "Informe a data do pagamento e o banco de saída (obrigatório) e confirme.",
    ],
    regras: [
      { campo: "Entram aqui", regra: "Somente reembolsos com Total a Reembolsar (positivo) — os negativos viram cobrança Pix, não entram nesta tela." },
      { campo: "Valor", regra: "É o Total a Reembolsar calculado no reembolso (Valor pago − Multa − Queima CPF)." },
      { campo: "Banco de saída", regra: "Obrigatório ao marcar como pago — é por onde o dinheiro saiu." },
      { campo: "Pagamento em lote", regra: "Dá para marcar vários de uma vez com a mesma data e banco." },
      { campo: "Remover da fila (Pendentes)", regra: "O botão de remover NÃO exclui o reembolso — apenas o tira desta lista de pagamentos. O reembolso continua salvo e pode ser editado depois. Para apagá-lo de vez, use a tela Reembolsos (só admin/super admin)." },
      { campo: "Desfazer pagamento (Pagos)", regra: "Reverte a quitação: o reembolso volta para Pendentes. Não exclui o reembolso." },
    ],
    observacoes: [
      "Marcar como pago não altera a emissão — apenas registra a quitação do reembolso.",
    ],
  },
  {
    chave: "reembolso_valores",
    telaChave: "reembolso_valores",
    titulo: "Reembolso Valores",
    resumo:
      "Acompanha os valores que voltam para o cartão de crédito usado na emissão (as taxas/despesas do lado Dream Tickets). As milhas não entram aqui.",
    passos: [
      "Na aba 'Pendentes', confira os reembolsos com valor a devolver no cartão.",
      "Selecione um ou vários e clique em 'Marcar como reembolsado'.",
      "Informe a data em que o valor voltou ao cartão e confirme.",
      "Na aba 'Reembolsados', use 'Desfazer' se precisar voltar um item para Pendentes.",
    ],
    regras: [
      { campo: "O que conta como valor do cartão", regra: "Soma de Taxas + Bagagens + Assentos + Outros do lado Dream Tickets. Só aparecem reembolsos em que esse total é maior que zero." },
      { campo: "Milhas não entram", regra: "A devolução de milhas ao estoque é controlada na tela Reembolso Milhas, não aqui." },
      { campo: "Total a devolver", regra: "O card no topo soma o total pendente de devolução no cartão." },
    ],
    observacoes: [
      "Marcar/desfazer aqui não altera o reembolso nem a emissão — é só o controle de quando o cartão foi estornado.",
    ],
  },
  {
    chave: "reembolso_milhas",
    telaChave: "reembolso_milhas",
    titulo: "Reembolso Milhas",
    resumo:
      "Acompanha as milhas que voltam ao estoque (a Qtde Milhas do lado Dream Tickets), organizadas por programa.",
    passos: [
      "Clique num programa para filtrar, se quiser.",
      "Na aba 'Pendentes', selecione um ou vários reembolsos e clique em 'Marcar como devolvido'.",
      "Informe a data da devolução ao estoque e confirme.",
      "Na aba 'Reembolsados', use 'Desfazer' para voltar um item para Pendentes.",
    ],
    regras: [
      { campo: "O que conta", regra: "Só aparecem reembolsos com Qtde Milhas (lado Dream Tickets) maior que zero. Reembolso Taxas, por exemplo, não gera devolução de milhas." },
      { campo: "Por programa", regra: "Os cards no topo somam as milhas a devolver (ou já devolvidas) por programa (Latam, Smiles etc.)." },
      { campo: "Valores no cartão", regra: "As taxas/despesas que voltam ao cartão são controladas na tela Reembolso Valores, não aqui." },
    ],
    observacoes: [
      "Marcar/desfazer aqui não altera o reembolso nem a emissão — é só o controle de quando as milhas voltaram ao estoque.",
    ],
  },
  {
    chave: "assinaturas",
    telaChave: "assinaturas",
    titulo: "Assinaturas de Clube",
    resumo:
      "Cadastra a assinatura de clube de cada conta em um programa (Livelo, Latam, Smiles...): o crédito base que entra a cada ciclo, os bônus extras e as próximas ações. Ao salvar, o sistema gera os lançamentos previstos na Conferência Clubes.",
    passos: [
      "Em Clubes → Assinaturas, clique em 'Nova Assinatura' (abre em tela cheia).",
      "Escolha a Conta (campo com busca, ordenado por código) e o Programa (só aparecem os programas vinculados àquela conta).",
      "Preencha Plano do clube (ex.: 20K), Assinatura Clube (pontos do crédito base que entram no estoque a cada ciclo) e a Periodicidade.",
      "Informe valor da parcela, dia de vencimento, o Cartão (dos cartões cadastrados) e o Cartão virtual (4 últimos dígitos, digitável).",
      "Em 'Bônus de assinatura', use 'Adicionar bônus' ou 'Adicionar do modelo': cada linha tem pontos, frequência, quantas vezes repete e a 1ª data prevista.",
      "Em 'Próximas ações', cadastre o que precisa ser feito e a data (vai para a central de pendências). Preencha a Observação se quiser e Salve.",
    ],
    regras: [
      { campo: "Conta + Programa", regra: "Só pode existir uma assinatura por conta em cada programa. O Programa lista só os vinculados à conta (ativos e inativos)." },
      { campo: "Assinatura Clube", regra: "Crédito base em pontos que entra no estoque a cada ciclo da periodicidade (horizonte gerado ~12 meses)." },
      { campo: "Bônus de assinatura", regra: "Cada linha gera N lançamentos previstos: 'Repetir' define as ocorrências e a frequência o espaçamento. 'Única vez' gera 1. 'Adicionar do modelo' preenche a partir dos Modelos de Bônus." },
      { campo: "Cartão virtual", regra: "Apenas os 4 últimos dígitos do cartão virtual daquela assinatura — campo digitável, sem dado sensível." },
      { campo: "Próximas ações", regra: "Ação + data que precisa ocorrer. Viram pendências (tipo Ação) ligadas à assinatura, para o acompanhamento/calendário. Salvar substitui as pendentes; as concluídas permanecem." },
      { campo: "Regeneração", regra: "Ao editar e salvar, as previsões NÃO confirmadas são refeitas. Lançamentos já confirmados nunca são alterados." },
      { campo: "Status", regra: "Ativo, Vai cancelar, Sem clube ou Cancelado. Cancelado marca a assinatura como inativa." },
    ],
    observacoes: [
      "Nada entra no saldo do estoque até ser confirmado na Conferência Clubes.",
      "Excluir a assinatura remove as previsões não confirmadas; as confirmadas permanecem no movimento do estoque.",
    ],
  },
  {
    chave: "bonus_modelos",
    telaChave: "bonus_modelos",
    titulo: "Modelos de Bônus",
    resumo:
      "Cadastro de padrões de bônus reutilizáveis (nome, pontos, frequência e repetições) para aplicar rapidamente nas assinaturas.",
    passos: [
      "Em Clubes → Modelos de Bônus, clique em 'Novo Modelo'.",
      "Dê um nome (ex.: 'Bônus trimestral 5K'), informe os pontos, a frequência e quantas vezes repete. Salve.",
      "Na tela de Assinatura, use o seletor 'Adicionar do modelo' para inserir um bônus já preenchido a partir do modelo.",
    ],
    regras: [
      { campo: "Nome / Pontos", regra: "Obrigatórios. O nome identifica o modelo no seletor da assinatura." },
      { campo: "Frequência / Repetir", regra: "Mesmo formato do bônus avulso: 'Única vez' ignora o repetir; as demais definem o espaçamento e o número de ocorrências." },
      { campo: "1ª entrada", regra: "Não fica no modelo — a data é definida na assinatura, ao aplicar o modelo." },
    ],
    observacoes: [
      "Alterar um modelo não muda os bônus já lançados nas assinaturas; só afeta os próximos que você adicionar a partir dele.",
    ],
  },
  {
    chave: "estoque",
    telaChave: "estoque",
    titulo: "Conferência Clubes",
    resumo:
      "Confere e confirma os créditos previstos (assinaturas e bônus). Ao confirmar, o crédito entra no estoque. Destaca as conferências atrasadas e separa o mês atual.",
    passos: [
      "Em Clubes → Conferência Clubes, veja os blocos: Atrasadas de meses anteriores (em destaque), Conferência do mês e Próximas.",
      "Confira cada crédito previsto e clique em 'Confirmar'.",
      "No pop-up, ajuste a Quantidade de milhas e, se for assinatura com custo, o Valor; informe o Motivo (obrigatório) e confirme.",
      "Opcional: selecione uma conta e um programa para ver só as conferências daquela conta.",
    ],
    regras: [
      { campo: "Atrasadas", regra: "Lançamentos previstos cuja data já passou aparecem destacados (fundo âmbar + selo 'atrasada'), inclusive os de meses anteriores." },
      { campo: "Conferência do mês", regra: "Bloco separado com os créditos previstos para o mês atual." },
      { campo: "Confirmar", regra: "Abre um pop-up para editar a quantidade de milhas e, quando for assinatura, o valor; o Motivo é obrigatório. Só então o crédito entra no estoque." },
      { campo: "Excluir", regra: "Remove uma previsão que não vai acontecer (só admin/super admin)." },
    ],
    observacoes: [
      "Os créditos previstos são gerados pela tela Assinaturas.",
      "Enquanto não confirmado, nada conta no saldo do estoque.",
    ],
  },
  {
    chave: "estoque_milhas",
    telaChave: "estoque_milhas",
    titulo: "Estoque — Acompanhamento",
    resumo:
      "Acompanha o estoque de milhas (movimento confirmado do livro) e concilia com o saldo lido do programa. Traz um painel com o total por programa e por conta.",
    passos: [
      "Em Estoque → Acompanhamento, veja o painel: cards com o total de milhas por programa e gráficos por conta (Total + um por programa), do maior para o menor.",
      "Selecione uma Conta e um Programa para ver a conciliação e o extrato daquela conta.",
      "Compare o Saldo calculado (livro) com o Saldo lido (programa); se houver diferença, use 'Reconciliar'.",
    ],
    regras: [
      { campo: "Estoque (painel)", regra: "É o movimento CONFIRMADO do livro (saldo inicial, assinaturas/bônus, ajustes, reembolsos menos emissões). NÃO é o saldo de conciliação." },
      { campo: "Saldo calculado (livro)", regra: "Soma de todos os movimentos confirmados da conta/programa." },
      { campo: "Saldo lido (programa)", regra: "Saldo real lido do programa (mesmo do Relatório de Saldos). É a referência da conciliação — o estoque não escreve nele." },
      { campo: "Diferença / Reconciliar", regra: "Saldo lido menos calculado. 'Reconciliar' lança um Ajuste igual à diferença para zerar." },
      { campo: "Movimento das milhas", regra: "Mostra só os lançamentos confirmados, com saldo corrente." },
    ],
    observacoes: [
      "Saldo inicial e ajustes são lançados em Estoque → Ajuste.",
      "Excluir um movimento só é permitido para admin/super admin.",
    ],
  },
  {
    chave: "estoque_ajuste",
    telaChave: "estoque_ajuste",
    titulo: "Estoque — Ajuste",
    resumo:
      "Lança saldo inicial e ajustes de estoque (entrada ou saída) por conta e programa. Cada lançamento entra confirmado no Acompanhamento.",
    passos: [
      "Em Estoque → Ajuste, clique em 'Novo ajuste'.",
      "Escolha o Tipo: 'Saldo inicial' (sempre entrada) ou 'Ajuste'. No Ajuste, escolha o Sentido: Entrada (soma) ou Saída (diminui).",
      "Informe conta, programa, data, quantidade de milhas e o motivo — todos obrigatórios. Salve.",
    ],
    regras: [
      { campo: "Tipo", regra: "Saldo inicial: abre o estoque com o saldo já existente. Ajuste: correções para mais ou para menos." },
      { campo: "Sentido (Ajuste)", regra: "Entrada soma ao estoque (+); Saída diminui (−). A quantidade é sempre positiva; o sinal vem do sentido." },
      { campo: "Obrigatórios", regra: "Conta, programa, data, quantidade de milhas e motivo são obrigatórios." },
      { campo: "Efeito", regra: "O lançamento entra já confirmado e aparece no Movimento das milhas (Acompanhamento) da conta/programa." },
    ],
    observacoes: [
      "A lista mostra todos os ajustes e saldos iniciais lançados; excluir só para admin/super admin.",
    ],
  },
  {
    chave: "planos_clube",
    telaChave: "planos_clube",
    titulo: "Planos de Clube",
    resumo:
      "Cadastro dos planos de cada programa (ex.: Latam 90K, Livelo 20K) com as milhas por ciclo e o valor da parcela. Ao escolher o plano na assinatura, esses valores são preenchidos automaticamente.",
    passos: [
      "Em Clubes → Planos, clique em 'Novo Plano'.",
      "Escolha o Programa, dê o nome do plano (ex.: 20K) e informe as milhas por ciclo e o valor da parcela. Salve.",
      "Na tela de Assinatura, o campo 'Plano do clube' passa a listar só os planos daquele programa; ao selecionar, milhas e valor são preenchidos.",
    ],
    regras: [
      { campo: "Programa + Plano", regra: "Obrigatórios. Não pode haver dois planos com o mesmo nome dentro do mesmo programa." },
      { campo: "Milhas (por ciclo)", regra: "Vai para o campo 'Assinatura Clube' da assinatura — os pontos que entram no estoque a cada ciclo." },
      { campo: "Valor (R$)", regra: "Vai para o campo 'Valor parcela' da assinatura." },
      { campo: "Edição na assinatura", regra: "Os valores preenchidos pelo plano continuam editáveis dentro da assinatura, caso aquele caso seja diferente." },
    ],
    observacoes: [
      "Alterar um plano não muda as assinaturas já salvas; vale para as próximas seleções.",
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

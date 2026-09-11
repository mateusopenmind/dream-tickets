// 404 do app inteiro — e também o que a PixPublicoPage mostra quando a cobrança não existe,
// já foi paga, foi cancelada ou a chave antiga venceu.
//
// Por isso ele é deliberadamente MUDO: sem link para o app, sem log no console, sem nada
// que sugira que aquele endereço um dia existiu ou que existe um sistema por trás. Quem
// abre um /pix/<chave> encerrado tem que ver a mesma parede que veria em qualquer URL
// inventada. Não acrescente aqui link, logo, mensagem de apoio nem telemetria: qualquer
// diferença entre este 404 e o de uma rota inexistente vira pista.
//
// Usuário logado que cai numa rota inválida continua com o menu lateral em volta (a rota
// "*" fica dentro do AppLayout), então não fica sem saída.
const NotFound = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="text-xl text-muted-foreground">Página não encontrada</p>
      </div>
    </div>
  );
};

export default NotFound;

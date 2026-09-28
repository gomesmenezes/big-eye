# Athenas Buscas — API REST v1

API de consulta de dados cadastrais brasileiros (pessoas, empresas, veículos e infraestrutura web). Todos os endpoints são \`GET\`, autenticados por header e devolvem JSON.

- \*\*Base URL:\*\* \`https://api.athenasbuscas.com/api/ext/v1\`
- \*\*Autenticação:\*\* header \`X-API-Key\`
- \*\*Formato:\*\* JSON (UTF-8)
- \*\*Módulos:\*\* 26

## Autenticação

Toda requisição exige o header \`X-API-Key\`. A chave é criada em \`/dev/api-keys\` e exibida uma única vez.

\`\`\`http
GET https://api.athenasbuscas.com/api/ext/v1/cpf/12345678900
X-API-Key: SUA\_API\_KEY
\`\`\`

\*\*Headers de resposta\*\*

| Header | Significado |
| --- | --- |
| \`X-Credits-Remaining\` | Saldo de créditos após a requisição. |
| \`X-Credits-Refunded\` | Presente e igual a \`1\` quando a consulta foi estornada. |

## Créditos

Cada consulta bem-sucedida consome 1 crédito (ou o equivalente do pacote ativo). Falhas de validação, 4xx, 5xx, timeout e respostas sem dados (404) são estornadas automaticamente — o header X-Credits-Refunded: 1 indica o estorno e X-Credits-Remaining traz o saldo atualizado.

## Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

&gt; Ausência de dados é sempre \`404\` com corpo \`{ "error": "..." }\` — a API nunca devolve \`200\` com resultado vazio.

## Índice de endpoints

| Módulo | Endpoint | Descrição |
| --- | --- | --- |
| CPF Cadsus | \`GET /cadsus/:cpf\` | Registro do CPF na base do SUS (CADSUS). |
| CPF Completo | \`GET /cpf/:cpf\` | Dossiê cadastral do CPF: contatos, endereços, score e parentes. |
| Dossiê 360 | \`GET /dossie-360/:cpf\` | Correlaciona o CPF em todas as fontes (DETRAN, CADSUS, veículos, RAIS, e-mails, placas…). |
| CPF Intelligent | \`GET /cpf-intelligent/:cpf\` | Perfil ampliado: emprego, empresas, benefícios, vizinhos e flags de risco. |
| Óbito | \`GET /obito/:cpf\` | Checagem objetiva de vivo/falecido pelo CPF. |
| Parentes | \`GET /parentes/:cpf\` | Rede familiar do CPF com grau de parentesco. |
| Score CPF V2 | \`GET /score/:cpf\` | Relatório financeiro completo: score, renda, processos e patrimônio. |
| CPF DETRAN | \`GET /cpf-detran/:cpf\` | Dados de habilitação (CNH) do condutor pelo CPF. |
| Email | \`GET /email/:email\` | Busca reversa por email + rastro público da conta Google + SPTrans. |
| Telefone | \`GET /phone/:phone\` | Busca reversa por telefone em quatro bases cadastrais. |
| Nome Abreviado | \`GET /name-abbreviated?query=\` | Busca por nome parcial ou abreviado, com paginação. |
| Nome Completo | \`GET /name?query=\` | Busca por nome completo, com paginação. |
| Endereço | \`GET /address?query=\` | Quem mora (ou morou) em um endereço. |
| Placa | \`GET /plate/:plate\` | Veículo completo por placa: proprietário, restrições e indicadores. |
| Chassi | \`GET /chassi/:chassi\` | Mesma ficha do veículo, consultando pelo VIN. |
| Renavam | \`GET /renavam/:renavam\` | Mesma ficha do veículo, consultando pelo RENAVAM. |
| CNPJ | \`GET /cnpj/:cnpj\` | Cadastro completo da empresa: sócios, CNAEs, situação e contato. |
| SPTrans (Bilhete Único) | \`GET /sptrans/:cpf\` | Cadastro do CPF no Bilhete Único / SPTrans. |
| Funcionários (CNPJ) | \`GET /employees/:cnpj\` | Folha de funcionários do estabelecimento declarada na RAIS. |
| RAIS por CPF | \`GET /rais/:cpf\` | Histórico de vínculos empregatícios do CPF na RAIS. |
| PIS/PASEP | \`GET /pis/:pis\` | Resolve o trabalhador e seus vínculos a partir do PIS/PASEP/NIT. |
| IRPF (Imposto de Renda) | \`GET /irpf/:cpf\` | Situação das declarações de IRPF do CPF, ano a ano. |
| IP | \`GET /ip/:ip\` | Geolocalização, ISP, ASN e classificação de risco de um IP. |
| Domínio (WHOIS) | \`GET /domain/:domain\` | WHOIS completo + registros DNS de um domínio. |
| Logins Vazados | \`GET /leaked-logins?q=\` | Credenciais vazadas (stealer logs) por URL, e-mail, CPF ou padrão com \*. |
| Status da API | \`GET /status\` | Estado atual e uptime de cada endpoint. Não consome crédito. |

## CPF

Consultas a partir do CPF — identificação, score, óbito, vínculos e CNH.

### CPF Cadsus

\`GET https://api.athenasbuscas.com/api/ext/v1/cadsus/:cpf\`

Consulta o Cartão Nacional de Saúde a partir do CPF. É a fonte mais confiável para nome da mãe, endereço de residência e indicador de óbito, porque é alimentada pela rede pública de saúde e atualizada em cada atendimento.

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* CADSUS / Ministério da Saúde
- \*\*Latência típica:\*\* 1–4 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Confirmar identidade e filiação em onboarding (KYC)
- Validar endereço residencial declarado pelo cliente
- Checar indicador de óbito antes de conceder crédito

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação (a API remove a máscara). | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/cadsus/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/cadsus/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/cadsus/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`data.cns\` | string | Cartão Nacional de Saúde (15 dígitos). |
| \`data.nome / nomeSocial\` | string | Nome civil e nome social, quando houver. |
| \`data.nomeMae / nomePai\` | string | Filiação. "SEM INFORMACAO" quando ausente na base. |
| \`data.endereco\` | object | Logradouro, número, bairro, CEP e município de residência. |
| \`data.telefones\[\]\` | array | DDD + número cadastrados na unidade de saúde. |
| \`data.qualidade\` | string | Percentual de completude do cadastro (ex.: "77%"). |
| \`data.vivo\` | string | "SIM" ou "NÃO" — indicador de óbito do CADSUS. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "data": {
    "cns": "898004906277049",
    "nome": "JOAO DA SILVA SANTOS",
    "nomeSocial": "",
    "nomeMae": "MARGARIDA SANTOS",
    "nomePai": "SEM INFORMACAO",
    "sexo": "MASCULINO",
    "dataNascimento": "27/05/1939",
    "idade": "86 anos",
    "nacionalidade": "BRASILEIRA",
    "cpf": "71440194815",
    "endereco": {
      "logradouro": "RUA VIRGILIO BRAIDO",
      "numero": "458",
      "bairro": "JARDIM IPE I",
      "cep": "13846048",
      "municipioResidencia": "MOGI GUACU - SP"
    },
    "telefones": \[
      {
        "ddd": "61",
        "numero": "33152425"
      }
    \],
    "qualidade": "77%",
    "vivo": "NÃO"
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- A cobertura é alta para quem já usou a rede pública; cadastros exclusivamente privados podem não existir.
- Os telefones do CADSUS costumam ser antigos — para contato ativo, prefira o módulo CPF Completo.


### CPF Completo

\`GET https://api.athenasbuscas.com/api/ext/v1/cpf/:cpf\`

O módulo mais usado da plataforma. Devolve em uma única chamada dados pessoais, emails com score de qualidade, telefones classificados por tipo, histórico de endereços, score de crédito, PIS, título de eleitor, poder aquisitivo, vínculos familiares e o histórico de IRPF na Receita Federal. É a mesma resposta do "CPF Completo" do painel.

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* BigDataCorp
- \*\*Latência típica:\*\* 1–5 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Enriquecimento de base de leads (email + telefone + renda presumida)
- Localização de devedores e cobrança
- Análise prévia de crédito com score CSB e histórico de declarações de IRPF

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/cpf/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/cpf/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/cpf/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`dadosPessoais\` | object | Nome, sexo, nascimento, filiação, estado civil, RG e situação cadastral na Receita. |
| \`emails\[\]\` | array | Email, indicador de pessoal (S/N), EMAIL\_SCORE (OTIMO/BOM/RUIM) e data de inclusão. |
| \`telefones\[\]\` | array | DDD, número, numeroCompleto, tipo (Celular/Fixo) e datas. Ordenados por relevância. |
| \`enderecos\[\]\` | array | Histórico de endereços com tipo, CEP e data de atualização. |
| \`score\[\]\` | array | csb8 (0–1000) + faixa de risco e csba (score de adimplência). |
| \`poderAquisitivo\[\]\` | array | Renda estimada e faixa de poder aquisitivo. |
| \`parentes\[\]\` | array | CPF e nome do vínculo + grau (MAE, PAI, IRMAO, CONJUGE...). |
| \`pis / tse\` | array | PIS/PASEP e dados de título de eleitor (zona e seção). |
| \`irpf\` | object\\|null | Histórico de IRPF: \`resumo\` + \`declaracoes\[\]\`, idênticos ao módulo /irpf/:cpf (sem o \`titular\`, que aqui é o próprio \`dadosPessoais\`). \`null\` quando o CPF não tem declaração na base. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-06-07T12:30:07.455Z",
  "cpf": "12345678900",
  "dadosPessoais": {
    "nome": "NOME COMPLETO DA PESSOA",
    "sexo": "M",
    "dataNascimento": "15-03-1980",
    "nomeMae": "NOME DA MÃE",
    "nomePai": "NOME DO PAI",
    "estadoCivil": "CASADO",
    "rg": "12345678",
    "nacionalidade": "BRASILEIRA",
    "dataObito": "",
    "tituloEleitor": "012345678901",
    "situacaoCadastro": "2",
    "dataSituacaoCadastro": "25/08/2019",
    "dataInformacao": "01/01/2026"
  },
  "emails": \[
    {
      "EMAIL": "exemplo@email.com",
      "EMAIL\_PESSOAL": "S",
      "EMAIL\_SCORE": "OTIMO",
      "DT\_INCLUSAO": "12/07/2017",
      "dataInclusao": "12/07/2017"
    }
  \],
  "telefones": \[
    {
      "DDD": "11",
      "TELEFONE": "999998888",
      "numeroCompleto": "11999998888",
      "tipo": "Celular",
      "TIPO\_TELEFONE": 3,
      "dataInclusao": "01/01/2015",
      "dataInformacao": "01/01/2026"
    },
    {
      "DDD": "11",
      "TELEFONE": "34567890",
      "numeroCompleto": "1134567890",
      "tipo": "Fixo",
      "TIPO\_TELEFONE": 1,
      "dataInclusao": "28/08/2010",
      "dataInformacao": "01/01/2026"
    }
  \],
  "enderecos": \[
    {
      "LOGR\_TIPO": "RUA",
      "LOGR\_NOME": "DAS FLORES",
      "logradouroTipo": "RUA",
      "logradouroCompleto": "DAS FLORES",
      "NUMERO": "123",
      "COMPLEMENTO": "APT 45",
      "BAIRRO": "JARDIM PAULISTA",
      "CIDADE": "SAO PAULO",
      "CEP": "01234567",
      "UF": "SP",
      "TIPO\_ENDERECO\_ID": "1",
      "tipoEndereco": "Residencial",
      "dataInclusao": "15/03/2020",
      "dataAtualizacao": "01/01/2026"
    }
  \],
  "score": \[
    {
      "csb8": "838",
      "csb8Faixa": "BAIXISSIMO RISCO",
      "csba": "242",
      "csbaFaixa": "ALTO"
    }
  \],
  "pis": \["17012345678"\],
  "tse": \[
    {
      "TITULO\_ELEITOR": "012345678901",
      "NSU": "1234",
      "ZONA": "123",
      "SECAO": "456",
      "tituloEleitor": "012345678901"
    }
  \],
  "poderAquisitivo": \[
    {
      "PODER\_AQUISITIVO": "ALTO",
      "FX\_PODER\_AQUISITIVO": "De R$ 1.500 a R$ 5.000",
      "RENDA": "3500,00",
      "rendaEstimada": "3500.00",
      "faixaRenda": "De R$ 1.500 a R$ 5.000"
    }
  \],
  "parentes": \[
    {
      "CPF\_Completo": "12345678900",
      "NOME": "NOME COMPLETO DA PESSOA",
      "CPF\_VINCULO": "98765432100",
      "NOME\_VINCULO": "NOME DA MÃE",
      "VINCULO": "MAE"
    }
  \],
  "irpf": {
    "resumo": {
      "totalRegistros": 9,
      "anos": \["2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022"\],
      "primeiroAno": "2014",
      "ultimoAno": "2022",
      "anosComDeclaracao": 8,
      "anosSemDeclaracao": 0,
      "anosComRestituicao": 7,
      "anosComImpostoAPagar": 1,
      "declaranteIrpf": true,
      "ultimaRestituicao": {
        "ano": "2021",
        "lote": 2,
        "dataLote": "30/06/2021",
        "banco": "Itaú Unibanco",
        "agencia": "0452"
      },
      "bancos": \[
        { "nome": "Itaú Unibanco", "agencias": \["0452"\], "anos": \["2021"\] }
      \]
    },
    "declaracoes": \[
      {
        "ano": "2021",
        "anoExercicio": "2022",
        "situacao": {
          "codigo": "RESTITUICAO\_CREDITADA",
          "descricao": "Restituição creditada",
          "tom": "green",
          "declarou": true,
          "restituicao": true,
          "detalhe": null,
          "original": "CREDITADA"
        },
        "declarou": true,
        "restituicao": {
          "houve": true,
          "lote": 2,
          "dataLote": "2021-06-30",
          "dataLoteBr": "30/06/2021",
          "banco": "Itaú Unibanco",
          "bancoOriginal": "ITAU UNIBANCO S.A.",
          "agencia": "0452"
        },
        "dataConsulta": "2021-10-18",
        "dataConsultaBr": "18/10/2021",
        "dataInclusao": "21/03/2022"
      }
    \]
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Arrays podem vir vazios quando a base não tem aquele bloco — sempre verifique o length antes de acessar índice.
- \`irpf\` é \`object\` ou \`null\` — teste a presença antes de acessar \`irpf.declaracoes\`. Para o histórico fiscal isolado (e sem o custo do dossiê inteiro), use o módulo /irpf/:cpf.
- Campos duplicados em MAIÚSCULA e camelCase (ex.: TELEFONE e numeroCompleto) existem por compatibilidade; prefira o camelCase.


### Dossiê 360

\`GET https://api.athenasbuscas.com/api/ext/v1/dossie-360/:cpf\`

Parte do cadastro do CPF (SRS Contatos), consulta as fontes externas de CPF (DETRAN/SERPRO, CADSUS, CNH Nacional, veículos do proprietário, antecedentes, dívida ativa, foto nacional, IRPF, SPTrans) e os índices Elasticsearch (RAIS, Serasa, Credlink, Leitura). Extrai e-mails, telefones, RGs, placas e CNPJs e correlaciona cada identificador nas bases correspondentes. A API devolve o JSON consolidado — inclusive \`photo.base64\` quando a foto nacional existe. No painel a mesma rota é consumida em stream e cada fonte aparece à medida que responde.

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* Elasticsearch + DETRAN/SERPRO + CADSUS + CPC Jurídico + Foto Nacional + CNPJ.ws
- \*\*Latência típica:\*\* 8–40 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Montar um dossiê investigativo completo a partir de um único CPF
- Obter a foto nacional junto com o cruzamento cadastral
- Descobrir e-mails e telefones e cruzá-los automaticamente nas demais bases

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/dossie-360/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/dossie-360/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/dossie-360/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`success\` | boolean | true quando a orquestração concluiu. |
| \`cpf\` | string | CPF consultado, só dígitos. |
| \`seed\` | object | Cadastro-base em srs\_contatos: cpfFormatado, contatosId e contato (NOME, NASC, NOME\_MAE, SEXO, RG…). |
| \`photo\` | object\\|null | Foto nacional. \`null\` quando não há imagem. Campos: origem ("Foto Nacional"), mime ("image/jpeg") e base64 (JPEG puro, sem prefixo data:). |
| \`photo.base64\` | string | JPEG em Base64. Monte a data URI com \`data:${photo.mime};base64,${photo.base64}\` para exibir ou gravar em arquivo. |
| \`identifiers\` | object | E-mails, telefones e CPFs extraídos e usados na correlação. |
| \`indices\[\]\` | array | Um item por índice: id, label, group, via (cpf/email/telefone), value, status (ok/empty/error), total, hits\[\] e ms. |
| \`summary\` | object | found, empty, errors e ms (duração total). |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "cpf": "12345678900",
  "seed": {
    "type": "seed",
    "cpf": "12345678900",
    "cpfFormatado": "123.456.789-00",
    "contatosId": 987654,
    "contato": {
      "NOME": "MARIA SILVA SANTOS",
      "CPF": "12345678900",
      "NASC": "1982-02-26",
      "SEXO": "F",
      "ESTCIV": "CASADO",
      "NOME\_MAE": "ANA SILVA SANTOS",
      "NOME\_PAI": "JOSE SANTOS",
      "RG": "123456789",
      "TITULO\_ELEITOR": "123456789012",
      "CONTATOS\_ID": 987654
    }
  },
  "photo": {
    "origem": "Foto Nacional",
    "mime": "image/jpeg",
    "base64": "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDAREAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAHwD/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
  },
  "identifiers": {
    "emails": \["maria.silva@email.com", "msantos@empresa.com.br"\],
    "phones": \["11987654321", "1133334444"\],
    "cpfs": \["12345678900", "98765432100"\]
  },
  "indices": \[
    {
      "id": "srs\_contatos",
      "key": "srs\_contatos:cpf",
      "label": "SRS Contatos (CPF Completo)",
      "group": "Cadastro",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 1,
      "hits": \[{
        "NOME": "MARIA SILVA SANTOS",
        "CPF": "12345678900",
        "NASC": "1982-02-26",
        "SEXO": "F",
        "ESTCIV": "CASADO",
        "NOME\_MAE": "ANA SILVA SANTOS",
        "NOME\_PAI": "JOSE SANTOS",
        "RG": "123456789",
        "TITULO\_ELEITOR": "123456789012",
        "CONTATOS\_ID": 987654
      }\],
      "error": null,
      "ms": 42
    },
    {
      "id": "foto-nacional",
      "key": "foto-nacional:cpf",
      "label": "Foto nacional",
      "group": "Biometria",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 1,
      "hits": \[{ "origem": "Foto Nacional" }\],
      "error": null,
      "ms": 810
    },
    {
      "id": "srs\_emails",
      "key": "srs\_emails:contatos\_id",
      "label": "E-mails",
      "group": "Contato",
      "via": "contatos\_id",
      "value": "987654",
      "status": "ok",
      "total": 2,
      "hits": \[
        { "EMAIL": "maria.silva@email.com", "EMAIL\_SCORE": "BOM", "EMAIL\_PESSOAL": "S", "DT\_INCLUSAO": "2016-01-13" },
        { "EMAIL": "msantos@empresa.com.br", "EMAIL\_SCORE": "RUIM", "EMAIL\_PESSOAL": "N", "DT\_INCLUSAO": "2014-11-14" }
      \],
      "error": null,
      "ms": 38
    },
    {
      "id": "srs\_telefones",
      "key": "srs\_telefones:contatos\_id",
      "label": "SRS Telefones",
      "group": "Contato",
      "via": "contatos\_id",
      "value": "987654",
      "status": "ok",
      "total": 2,
      "hits": \[
        { "DDD": "11", "TELEFONE": "987654321", "DT\_INCLUSAO": "2018-04-02" },
        { "DDD": "11", "TELEFONE": "33334444", "DT\_INCLUSAO": "2015-09-20" }
      \],
      "error": null,
      "ms": 31
    },
    {
      "id": "srs\_enderecos",
      "key": "srs\_enderecos:contatos\_id",
      "label": "SRS Endereços",
      "group": "Localização",
      "via": "contatos\_id",
      "value": "987654",
      "status": "ok",
      "total": 1,
      "hits": \[{
        "LOGR\_TIPO": "RUA",
        "LOGR\_NOME": "DAS FLORES",
        "LOGR\_NUMERO": "123",
        "BAIRRO": "JARDIM PAULISTA",
        "CIDADE": "SAO PAULO",
        "UF": "SP",
        "CEP": "01310100"
      }\],
      "error": null,
      "ms": 29
    },
    {
      "id": "srs\_parentes",
      "key": "srs\_parentes:cpf",
      "label": "SRS Parentes",
      "group": "Vínculos",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 2,
      "hits": \[
        { "NOME": "MARIA SILVA SANTOS", "CPF\_Completo": "12345678900", "NOME\_VINCULO": "ANA SILVA SANTOS", "CPF\_VINCULO": "11122233344", "VINCULO": "MAE" },
        { "NOME": "MARIA SILVA SANTOS", "CPF\_Completo": "12345678900", "NOME\_VINCULO": "JOSE SANTOS", "CPF\_VINCULO": "98765432100", "VINCULO": "PAI" }
      \],
      "error": null,
      "ms": 55
    },
    {
      "id": "srs\_irpf",
      "key": "srs\_irpf:cpf",
      "label": "IRPF (Receita Federal)",
      "group": "Fiscal",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 2,
      "hits": \[
        {
          "ano": "2015",
          "anoExercicio": "2016",
          "declarou": true,
          "situacao": { "codigo": "IMPOSTO\_A\_PAGAR", "descricao": "Imposto a pagar", "tom": "amber", "declarou": true, "restituicao": false, "detalhe": "Sem opção por débito automático" },
          "restituicao": { "houve": false },
          "dataInclusao": "09/11/2017"
        },
        {
          "ano": "2014",
          "anoExercicio": "2015",
          "declarou": true,
          "situacao": { "codigo": "RESTITUICAO\_CREDITADA", "descricao": "Restituição creditada", "tom": "green", "declarou": true, "restituicao": true, "detalhe": null },
          "restituicao": { "houve": true, "lote": 2, "dataLoteBr": "15/06/2015", "banco": "Banco do Brasil", "agencia": "1234" },
          "dataInclusao": "10/10/2016"
        }
      \],
      "error": null,
      "ms": 70
    },
    {
      "id": "srs\_score",
      "key": "srs\_score:contatos\_id",
      "label": "Score SRS",
      "group": "Financeiro",
      "via": "contatos\_id",
      "value": "987654",
      "status": "ok",
      "total": 1,
      "hits": \[{ "CSB8": 720, "CSB8\_FAIXA": "MEDIO", "CSBA": 640, "CSBA\_FAIXA": "MEDIO" }\],
      "error": null,
      "ms": 22
    },
    {
      "id": "srs\_tse",
      "key": "srs\_tse:contatos\_id",
      "label": "Título de eleitor (TSE)",
      "group": "Cadastro",
      "via": "contatos\_id",
      "value": "987654",
      "status": "ok",
      "total": 1,
      "hits": \[{ "TITULO\_ELEITOR": "123456789012", "ZONA": "001", "SECAO": "0123", "NSU": "998877" }\],
      "error": null,
      "ms": 18
    },
    {
      "id": "srs\_poder\_aquisitivo",
      "key": "srs\_poder\_aquisitivo:contatos\_id",
      "label": "Poder aquisitivo",
      "group": "Financeiro",
      "via": "contatos\_id",
      "value": "987654",
      "status": "ok",
      "total": 1,
      "hits": \[{ "PODER\_AQUISITIVO": "B", "FX\_PODER\_AQUISITIVO": "MEDIO", "RENDA\_PODER\_AQUISITIVO": "4500.00" }\],
      "error": null,
      "ms": 16
    },
    {
      "id": "srs\_pis",
      "key": "srs\_pis:contatos\_id",
      "label": "SRS PIS",
      "group": "Trabalhista",
      "via": "contatos\_id",
      "value": "987654",
      "status": "ok",
      "total": 1,
      "hits": \[{ "PIS": "17033259504" }\],
      "error": null,
      "ms": 14
    },
    {
      "id": "sptrans\_db",
      "key": "sptrans\_db:cpf",
      "label": "SPTrans (Bilhete Único)",
      "group": "Cadastro",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 1,
      "hits": \[{
        "nome": "MARIA SILVA SANTOS",
        "cpf": "12345678900",
        "cpfFormatado": "123.456.789-00",
        "dataNascimento": "1982-02-26",
        "idade": 44,
        "rg": "12345678-9",
        "matricula": "1012040483019",
        "email": "maria.silva@email.com",
        "endereco": { "completo": "RUA DAS FLORES, 123 — JARDIM PAULISTA — SAO PAULO - SP" }
      }\],
      "error": null,
      "ms": 48
    },
    {
      "id": "rais\_2019\_completa",
      "key": "rais\_2019\_completa:cpf",
      "label": "RAIS (vínculos trabalhistas)",
      "group": "Trabalhista",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 1,
      "hits": \[{
        "NOME\_TRABALHADOR": "MARIA SILVA SANTOS",
        "CPF": "12345678900",
        "PIS": "17033259504",
        "NOM\_RAZAO\_": "EMPRESA EXEMPLO LTDA",
        "CNPJ": "00000000000191",
        "ADMISSAO": "2015-03-01",
        "DEMISSAO": null,
        "SALARIO\_MENSAL": 350000,
        "CNAE\_20\_SUBCLAS": "6201500"
      }\],
      "error": null,
      "ms": 61
    },
    {
      "id": "serasa\_pf",
      "key": "serasa\_pf:cpf",
      "label": "Serasa PF",
      "group": "Cadastro",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 1,
      "hits": \[{ "cpf": "12345678900", "nome": "MARIA SILVA SANTOS", "data\_nascimento": "26/02/1982" }\],
      "error": null,
      "ms": 27
    },
    {
      "id": "credlink\_dados",
      "key": "credlink\_dados:cpf",
      "label": "Credlink",
      "group": "Cadastro",
      "via": "cpf",
      "value": "123.456.789-00",
      "status": "ok",
      "total": 1,
      "hits": \[{
        "NOME": "MARIA SILVA SANTOS",
        "CPF": "12345678900",
        "DT\_NASCIMENTO": "26/02/1982",
        "NOME\_MAE": "ANA SILVA SANTOS",
        "UF": "SP",
        "CIDADE": "SAO PAULO"
      }\],
      "error": null,
      "ms": 33
    }
  \],
  "summary": { "found": 14, "empty": 3, "errors": 0, "ms": 1840 }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- A API externa devolve o JSON final (não o stream NDJSON do painel). Timeout recomendado: 60 s.
- \`photo\` é \`null\` ou \`{ origem, mime, base64 }\`. Em produção o Base64 tem de alguns KB a algumas centenas de KB.
- Índices ausentes ou indisponíveis entram em \`status: "error"\` ou \`"empty"\` e não derrubam a consulta.
- E-mails iguais vindos do índice atual e do legado já vêm mesclados em \`srs\_emails\`.


### CPF Intelligent

\`GET https://api.athenasbuscas.com/api/ext/v1/cpf-intelligent/:cpf\`

Vai além do cadastral: traz vínculos empregatícios com CNPJ e datas de admissão, participação societária, benefícios sociais recebidos, vizinhos do endereço, propensão de consumo e flags de compliance (pessoa politicamente exposta, beneficiário de auxílios, servidor público SIAPE).

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* CPF Intelligent
- \*\*Latência típica:\*\* 2–8 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Due diligence e compliance (PEP, servidor público, auxílios)
- Prospecção B2B a partir do sócio pessoa física
- Investigação patrimonial e de rede de relacionamento

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/cpf-intelligent/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/cpf-intelligent/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/cpf-intelligent/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`DadosBasicos\` | object | Identificação completa + situação cadastral e bloco de óbito. |
| \`DadosEconomicos\` | object | Renda, poder aquisitivo e scores CSB/CSBA com faixa de risco. |
| \`empregos\[\] / empresas\[\]\` | array | Vínculos CLT (empresa, CNPJ, admissão, demissão) e participação societária. |
| \`beneficios\[\]\` | array | Bolsa Família, BPC e afins, com parcelas e total recebido. |
| \`vizinhos\[\]\` | array | Pessoas no mesmo endereço/quadra — útil para localização. |
| \`perfilConsumo\` | object | Probabilidades de crédito, financiamento e seguros. |
| \`servidor\_siape\` | object | Registros, remunerações e afastamentos quando servidor federal. |
| \`flags\` | object | \_\_pessoa\_exposta\_politicamente\_\_, \_\_beneficiario\_auxilios\_\_, \_\_servidor\_publico\_siape\_\_. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "status": 200,
  "foto": {
    "foto": null,
    "assinatura": null,
    "caracteristicas": \[\]
  },
  "DadosBasicos": {
    "nome": "NOME COMPLETO DA PESSOA",
    "cpf": "123.456.789-00",
    "cns": "123456789012345",
    "dataNascimento": "15/03/1980",
    "sexo": "F - FEMININO",
    "cor": "PARDA",
    "nomeMae": "NOME DA MÃE",
    "nomePai": "NOME DO PAI",
    "municipioNascimento": "SAO PAULO",
    "escolaridade": "Superior",
    "estadoCivil": "Casado",
    "nacionalidade": "BRASILEIRA",
    "obito": {
      "obito": "NÃO",
      "dataObito": "Não consta."
    },
    "situacaoCadastral": {
      "codigoSituacaoCadastral": "2",
      "descricaoSituacaoCadastral": "REGULAR",
      "dataSituacaoCadastral": "2019-08-25 00:00:00"
    }
  },
  "DadosEconomicos": {
    "renda": "3500,00",
    "poderAquisitivo": {
      "codigoPoderAquisitivo": "3",
      "poderAquisitivoDescricao": "ALTO",
      "rendaPoderAquisitivo": "3500,00",
      "faixaPoderAquisitivo": "De R$ 1.500 a R$ 5.000"
    },
    "score": {
      "scoreCSB": "750",
      "scoreCSBFaixaRisco": "BAIXO",
      "scoreCSBA": "200",
      "scoreCSBAFaixaRisco": "ALTO"
    }
  },
  "profissao": {
    "cbo": "2121-05",
    "cboDescricao": "Analista de Sistemas",
    "pis": "17012345678"
  },
  "empregos": \[
    {
      "empresa": "EMPRESA EXEMPLO LTDA",
      "cnpj": "12.345.678/0001-90",
      "admissao": "15/03/2018",
      "demissao": "--"
    }
  \],
  "empresas": \[
    {
      "cnpj": "12.345.678/0001-90",
      "tipoRelacao": "QSA",
      "relacao": "OWNER",
      "admissao": "10/07/2021",
      "demissao": "31/12/9999"
    }
  \],
  "tituloEleitor": {
    "tituloEleitorNumero": "012345678901",
    "zonaTitulo": "123",
    "secaoTitulo": "456"
  },
  "enderecos": \[
    {
      "tipoLogradouro": "Rua",
      "logradouro": "DAS FLORES",
      "logradouroNumero": "123",
      "complemento": "Apt 45",
      "bairro": "JARDIM PAULISTA",
      "cidade": "SAO PAULO",
      "uf": "SP",
      "cep": "01234567"
    }
  \],
  "telefones": \[
    {
      "telefone": "1198765432",
      "status": "ATIVO",
      "tipo": "TELEFONE MÓVEL",
      "operadora": "VIVO",
      "whatsapp": true
    },
    {
      "telefone": "1134567890",
      "status": "ATIVO",
      "tipo": "TELEFONE RESIDENCIAL",
      "operadora": "EMBRATEL",
      "whatsapp": false
    }
  \],
  "emails": \[
    {
      "email": "exemplo@email.com",
      "prioridade": "MUITO ALTA",
      "qualidade": "BOM",
      "emailPessoal": "SIM",
      "blacklist": "NÃO"
    }
  \],
  "parentes": \[
    {
      "nomeParente": "NOME DA MÃE",
      "cpfParente": "987.654.321-00",
      "grauParentesco": "MAE"
    }
  \],
  "beneficios": \[
    {
      "tipo": "bolsaFamilia",
      "beneficio": "BOLSA FAMILIA",
      "totalParcelasRecebidas": 12,
      "totalRecebido": "R$ 1.800,00",
      "parcelasRecebidas": \[\]
    }
  \],
  "vizinhos": \[
    {
      "nome": "NOME VIZINHO",
      "cpf": "123.123.123-45",
      "dataNascimento": "20/05/1985",
      "idade": 39,
      "sexo": "M - MASCULINO",
      "nomeMae": "NOME MAE VIZINHO"
    }
  \],
  "perfilConsumo": {
    "credito\_pessoal\_pre\_aprovado": true,
    "possui\_cartao\_de\_credito": true,
    "possui\_cartao\_prime": true,
    "possui\_casa\_propria": true,
    "possui\_investimentos": false,
    "credito\_pessoal": "57% de probabilidade positiva.",
    "financiamento\_veiculo": "41% de probabilidade positiva.",
    "seguros": {
      "seguro\_automotivo": "30% de probabilidade positiva.",
      "seguro\_saude": "27% de probabilidade positiva.",
      "seguro\_vida": "35% de probabilidade positiva."
    }
  },
  "servidor\_siape": {
    "ID\_Servidor": "",
    "Registros\_Servidor": \[\],
    "Remuneracoes\_Servidor": \[\],
    "Afastamentos\_Servidor": \[\],
    "Observacoes\_Servidor": \[\]
  },
  "flags": {
    "\_\_pessoa\_exposta\_politicamente\_\_": false,
    "\_\_beneficiario\_auxilios\_\_": false,
    "\_\_servidor\_publico\_siape\_\_": false
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- É a consulta mais pesada do catálogo — dimensione o timeout do seu cliente para pelo menos 30 s.
- O campo "foto" existe na estrutura mas costuma vir nulo; a imagem depende da UF de origem.


### Óbito

\`GET https://api.athenasbuscas.com/api/ext/v1/obito/:cpf\`

Resposta enxuta e barata para a única pergunta que importa em várias esteiras: a pessoa está viva? Ideal para rodar em lote antes de disparar campanha, conceder crédito ou renovar contrato.

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* Base consolidada de registro civil
- \*\*Latência típica:\*\* &lt; 2 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Higienização de base antes de campanha de marketing
- Bloqueio de concessão de crédito a titular falecido
- Rotina de recadastramento de beneficiários

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/obito/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/obito/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/obito/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`data.cpf\` | string | CPF formatado. |
| \`data.nomeCompleto\` | string | Nome do titular. |
| \`data.dataNascimento\` | string | Data de nascimento (DD/MM/AAAA). |
| \`data.statusObito\` | string | "VIVO" ou "FALECIDO". |

#### Exemplo de resposta (200)

\`\`\`json
{
  "data": {
    "cpf": "123.456.789-00",
    "nomeCompleto": "NOME COMPLETO DA PESSOA",
    "dataNascimento": "15/03/1980",
    "statusObito": "VIVO"
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Registro de óbito tem defasagem cartorária de semanas — "VIVO" não é prova de vida em tempo real.


### Parentes

\`GET https://api.athenasbuscas.com/api/ext/v1/parentes/:cpf\`

Lista os vínculos familiares do titular com CPF, nome e grau (MAE, PAI, IRMAO, CONJUGE, FILHO). Serve de ponto de partida para localização quando os contatos diretos do titular estão desatualizados.

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* Base consolidada de vínculos
- \*\*Latência típica:\*\* &lt; 2 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Localização por terceiros na cobrança
- Mapeamento de grupo familiar para análise de risco
- Validação de declaração de dependentes

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/parentes/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/parentes/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/parentes/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`parentes\[\].CPF\_VINCULO\` | string | CPF do parente (formatado). |
| \`parentes\[\].NOME\_VINCULO\` | string | Nome do parente. |
| \`parentes\[\].VINCULO\` | string | Grau de parentesco. |
| \`totalAproximado\` | number | Total de vínculos encontrados. |
| \`relation\` | string | "eq" quando o total é exato, "gte" quando é um piso. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-04-15T12:30:07.455Z",
  "cpf": "123.456.789-00",
  "parentes": \[
    {
      "CPF\_VINCULO": "987.654.321-00",
      "NOME\_VINCULO": "NOME DO PARENTE",
      "VINCULO": "MAE",
      "cpfVinculo": "98765432100"
    },
    {
      "CPF\_VINCULO": "555.444.333-22",
      "NOME\_VINCULO": "OUTRO PARENTE",
      "VINCULO": "CONJUGE",
      "cpfVinculo": "55544433322"
    }
  \],
  "totalAproximado": 2,
  "relation": "eq"
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- O mesmo bloco de parentes aparece dentro do CPF Completo — use este módulo quando só precisar dos vínculos.


### Score CPF V2

\`GET https://api.athenasbuscas.com/api/ext/v1/score/:cpf\`

A visão financeira mais profunda do catálogo. Além do score em três janelas (d00/d30/d60), traz renda individual, familiar e presumida, classe social, resumo de processos, histórico de consultas por segmento, registros de cobrança, empresas relacionadas, local de votação, veículos e imóveis.

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* Bureau de crédito (V2)
- \*\*Latência típica:\*\* 2–8 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Motor de decisão de crédito e definição de limite
- Análise de capacidade de pagamento em renegociação
- Verificação patrimonial antes de ação judicial

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/score/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/score/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/score/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`data.scoreCredito\` | object | Score em d00, d30 e d60 (evolução recente). |
| \`data.renda\` | object | Individual, familiar, empresarial, presumida + classe pessoal e familiar. |
| \`data.resumo\` | object | Contadores de emails, telefones, endereços, imóveis e veículos. |
| \`data.topContatos\` | object | Melhor email, melhor endereço, celular e fixo com rank. |
| \`data.resumoProcessos\` | object | Total de processos como autor, réu e outros. |
| \`data.ultimasConsultas\[\]\` | array | Quem consultou o CPF, por área de atuação e data. |
| \`data.cobranca\[\]\` | array | Registros de cobrança por empresa, com quantidade atual e histórica. |
| \`data.pessoasRelevantes\[\]\` | array | Vínculos com status PPE/VIP quando aplicável. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "data": {
    "titulo": "123.456.789-00 - NOME COMPLETO DA PESSOA",
    "dadosBasicosHtml": {
      "canais\_disponiveis": "",
      "nome": "NOME COMPLETO DA PESSOA",
      "genero": "Masculino",
      "estado\_civil": "Casado",
      "escolaridade": "Superior",
      "cpf": "123.456.789-00",
      "idade": "45 anos",
      "nascimento": "15/03/1980",
      "signo": "Peixes",
      "situacao\_cadastral": "Regular",
      "nacionalidade": "Brasileiro",
      "n\_dependentes": "2",
      "obito": "--",
      "emancipado": "--"
    },
    "resumo": {
      "emails": "2",
      "imoveis": "1",
      "telefones": "5",
      "enderecos": "8",
      "contatos": "3",
      "veiculos": "1"
    },
    "situacaoCadastral": {
      "nome": "NOME COMPLETO DA PESSOA",
      "status": "Regular",
      "ano\_obito": "--",
      "data\_de\_insc": "15/03/1995",
      "codigo\_de\_controle": "C19A.EA19.C9EC.3644",
      "emitido\_as": "02/08/2025 00:00"
    },
    "topContatos": {
      "email": "exemplo@email.com",
      "endereco": "Rua das Flores, 123",
      "rankEndereco": "01234-567, São Paulo",
      "celular": "(11) 99999-9999",
      "rankCelular": "Rank: 20251001",
      "telefoneFixo": "(11) 3456-7890"
    },
    "pessoasRelevantes": \[
      {
        "nome": "NOME DO PARENTE",
        "vinculo": "Mãe",
        "status": \["PPE", "VIP"\],
        "cpf": "--"
      }
    \],
    "scoreCredito": {
      "d00": "750",
      "d60": "820",
      "d30": "820"
    },
    "resumoProcessos": {
      "total": "0",
      "autor": "0",
      "reu": "0",
      "outros": "0"
    },
    "renda": {
      "individual": "R$ 3.500,00",
      "empresarial": "R$ --",
      "familiar": "R$ 5.200,00",
      "aposentadoria": "R$ --",
      "presumida": "R$ 3.500,00",
      "classe\_pessoal": {
        "letra": "C",
        "descricao": "R$ 2.500,00 a 5.000,00"
      },
      "classe\_familiar": {
        "letra": "C",
        "descricao": "Média de 5,0 a 10,0 salários mínimos"
      }
    },
    "enderecos": \[
      {
        "logradouro": "Rua das Flores, 123 - Apt 45",
        "logradouroTitle": "Rua das Flores, 123 - Apt 45",
        "telefone": "Rua das Flores, 123 - Apt 45",
        "cidade": "São Paulo",
        "cep": "SP - SAO PAULO",
        "dataInclusao": "01234-567",
        "rank": "15/03/2020",
        "principal": true,
        "addressId": "3406344999"
      }
    \],
    "telefones": \[
      {
        "numero": "(11) 99999-9999",
        "operador": "Operadora: VIVO S.A.",
        "icones": \["Vinculado com o Facebook"\],
        "dataInclusao": "01/01/2015",
        "rank": "20251001",
        "principal": true,
        "tipo": "celular"
      },
      {
        "numero": "(11) 3456-7890",
        "operador": "Operadora: EMBRATEL",
        "icones": \[\],
        "dataInclusao": "28/08/2010",
        "rank": "20251001",
        "principal": false,
        "tipo": "fixo"
      }
    \],
    "emails": \[
      {
        "email": "exemplo@email.com",
        "icones": \["Validado no provedor"\],
        "dataInclusao": "05/03/2022",
        "rank": "20240401"
      }
    \],
    "empresas": \[
      {
        "nome": "EMPRESA EXEMPLO LTDA",
        "cnpj": "12.345.678/0001-90",
        "socios": "2",
        "entrada": "10/07/2021",
        "participacao": "INDIRETO",
        "role": "EMPRESARIO INDIVIDUAL"
      }
    \],
    "empresasRelacionadas": \[\],
    "localVotacao": {
      "zona": "123",
      "sessao": "456",
      "emissor": "TRE-SP",
      "rank": "20230301",
      "endereco": "Rua Exemplo, 100, São Paulo - SP"
    },
    "ultimasConsultas": \[
      {
        "area": "ATIVIDADES DE COBRANCA",
        "quantidade": "1x",
        "rank": "20260201"
      }
    \],
    "cobranca": \[
      {
        "empresa": "Empresa A",
        "qtdAtual": "1",
        "qtdHistorica": "1",
        "criadoEm": "02/01/2023",
        "rank": "20230101"
      }
    \],
    "dadosProfissionais": \[\],
    "assistencias": \[\],
    "veiculos": \[\],
    "restituiIRPF": \[\],
    "imoveis": \[\],
    "cargosPublicos": \[\],
    "doacoesPartidarias": \[\]
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Blocos como veiculos, imoveis e doacoesPartidarias vêm como array vazio quando não há registro — não são omitidos.
- O campo "rank" nos contatos é uma data no formato AAAAMMDD: quanto maior, mais recente a informação.


### CPF DETRAN

\`GET https://api.athenasbuscas.com/api/ext/v1/cpf-detran/:cpf\`

Consulta a base nacional de condutores no DETRAN via SERPRO. Retorna número de registro, categoria, validade, situação da CNH, restrições médicas, cursos, processos de identificação (PID) e habilitação estrangeira.

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* DETRAN Nacional / SERPRO
- \*\*Latência típica:\*\* 2–10 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Validação de motorista em frota, app de mobilidade ou logística
- Conferência de categoria e validade antes de liberar veículo
- Checagem de restrições médicas e impedimentos

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/cpf-detran/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/cpf-detran/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/cpf-detran/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`dadosPessoais\` | object | Nome, nascimento, filiação, naturalidade e data de cadastramento no DETRAN. |
| \`documento\` | object | Documento de identificação usado no cadastro (tipo, número, órgão, UF). |
| \`endereco\` | object | Endereço declarado ao DETRAN. |
| \`cnh\` | object | Registro, categorias, validade, situação, restrições médicas e quadro de observações. |
| \`cnh.impedimentos\` | object | Quantidade e lista de ocorrências de impedimento. |
| \`cursos\[\]\` | array | Cursos especializados (transporte escolar, coletivo, cargas perigosas...). |
| \`habilitacaoEstrangeira\` | object\\|null | Preenchido apenas para CNH estrangeira revalidada. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "dadosPessoais": {
    "nome": "JOAO DA SILVA SANTOS",
    "cpf": "123.456.789-00",
    "dataNascimento": "15/03/1980",
    "sexo": "MASCULINO",
    "nomeMae": "NOME DA MAE",
    "nomePai": "NOME DO PAI",
    "localidadeNascimento": "SAO PAULO",
    "nacionalidade": "BRASILEIRA",
    "dataCadastramento": "10/02/1998",
    "permissionario": "NÃO PERMISSIONÁRIO",
    "numeroPgu": null
  },
  "documento": {
    "tipo": "CARTEIRA DE IDENTIDADE",
    "numero": "123456789",
    "orgaoExpedidor": "SSP",
    "uf": "SP"
  },
  "endereco": {
    "logradouro": "RUA DAS FLORES",
    "numero": "123",
    "complemento": "APT 45",
    "bairro": "JARDIM PAULISTA",
    "cep": "01234-567",
    "municipio": "SAO PAULO",
    "uf": "SP"
  },
  "cnh": {
    "possuiCnh": true,
    "ufDominio": "SP",
    "numeroRegistro": "01234567890",
    "numeroFormularioRenach": "SP123456789",
    "numeroFormularioCnh": "123456789",
    "categoriaAtual": "AB",
    "categoriaRebaixada": null,
    "categoriaAutorizada": "AB",
    "dataValidade": "15/03/2029",
    "ufHabilitacaoAtual": "SP",
    "dataPrimeiraHabilitacao": "20/05/1999",
    "ufPrimeiraHabilitacao": "SP",
    "situacao": "ATIVA",
    "situacaoAnterior": null,
    "ufSolicitanteTransferencia": null,
    "quadroObservacoes": "EXERCE ATIVIDADE REMUNERADA",
    "cancelamento": null,
    "restricoesMedicas": "LENTES CORRETIVAS",
    "numeroListaImpedimento": null,
    "motivosRequerimento": \[
      { "codigo": "05", "descricao": "RENOVACAO" }
    \],
    "historico": {
      "dataUltimaEmissao": "10/04/2024",
      "codigoTransacao": "0154",
      "dataUltimaAtualizacao": "10/04/2024"
    },
    "impedimentos": {
      "quantidade": 0,
      "ocorrencias": \[\]
    }
  },
  "cursos": \[\],
  "pid": null,
  "habilitacaoEstrangeira": null,
  "servicoConsultado": "CONDUTOR",
  "consulta": {
    "timestamp": "2026-08-06T12:30:07.455Z",
    "tempoRespostaMs": 1240,
    "fonte": "DETRAN NACIONAL"
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Token SERPRO inválido ou expirado (falha do fornecedor, não da sua chave). |
| \`503\` | Token "radar-serpro" não configurado na plataforma. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Requer o token "radar-serpro" configurado na plataforma; sem ele o módulo responde 503.
- possuiCnh: false significa que o CPF existe na base mas nunca foi habilitado.


### SPTrans (Bilhete Único)

\`GET https://api.athenasbuscas.com/api/ext/v1/sptrans/:cpf\`

Base cadastral do transporte público de São Paulo. Devolve o registro civil como declarado no cadastro do Bilhete Único (nome, RG com órgão emissor, nascimento, estado civil, filiação paterna, naturalidade), o endereço residencial completo, telefones e emails, e a situação do cartão (status, tipo de usuário, via atual, data de cadastro).

- \*\*Grupo:\*\* CPF
- \*\*Fonte:\*\* SPTrans — cadastro do Bilhete Único
- \*\*Latência típica:\*\* &lt; 1 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Localizar endereço e telefone atuais de residentes na Grande São Paulo
- Confirmar identidade com uma segunda fonte independente da Receita
- Enriquecer cadastro com email e celular verificados

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/sptrans/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/sptrans/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/sptrans/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`cadastro\` | object | Cadastro principal (sempre presente quando há resultado). |
| \`cadastro.nome / nomeSocial / cpf / tipoCpf\` | string | Identificação. tipoCpf: T (titular), R (responsável) ou D (dependente), com descrição. |
| \`cadastro.rg / rgUf / rgOrgaoEmissor / rgDataEmissao\` | string | RG com dígito, UF, órgão emissor e data de emissão. |
| \`cadastro.dataNascimento / idade / sexo / estadoCivil / nomePai / responsavel\` | string | Dados civis. \`responsavel\` aparece em cadastros de menores e dependentes. |
| \`cadastro.endereco\` | object | Logradouro, número, apartamento, bloco, bairro, cidade, UF, CEP e o campo \`completo\` já montado. |
| \`cadastro.telefones\[\]\` | array | Residencial, celulares e comercial — cada um com número cru e formatado. |
| \`cadastro.emails\[\]\` | array | Email principal e alternativo, em minúsculas. |
| \`cadastro.cartao\` | object | statusDescricao, tipoUsuarioDescricao, viaAtual, dataCadastro e flags do cadastro. |
| \`total / cadastros\[\]\` | number\\|array | Quantidade de cadastros do CPF. \`cadastros\[\]\` só vem quando total &gt; 1. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-08-06T12:30:07.455Z",
  "cpf": "12345678900",
  "total": 1,
  "cadastro": {
    "userId": 86859,
    "matricula": "1012040483019",
    "nome": "NOME COMPLETO DA PESSOA",
    "nomeSocial": null,
    "cpf": "12345678900",
    "cpfFormatado": "123.456.789-00",
    "tipoCpf": "T",
    "tipoCpfDescricao": "Titular",
    "rg": "33033653-8",
    "rgNumero": "33033653",
    "rgDigito": "8",
    "rgUf": "SP",
    "rgOrgaoEmissor": "SSP",
    "rgDataEmissao": "2000-01-21",
    "sexo": "F",
    "sexoDescricao": "Feminino",
    "dataNascimento": "1982-02-26",
    "idade": 44,
    "estadoCivil": "Casado(a)",
    "nomePai": "NOME DO PAI",
    "responsavel": "NOME DO RESPONSÁVEL",
    "pisPasep": null,
    "naturalidade": {
      "cidade": "SÃO PAULO",
      "uf": "SP"
    },
    "endereco": {
      "logradouro": "RUA EXEMPLO",
      "numero": "2895",
      "apartamento": "93",
      "bloco": "A",
      "complemento": "Ap. 93 — Bloco A",
      "bairro": "JARDIM EXEMPLO",
      "cidade": "SÃO PAULO",
      "uf": "SP",
      "cep": "04166-003",
      "completo": "RUA EXEMPLO, 2895 — Ap. 93 — Bloco A — JARDIM EXEMPLO — SÃO PAULO - SP",
      "situacao": 1
    },
    "telefones": \[
      { "tipo": "Residencial", "numero": "1125397898", "formatado": "(11) 2539-7898" },
      { "tipo": "Celular", "numero": "11984947898", "formatado": "(11) 98494-7898" }
    \],
    "emails": \["exemplo@gmail.com"\],
    "email": "exemplo@gmail.com",
    "cartao": {
      "status": 1,
      "statusDescricao": "Ativo",
      "tipoUsuario": 1,
      "tipoUsuarioDescricao": "Comum",
      "viaAtual": 17160,
      "layoutCartao": "2",
      "tipoExpedicao": "1",
      "localExpedicao": "1095",
      "dataCadastro": "2003-11-17",
      "gestaoCadastral": true,
      "recebeBoletim": true,
      "penalizacaoAgendamento": false,
      "dataLimitePenalizacao": null
    },
    "fotoArquivo": "86859.jpg",
    "observacoes": null
  },
  "\_meta": {
    "fonte": "SPTrans — Bilhete Único",
    "indice": "sptrans\_db",
    "tempoRespostaMs": 37
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Índice do SPTrans indisponível no cluster de busca. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Cobertura concentrada na Grande São Paulo — quem nunca teve Bilhete Único não existe nesta base.
- O CEP é devolvido normalizado (a origem grava sem o zero à esquerda: "4166003" = 04166-003).
- \`fotoArquivo\` traz apenas o nome do arquivo da foto no sistema da SPTrans; a imagem não é distribuída pela API.


## Contato

Descoberta reversa a partir de email ou telefone.

### Email

\`GET https://api.athenasbuscas.com/api/ext/v1/email/:email\`

Três fontes em uma chamada: a base cadastral (SRS), que devolve o titular do email com CPF, telefones e endereços; o Google Hunt, que revela o rastro público da conta Google — foto de perfil, GaiaID, serviços ativos, reviews no Maps e calendário público; e o cadastro do Bilhete Único / SPTrans, que cruza o email com o registro civil e o endereço residencial declarados à SPTrans.

- \*\*Grupo:\*\* Contato
- \*\*Fonte:\*\* SRS Database + Google Hunt + SPTrans
- \*\*Latência típica:\*\* 2–8 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Antifraude: confirmar que o email pertence mesmo ao titular declarado
- OSINT e investigação a partir de um email isolado
- Enriquecimento de lead capturado só com email

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`email\` | path | string | sim | Endereço completo. Use encodeURIComponent se houver "+" ou caracteres especiais. | \`exemplo@gmail.com\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/email/exemplo%40gmail.com" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/email/exemplo%40gmail.com', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/email/exemplo%40gmail.com',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`source\[\]\` | array | Fontes que responderam: "srs\_database", "google\_hunt" e/ou "sptrans". |
| \`srs\_database.email\_info\` | object | Score, status de confirmação, domínio público e blacklist. |
| \`srs\_database.pessoa\` | object | Titular: CPF, nome, nascimento, idade e filiação. |
| \`srs\_database.telefones\[\] / enderecos\[\]\` | array | Contatos e endereços vinculados ao titular. |
| \`google\_hunt.googleAccount\` | object | Foto, data da última edição do perfil, GaiaID e tipo de conta. |
| \`google\_hunt.maps\` | object | Página pública de contribuições e contadores de reviews/fotos. |
| \`google\_hunt.calendar / playGames\` | object | Presença em calendário público e perfil de jogos. |
| \`sptrans\` | object | { total, cadastros\[\] } do Bilhete Único quando o email consta no cadastro da SPTrans; null caso contrário. Cada item tem a mesma estrutura do módulo SPTrans. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "total\_registros": 1,
  "source": \["srs\_database", "google\_hunt", "sptrans"\],
  "email\_consultado": "exemplo@gmail.com",
  "srs\_database": {
    "email\_consultado": "exemplo@gmail.com",
    "email\_info": {
      "email": "exemplo@gmail.com",
      "score": "OTIMO",
      "status": "CONFIRMADO",
      "dominio\_publico": true,
      "blacklist": false,
      "data\_inclusao": "12/07/2017"
    },
    "pessoa": {
      "cpf": "123.456.789-00",
      "nome": "NOME COMPLETO DA PESSOA",
      "sexo": "Masculino",
      "data\_nascimento": "15/03/1990",
      "idade": 34,
      "nome\_mae": "NOME DA MÃE",
      "nome\_pai": "Não informado",
      "pis": "123456789"
    },
    "parentes": \[
      {
        "vinculo": "Mãe",
        "nome": "NOME DO PARENTE",
        "cpf": "987.654.321-00"
      }
    \],
    "telefones": \[
      {
        "numero": "(11) 98765-4321",
        "tipo": "Celular",
        "classificacao": "A0",
        "data\_inclusao": "06/04/2018"
      },
      {
        "numero": "(11) 3456-7890",
        "tipo": "Fixo",
        "classificacao": "D",
        "data\_inclusao": "05/12/2012"
      }
    \],
    "enderecos": \[
      {
        "logradouro": "Rua das Flores",
        "complemento": "Apt 45",
        "bairro": "Jardim Paulista",
        "cidade": "São Paulo",
        "uf": "SP",
        "cep": "01234-567",
        "tipo": "Principal",
        "data\_inclusao": "15/03/2015"
      }
    \],
    "score": {
      "csb8": "838",
      "faixa\_csb8": "BAIXISSIMO RISCO",
      "csba": "242",
      "faixa\_csba": "ALTO"
    }
  },
  "google\_hunt": {
    "googleAccount": {
      "profilePicture": "https://lh3.googleusercontent.com/...",
      "coverPicture": null,
      "lastProfileEdit": "2026-04-15 09:44:32 UTC",
      "email": "exemplo@gmail.com",
      "gaiaId": "104469904733477854284",
      "containers": \["PROFILE"\],
      "userTypes": \[
        {
          "type": "GOOGLE\_USER",
          "description": "The user is a Google user."
        }
      \]
    },
    "googleChat": {
      "entityType": "PERSON",
      "customerId": null
    },
    "googlePlus": {
      "isEnterpriseUser": false,
      "activatedServices": \["Photos", "Maps"\]
    },
    "playGames": {
      "found": false,
      "error": "No player profile found."
    },
    "maps": {
      "profilePage": "https://www.google.com/maps/contrib/104469904733477854214/reviews",
      "err": "",
      "stats": {
        "Reviews": 2,
        "Ratings": 1,
        "Photos": 0
      }
    },
    "calendar": {
      "found": false
    }
  },
  "sptrans": {
    "total": 1,
    "cadastros": \[
      {
        "userId": 86859,
        "matricula": "1012040483019",
        "nome": "NOME COMPLETO DA PESSOA",
        "cpf": "12345678900",
        "cpfFormatado": "123.456.789-00",
        "tipoCpfDescricao": "Titular",
        "rg": "33033653-8",
        "rgUf": "SP",
        "rgOrgaoEmissor": "SSP",
        "dataNascimento": "1982-02-26",
        "idade": 44,
        "sexoDescricao": "Feminino",
        "estadoCivil": "Casado(a)",
        "nomePai": "NOME DO PAI",
        "endereco": {
          "completo": "RUA EXEMPLO, 2895 — Ap. 93 — JARDIM EXEMPLO — SÃO PAULO - SP",
          "cep": "04166-003",
          "cidade": "SÃO PAULO",
          "uf": "SP"
        },
        "telefones": \[
          { "tipo": "Celular", "numero": "11984947898", "formatado": "(11) 98494-7898" }
        \],
        "emails": \["exemplo@gmail.com"\],
        "cartao": {
          "statusDescricao": "Ativo",
          "tipoUsuarioDescricao": "Comum",
          "dataCadastro": "2003-11-17"
        }
      }
    \]
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- google\_hunt só existe para contas Google; para outros provedores o bloco vem com found: false.
- A ausência de srs\_database não impede a resposta — verifique o array "source" antes de ler cada bloco.
- O bloco sptrans casa o email de forma exata (principal ou alternativo) e é case-insensitive.


### Telefone

\`GET https://api.athenasbuscas.com/api/ext/v1/phone/:phone\`

A partir de DDD + número, devolve todos os cadastros em que aquele telefone aparece — com nome, CPF, nascimento, filiação, endereços, emails e os demais telefones da pessoa. Um número passa de dono ao longo dos anos, então a resposta é uma lista: cada registro traz a base de origem em \`fonte\`.

- \*\*Grupo:\*\* Contato
- \*\*Fonte:\*\* Bases internas: cadastral (SRS), Credilink (2023), varejo e SPTrans
- \*\*Latência típica:\*\* &lt; 1 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Identificar quem está ligando (call center receptivo)
- Localizar titular a partir de um número em cobrança
- Validar telefone informado no cadastro

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`phone\` | path | string | sim | Apenas dígitos: DDD + número (10 para fixo, 11 para celular). Não inclua +55. | \`11999998888\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/phone/11999998888" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/phone/11999998888', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/phone/11999998888',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`total / totalPessoas / cpfs\[\]\` | number\\|array | Quantidade de registros, de pessoas distintas e a lista de CPFs alcançados pelo número. |
| \`registros\[\].fonte\` | string | Base de origem: srs\_contatos, credilink\_dados, leitura\_db ou sptrans\_db. |
| \`registros\[\].nome / cpf / nasc / idade / sexo / filiacao\` | object | Identificação do titular daquele cadastro. |
| \`registros\[\].telefones\[\]\` | array | Todos os números do cadastro; \`consultado: true\` marca o número pesquisado. |
| \`registros\[\].emails\[\] / enderecos\[\] / parentes\[\]\` | array | Contatos e vínculos do cadastro. |
| \`registros\[\].renda / veiculos\[\] / situacaoReceita\` | object | Só na safra Credilink: renda presumida, faixa, veículos e situação na Receita. |
| \`registros\[\].consultaCpf\` | object\\|null | Atalho para o dossiê: { modulo: "cpf-completo", cpf }. Use o módulo CPF Completo para ver os dados do indivíduo. |
| \`\_meta\` | object | Bases consultadas, bases indisponíveis e as variações de número testadas (com e sem o nono dígito). |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-08-07T12:30:07.455Z",
  "telefone": "11999998888",
  "telefoneFormatado": "(11) 99999-8888",
  "total": 2,
  "totalPessoas": 2,
  "cpfs": \["12345678900", "98765432100"\],
  "registros": \[
    {
      "fonte": "srs\_contatos",
      "fonteDescricao": "Base cadastral (SRS)",
      "contatosId": "297806971",
      "nome": "NOME COMPLETO DA PESSOA",
      "cpf": "12345678900",
      "cpfFormatado": "123.456.789-00",
      "nasc": "15/03/1979",
      "dataNascimento": "1979-03-15",
      "idade": 47,
      "sexo": "Masculino",
      "filiacao": { "nomeMae": "NOME DA MÃE", "nomePai": null },
      "registroGeral": { "rgNumero": "10307268", "orgaoEmissor": null, "ufEmissao": null, "dataEmissao": null },
      "tituloEleitor": "046541260183",
      "obito": { "falecido": false, "data": null },
      "telefones": \[
        {
          "numero": "11999998888",
          "formatado": "(11) 99999-8888",
          "tipo": "Celular",
          "classificacao": "D2",
          "dataInclusao": "22/11/2006",
          "consultado": true
        }
      \],
      "emails": \[
        { "email": "exemplo@email.com", "score": "OTIMO", "pessoal": true, "dataInclusao": "12/07/2017" }
      \],
      "enderecos": \[
        {
          "logradouro": "RUA DAS FLORES",
          "numero": "123",
          "bairro": "CENTRO",
          "cidade": "SAO PAULO",
          "uf": "SP",
          "cep": "01001-000",
          "completo": "RUA DAS FLORES, 123 — CENTRO — SAO PAULO - SP"
        }
      \],
      "parentes": \[
        { "nome": "NOME DO PARENTE", "cpf": "98765432100", "cpfFormatado": "987.654.321-00", "vinculo": "MAE" }
      \],
      "consultaCpf": { "modulo": "cpf-completo", "cpf": "12345678900" }
    },
    {
      "fonte": "credilink\_dados",
      "fonteDescricao": "Credilink",
      "referencia": "Safra 2023",
      "nome": "OUTRO TITULAR DO MESMO NUMERO",
      "cpf": "98765432100",
      "cpfFormatado": "987.654.321-00",
      "nasc": "24/01/1980",
      "idade": 46,
      "sexo": "Masculino",
      "filiacao": { "nomeMae": "NOME DA MÃE", "nomePai": null },
      "telefones": \[
        { "numero": "11999998888", "formatado": "(11) 99999-8888", "tipo": "Celular", "campo": "CELULAR1", "consultado": true }
      \],
      "emails": \[{ "email": "outro@email.com" }\],
      "enderecos": \[
        { "logradouro": "RUA SAO PAULO", "bairro": "VILA SANTANA", "cidade": "VALINHOS", "uf": "SP", "cep": "13274-115", "completo": "RUA SAO PAULO — VILA SANTANA — VALINHOS - SP" }
      \],
      "obito": { "falecido": false, "data": null },
      "situacaoReceita": "REGULAR",
      "ocupacaoCbo": "848315",
      "renda": { "presumida": 3250, "faixa": "4" },
      "veiculos": \[{ "marca": null, "modelo": "CHEVROLET/CELTA 1.0L LT", "ano": "2011" }\],
      "consultaCpf": { "modulo": "cpf-completo", "cpf": "98765432100" }
    }
  \],
  "\_meta": {
    "fontes": \["srs\_contatos", "credilink\_dados"\],
    "fontesIndisponiveis": \[\],
    "numerosTestados": \["11999998888", "1199998888"\],
    "semDdd": false,
    "tempoRespostaMs": 312
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Envie somente dígitos: "(11) 99999-8888" e "+5511999998888" são rejeitados com 400.
- A busca testa o número com e sem o nono dígito — celulares antigos casam mesmo gravados em 8 dígitos.
- Os dados do Credilink são da safra de 2023 e vêm marcados em \`referencia\`.
- Este módulo não monta o dossiê do titular: com o CPF em mãos, chame /cpf-completo.


## Nome

Busca de pessoas por nome completo ou abreviado, com paginação.

### Nome Abreviado

\`GET https://api.athenasbuscas.com/api/ext/v1/name-abbreviated?query=\`

Feito para o caso em que você só tem "J. Silva" ou "Maria S. Santos". Faz busca aproximada no índice de nomes e devolve candidatos com CPF, nascimento, UF, endereço e nome da mãe — o suficiente para desambiguar.

- \*\*Grupo:\*\* Nome
- \*\*Fonte:\*\* Índice consolidado de pessoas
- \*\*Latência típica:\*\* &lt; 3 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Recuperar CPF a partir de nome incompleto em documento antigo
- Desambiguar homônimos usando nome da mãe e UF
- Pré-processamento de listas com nomes truncados

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`query\` | query | string | sim | Nome parcial ou abreviado. Deve ser URL-encoded. | \`J. Silva\` |
| \`page\` | query | integer | não | Página da listagem (padrão 1). Cada página consome 1 crédito. | \`1\` |
| \`limit\` | query | integer | não | Registros por página (padrão 10, máximo 50). | \`10\` |
| \`sexo\` | query | string | não | Filtro de sexo: M ou F. | \`M\` |
| \`uf\` | query | string | não | Filtro de UF (2 letras). | \`SP\` |
| \`cidade\` | query | string | não | Filtro de cidade. | \`São Paulo\` |
| \`cep\` | query | string | não | Filtro de CEP (mínimo 5 dígitos). | \`01310\` |
| \`flag\_obito\` | query | string | não | 1 = só óbitos, 0 = só vivos. | \`0\` |
| \`faixa\_renda\` | query | string | não | Faixa de renda estimada (1 a 5). | \`3\` |
| \`nascimento\_exact\` | query | string | não | Data de nascimento exata (YYYY-MM-DD ou DD/MM/YYYY). | \`1980-03-15\` |
| \`year\_from\` | query | integer | não | Ano de nascimento mínimo. Ignorado se nascimento\_exact estiver presente. | \`1970\` |
| \`year\_to\` | query | integer | não | Ano de nascimento máximo. | \`1990\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/name-abbreviated?query=J.%20Silva&amp;page=1&amp;limit=10" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/name-abbreviated?query=J.%20Silva&amp;page=1&amp;limit=10', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/name-abbreviated?query=J.%20Silva&amp;page=1&amp;limit=10',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`total\_hits\` | number | Total de registros que casaram com a busca. |
| \`current\_page / total\_pages / limit\` | number | Paginação. Avance com ?page=2, ?page=3… (padrão 10 por página, máximo 50 via limit). |
| \`results\[\].cpf\` | string | CPF formatado do candidato. |
| \`results\[\].nome\_completo\` | string | Nome completo cadastrado. |
| \`results\[\].nome\_mae\` | string | Nome da mãe — melhor critério de desambiguação. |
| \`results\[\].uf / cidade / bairro / logradouro\` | string | Localização do registro. |
| \`results\[\].flag\_obito\` | string | "1" quando há registro de óbito. |
| \`results\[\].faixa\_renda\` | string | Faixa de renda estimada (1 a 5). |

#### Exemplo de resposta (200)

\`\`\`json
{
  "total\_hits": 7753830,
  "current\_page": 1,
  "total\_pages": 775383,
  "limit": 10,
  "filters\_applied": 0,
  "results": \[
    {
      "cpf": "123.456.789-00",
      "nome\_completo": "JOAO SILVA SANTOS",
      "data\_nascimento": "15/03/1980",
      "sexo": "M",
      "uf": "SP",
      "estado": "SAO PAULO",
      "cidade": "SAO PAULO",
      "cep": "01234567",
      "bairro": "JARDIM PAULISTA",
      "logradouro": "RUA DAS FLORES",
      "numero": "123",
      "nome\_mae": "NOME DA MAE",
      "flag\_obito": "0",
      "faixa\_renda": "3"
    },
    {
      "cpf": "987.654.321-00",
      "nome\_completo": "JOANA SILVA SANTOS",
      "data\_nascimento": "20/05/1985",
      "sexo": "F",
      "uf": "RJ",
      "estado": "RIO DE JANEIRO",
      "cidade": "RIO DE JANEIRO",
      "cep": "20000000",
      "bairro": "CENTRO",
      "logradouro": "AVENIDA PRINCIPAL",
      "numero": "456",
      "nome\_mae": "OUTRO NOME",
      "flag\_obito": "0",
      "faixa\_renda": "2"
    }
  \]
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Nomes muito comuns devolvem milhões de hits — filtre por uf, cidade, sexo ou nascimento antes de paginar.
- A cobrança é por chamada, não por resultado: cada ?page= custa 1 crédito.
- Exemplo: GET /name-abbreviated?query=J.%20Silva&amp;page=2&amp;limit=20&amp;uf=SP


### Nome Completo

\`GET https://api.athenasbuscas.com/api/ext/v1/name?query=\`

Mesma estrutura da busca abreviada, porém otimizada para nome completo exato ou quase exato. Devolve a lista de pessoas com CPF, nascimento, sexo, endereço, nome da mãe e indicador de óbito.

- \*\*Grupo:\*\* Nome
- \*\*Fonte:\*\* Índice consolidado de pessoas
- \*\*Latência típica:\*\* &lt; 3 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Descobrir o CPF a partir do nome completo informado pelo cliente
- Conferir se um nome existe na base antes de abrir cadastro
- Cruzar listas de nomes com a base de pessoas

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`query\` | query | string | sim | Nome completo. Deve ser URL-encoded. | \`João da Silva\` |
| \`page\` | query | integer | não | Página da listagem (padrão 1). Cada página consome 1 crédito. | \`1\` |
| \`limit\` | query | integer | não | Registros por página (padrão 10, máximo 50). | \`10\` |
| \`sexo\` | query | string | não | Filtro de sexo: M ou F. | \`M\` |
| \`uf\` | query | string | não | Filtro de UF (2 letras). | \`SP\` |
| \`cidade\` | query | string | não | Filtro de cidade. | \`São Paulo\` |
| \`cep\` | query | string | não | Filtro de CEP (mínimo 5 dígitos). | \`01310\` |
| \`flag\_obito\` | query | string | não | 1 = só óbitos, 0 = só vivos. | \`0\` |
| \`faixa\_renda\` | query | string | não | Faixa de renda estimada (1 a 5). | \`3\` |
| \`nascimento\_exact\` | query | string | não | Data de nascimento exata (YYYY-MM-DD ou DD/MM/YYYY). | \`1980-03-15\` |
| \`year\_from\` | query | integer | não | Ano de nascimento mínimo. Ignorado se nascimento\_exact estiver presente. | \`1970\` |
| \`year\_to\` | query | integer | não | Ano de nascimento máximo. | \`1990\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/name?query=Jo%C3%A3o%20da%20Silva&amp;page=1&amp;limit=10" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/name?query=Jo%C3%A3o%20da%20Silva&amp;page=1&amp;limit=10', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/name?query=Jo%C3%A3o%20da%20Silva&amp;page=1&amp;limit=10',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`total\_hits\` | number | Total de registros correspondentes. |
| \`current\_page / total\_pages / limit\` | number | Paginação. Avance com ?page=2, ?page=3… (padrão 10 por página, máximo 50 via limit). |
| \`results\[\].cpf / nome\_completo\` | string | Identificação do candidato. |
| \`results\[\].data\_nascimento / sexo\` | string | Dados para desambiguação. |
| \`results\[\].nome\_mae\` | string | Nome da mãe. |
| \`results\[\].uf / estado / cidade / cep\` | string | Endereço do registro. |
| \`results\[\].flag\_obito\` | string | "1" quando há registro de óbito. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "total\_hits": 698040,
  "current\_page": 1,
  "total\_pages": 69804,
  "limit": 10,
  "filters\_applied": 0,
  "results": \[
    {
      "cpf": "123.456.789-00",
      "nome\_completo": "JOAO DA SILVA SANTOS",
      "data\_nascimento": "21/03/1980",
      "sexo": "M",
      "uf": "SP",
      "estado": "SAO PAULO",
      "cidade": "SAO PAULO",
      "cep": "01234567",
      "bairro": "JARDIM PAULISTA",
      "logradouro": "RUA DAS FLORES",
      "numero": "123",
      "nome\_mae": "NOME DA MAE",
      "flag\_obito": "0",
      "faixa\_renda": "3"
    },
    {
      "cpf": "987.654.321-00",
      "nome\_completo": "JOAO DA SILVA OLIVEIRA",
      "data\_nascimento": "18/02/1965",
      "sexo": "M",
      "uf": "RJ",
      "estado": "RIO DE JANEIRO",
      "cidade": "RIO DE JANEIRO",
      "cep": "20000000",
      "bairro": "CENTRO",
      "logradouro": "AVENIDA PRINCIPAL",
      "numero": "456",
      "nome\_mae": "OUTRO NOME",
      "flag\_obito": "1",
      "faixa\_renda": "2"
    },
    {
      "cpf": "555.444.333-22",
      "nome\_completo": "JOAO DA SILVA COSTA",
      "data\_nascimento": "10/10/1975",
      "sexo": "M",
      "uf": "MG",
      "estado": "MINAS GERAIS",
      "cidade": "BELO HORIZONTE",
      "cep": "30100000",
      "bairro": "FUNCIONARIOS",
      "logradouro": "AVENIDA GETULO VARGAS",
      "numero": "789",
      "nome\_mae": "TERCEIRO NOME",
      "flag\_obito": "0",
      "faixa\_renda": "4"
    }
  \]
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Acentuação é normalizada: "João" e "Joao" retornam o mesmo conjunto.
- Para nome incompleto use o módulo Nome Abreviado, que aplica busca aproximada.
- A cobrança é por chamada: cada ?page= custa 1 crédito.
- Exemplo: GET /name?query=João%20da%20Silva&amp;page=2&amp;limit=20&amp;uf=SP


## Localização

Quem mora (ou morou) em um endereço.

### Endereço

\`GET https://api.athenasbuscas.com/api/ext/v1/address?query=\`

Busca textual livre sobre a base de endereços: aceita logradouro, número, bairro, cidade e UF em qualquer combinação. Devolve os moradores com CPF, nome, nascimento, nome da mãe e um score de aderência ao texto consultado.

- \*\*Grupo:\*\* Localização
- \*\*Fonte:\*\* Índice consolidado de endereços
- \*\*Latência típica:\*\* &lt; 3 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Verificar ocupantes de um imóvel antes de locação
- Localizar devedor por endereço conhecido
- Investigação de vizinhança e confirmação de residência

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`query\` | query | string | sim | Endereço completo ou parcial, URL-encoded. | \`Rua das Flores 123 São Paulo SP\` |
| \`page\` | query | integer | não | Página da listagem (padrão 1). Cada página consome 1 crédito. | \`1\` |
| \`limit\` | query | integer | não | Registros por página (padrão 10, máximo 50). | \`10\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/address?query=Rua%20das%20Flores%20123%20S%C3%A3o%20Paulo%20SP&amp;page=1&amp;limit=10" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/address?query=Rua%20das%20Flores%20123%20S%C3%A3o%20Paulo%20SP&amp;page=1&amp;limit=10', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/address?query=Rua%20das%20Flores%20123%20S%C3%A3o%20Paulo%20SP&amp;page=1&amp;limit=10',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`results\[\].cpf / nome\` | string | Morador identificado. |
| \`results\[\].logradouro / numero / complemento\` | string | Endereço registrado. |
| \`results\[\].bairro / cidade / uf / cep\` | string | Localização. |
| \`results\[\].score\` | number | Aderência ao texto buscado — ordene por ele. |
| \`total\_hits / current\_page / total\_pages\` | number | Paginação (10 por página). |
| \`query\_used\` | string | Estratégia aplicada ("freetext" ou estruturada). |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "results": \[
    {
      "cpf": "123.456.789-00",
      "nome": "NOME COMPLETO DA PESSOA",
      "sexo": "M",
      "data\_nascimento": "15/03/1980",
      "nome\_mae": "NOME DA MAE",
      "logradouro": "RUA DAS FLORES",
      "numero": "123",
      "complemento": "CASA",
      "bairro": "JARDIM PAULISTA",
      "cidade": "SAO PAULO",
      "uf": "SP",
      "cep": "01234567",
      "tipo\_endereco": "RUA",
      "score": 135.41339
    },
    {
      "cpf": "987.654.321-00",
      "nome": "OUTRO NOME",
      "sexo": "F",
      "data\_nascimento": "20/05/1985",
      "nome\_mae": "NOME OUTRO",
      "logradouro": "RUA DAS FLORES",
      "numero": "456",
      "complemento": "APT 10",
      "bairro": "CENTRO",
      "cidade": "RIO DE JANEIRO",
      "uf": "RJ",
      "cep": "20000000",
      "tipo\_endereco": "RUA",
      "score": 135.41339
    },
    {
      "cpf": "555.444.333-22",
      "nome": "TERCEIRA PESSOA",
      "sexo": "M",
      "data\_nascimento": "10/10/1975",
      "nome\_mae": "MAE TERCEIRA",
      "logradouro": "RUA DAS FLORES",
      "numero": "789",
      "complemento": "",
      "bairro": "FUNCIONARIOS",
      "cidade": "BELO HORIZONTE",
      "uf": "MG",
      "cep": "30100000",
      "tipo\_endereco": "RUA",
      "score": 135.41339
    }
  \],
  "total\_hits": 1121,
  "current\_page": 1,
  "total\_pages": 113,
  "limit": 10,
  "query\_used": "freetext"
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Quanto mais específico o texto (com número e CEP), maior o score e menor o ruído.
- O score não é normalizado entre consultas — só faz sentido comparar dentro do mesmo resultado.


## Veículos

Base DETRAN/SERPRO por placa, chassi ou RENAVAM.

### Placa

\`GET https://api.athenasbuscas.com/api/ext/v1/plate/:plate\`

Consulta oficial DETRAN via SERPRO. Devolve ficha técnica do veículo, proprietário com CPF/CNPJ, documentos (CRV/CRLV), restrições (furto/roubo, RENAJUD, financeira, judicial), indicadores de leilão e recall, faturamento e dados de importação.

- \*\*Grupo:\*\* Veículos
- \*\*Fonte:\*\* SERPRO / DETRAN
- \*\*Latência típica:\*\* 1–6 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Vistoria antes da compra de usado (restrição, leilão, roubo)
- Identificação de proprietário em sinistro ou infração
- Checagem de frota e regularidade do licenciamento

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`plate\` | path | string | sim | Formato antigo (ABC1234) ou Mercosul (ABC1D23), sem hífen nem espaço. | \`ABC1234\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/plate/ABC1234" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/plate/ABC1234', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/plate/ABC1234',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`situacao / ultimoLicenciamento\` | string | Situação do veículo e ano do último licenciamento pago. |
| \`veiculo\` | object | Marca, modelo, ano, cor, combustível, chassi, RENAVAM, motor e capacidade. |
| \`proprietario\` | object | Nome e documento (CPF/CNPJ) do proprietário atual. |
| \`restricoes\` | object | furtoRoubo, renajud, financeira, arrendamento, judicial, administrativa + detalhes. |
| \`indicadores\` | object | multaRenainf, comunicacaoVenda, leilao, rouboFurto, alarme, recall1..4. |
| \`documentos\` | object | Datas de emissão do CRV/CRLV e número do CRLV. |
| \`importacao / faturamento\` | object | Preenchidos apenas para veículos importados ou faturados. |
| \`Consulta\` | object | Metadados: timestamp, fonte, tempo de resposta. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "placaConsultada": "ABC1234",
  "consultedBy": "placa",
  "consultedValue": "ABC1234",
  "situacao": "EM CIRCULACAO",
  "ultimoLicenciamento": "2024",
  "fonte": "serpro",
  "veiculo": {
    "marca": "VW",
    "modelo": "GOL 1.0",
    "marcaModeloCompleto": "VW/GOL 1.0",
    "codigoMarcaModelo": "025109",
    "anoFabricacao": 2015,
    "anoModelo": 2016,
    "cor": "PRATA",
    "combustivel": "ALCOOL/GASOLINA",
    "cilindrada": "999 cc",
    "potencia": "76",
    "chassi": "9BWZZZ377VT004251",
    "renavam": "00864532067",
    "motor": "CHA123456",
    "especie": "PASSAGEIRO",
    "tipo": "AUTOMOVEL",
    "categoria": "PARTICULAR",
    "carroceria": null,
    "capacidadePassageiros": 5,
    "cmt": 0,
    "pbt": 0,
    "cmc": 0,
    "qtdEixos": 2,
    "eixoTraseiro": null,
    "eixoAuxiliar": null,
    "remarcacaoChassi": "NÃO",
    "numeroCambio": null,
    "procedencia": "NACIONAL",
    "numeroCarroceria": null
  },
  "proprietario": {
    "nome": "JOAO DA SILVA SANTOS",
    "cpf": "12345678900",
    "tipoDocumento": "CPF",
    "codigoTipo": "1"
  },
  "localizacao": {
    "municipio": "SAO PAULO",
    "codigoMunicipio": "7107",
    "uf": "SP"
  },
  "documentos": {
    "dataEmissaoCrv": "2016-03-15",
    "anoExercicioLicenciamentoPago": "2024",
    "dataEmissaoCRLV": "2024-01-20",
    "numeroCrlv": "123456789",
    "dataCrlv": "2024-01-20"
  },
  "restricoes": {
    "furtoRoubo": false,
    "renajud": false,
    "financeira": false,
    "arrendamento": false,
    "judicial": false,
    "administrativa": false,
    "outras": \[\],
    "detalhes": \[\]
  },
  "comunicacaoVenda": false,
  "indicadores": {
    "multaRenainf": false,
    "comunicacaoVenda": false,
    "pendenciaEmissao": false,
    "restricaoRenajud": false,
    "leilao": false,
    "rouboFurto": false,
    "alarme": false,
    "siniav": null,
    "recall1": null,
    "recall2": null,
    "recall3": null,
    "recall4": null,
    "rfb": null,
    "descricaoRfb": null
  },
  "faturamento": {
    "tipoDoc": null,
    "numeroId": null,
    "uf": null,
    "dataLimite": null,
    "natureza": null
  },
  "importacao": {
    "natureza": null,
    "descricaoDocImportador": null,
    "numeroIdImportador": null,
    "codigoOrgaoRfb": null,
    "descricaoOrgaoRfb": null,
    "registroAduaneiro": null,
    "numeroDeclaracaoImportacao": null,
    "dataDistImportacao": null,
    "paisTransferencia": null,
    "codigoPaisTransferencia": null,
    "dataAtualizacaoMre": null,
    "descricaoTipoImportacao": null,
    "numeroProcessoImportacao": null,
    "dataBaixaImportacao": null,
    "dataUltimaAtualizacao": null
  },
  "proprietarioIndicado": null,
  "Consulta": {
    "timestamp": "2026-06-11T12:30:07.455Z",
    "source": "serpro",
    "consultedBy": "placa",
    "tempoRespostaMs": 842,
    "isPesquisado": false
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Token "radar-serpro" não configurado na plataforma. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Placas Mercosul e antigas convivem: consulte pelo formato impresso no veículo.
- restricoes.detalhes traz o texto bruto do DETRAN quando há restrição — sempre leia antes de concluir "sem restrição".


### Chassi

\`GET https://api.athenasbuscas.com/api/ext/v1/chassi/:chassi\`

Idêntico ao módulo Placa em estrutura de resposta — muda apenas consultedBy e consultedValue. Use quando a placa é desconhecida, ilegível ou o veículo está sem emplacamento.

- \*\*Grupo:\*\* Veículos
- \*\*Fonte:\*\* SERPRO / DETRAN
- \*\*Latência típica:\*\* 1–6 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Veículo apreendido ou sinistrado sem placa legível
- Conferência de chassi remarcado
- Importação e nacionalização de veículo

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`chassi\` | path | string | sim | VIN de 17 caracteres, sem espaços. | \`9BWZZZ377VT004251\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/chassi/9BWZZZ377VT004251" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/chassi/9BWZZZ377VT004251', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/chassi/9BWZZZ377VT004251',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`consultedBy / consultedValue\` | string | "chassi" e o VIN consultado. |
| \`placaConsultada\` | string | Placa encontrada a partir do chassi. |
| \`veiculo.remarcacaoChassi\` | string | "SIM" indica chassi remarcado — atenção redobrada. |
| \`(demais blocos)\` | object | proprietario, restricoes, indicadores, documentos — iguais ao módulo Placa. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "placaConsultada": "ABC1234",
  "consultedBy": "chassi",
  "consultedValue": "9BWZZZ377VT004251",
  "situacao": "EM CIRCULACAO",
  "ultimoLicenciamento": "2024",
  "fonte": "serpro",
  "veiculo": {
    "marca": "VW",
    "modelo": "GOL 1.0",
    "marcaModeloCompleto": "VW/GOL 1.0",
    "codigoMarcaModelo": "025109",
    "anoFabricacao": 2015,
    "anoModelo": 2016,
    "cor": "PRATA",
    "combustivel": "ALCOOL/GASOLINA",
    "cilindrada": "999 cc",
    "potencia": "76",
    "chassi": "9BWZZZ377VT004251",
    "renavam": "00864532067",
    "motor": "CHA123456",
    "especie": "PASSAGEIRO",
    "tipo": "AUTOMOVEL",
    "categoria": "PARTICULAR",
    "carroceria": null,
    "capacidadePassageiros": 5,
    "cmt": 0,
    "pbt": 0,
    "cmc": 0,
    "qtdEixos": 2,
    "eixoTraseiro": null,
    "eixoAuxiliar": null,
    "remarcacaoChassi": "NÃO",
    "numeroCambio": null,
    "procedencia": "NACIONAL",
    "numeroCarroceria": null
  },
  "proprietario": {
    "nome": "JOAO DA SILVA SANTOS",
    "cpf": "12345678900",
    "tipoDocumento": "CPF",
    "codigoTipo": "1"
  },
  "localizacao": {
    "municipio": "SAO PAULO",
    "codigoMunicipio": "7107",
    "uf": "SP"
  },
  "documentos": {
    "dataEmissaoCrv": "2016-03-15",
    "anoExercicioLicenciamentoPago": "2024",
    "dataEmissaoCRLV": "2024-01-20",
    "numeroCrlv": "123456789",
    "dataCrlv": "2024-01-20"
  },
  "restricoes": {
    "furtoRoubo": false,
    "renajud": false,
    "financeira": false,
    "arrendamento": false,
    "judicial": false,
    "administrativa": false,
    "outras": \[\],
    "detalhes": \[\]
  },
  "comunicacaoVenda": false,
  "indicadores": {
    "multaRenainf": false,
    "comunicacaoVenda": false,
    "pendenciaEmissao": false,
    "restricaoRenajud": false,
    "leilao": false,
    "rouboFurto": false,
    "alarme": false,
    "siniav": null,
    "recall1": null,
    "recall2": null,
    "recall3": null,
    "recall4": null,
    "rfb": null,
    "descricaoRfb": null
  },
  "faturamento": {
    "tipoDoc": null,
    "numeroId": null,
    "uf": null,
    "dataLimite": null,
    "natureza": null
  },
  "importacao": {
    "natureza": null,
    "descricaoDocImportador": null,
    "numeroIdImportador": null,
    "codigoOrgaoRfb": null,
    "descricaoOrgaoRfb": null,
    "registroAduaneiro": null,
    "numeroDeclaracaoImportacao": null,
    "dataDistImportacao": null,
    "paisTransferencia": null,
    "codigoPaisTransferencia": null,
    "dataAtualizacaoMre": null,
    "descricaoTipoImportacao": null,
    "numeroProcessoImportacao": null,
    "dataBaixaImportacao": null,
    "dataUltimaAtualizacao": null
  },
  "proprietarioIndicado": null,
  "Consulta": {
    "timestamp": "2026-06-11T12:30:07.455Z",
    "source": "serpro",
    "consultedBy": "chassi",
    "tempoRespostaMs": 910,
    "isPesquisado": false
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Token "radar-serpro" não configurado na plataforma. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- O VIN correto tem 17 caracteres alfanuméricos e nunca usa as letras I, O e Q.


### Renavam

\`GET https://api.athenasbuscas.com/api/ext/v1/renavam/:renavam\`

Terceira porta de entrada para a base veicular, com a mesma resposta dos módulos Placa e Chassi. Útil quando você parte do documento do veículo (CRLV), onde o RENAVAM é o identificador mais legível.

- \*\*Grupo:\*\* Veículos
- \*\*Fonte:\*\* SERPRO / DETRAN
- \*\*Latência típica:\*\* 1–6 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Conferência a partir do CRLV digital
- Integração com sistemas de licenciamento e IPVA
- Validação cruzada placa × RENAVAM

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`renavam\` | path | string | sim | De 9 a 11 dígitos, apenas números (zeros à esquerda podem ser omitidos). | \`00864532067\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/renavam/00864532067" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/renavam/00864532067', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/renavam/00864532067',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`consultedBy / consultedValue\` | string | "renavam" e o número consultado. |
| \`(demais blocos)\` | object | veiculo, proprietario, restricoes, indicadores, documentos — iguais ao módulo Placa. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "placaConsultada": "ABC1234",
  "consultedBy": "renavam",
  "consultedValue": "00864532067",
  "situacao": "EM CIRCULACAO",
  "ultimoLicenciamento": "2024",
  "fonte": "serpro",
  "veiculo": {
    "marca": "VW",
    "modelo": "GOL 1.0",
    "marcaModeloCompleto": "VW/GOL 1.0",
    "codigoMarcaModelo": "025109",
    "anoFabricacao": 2015,
    "anoModelo": 2016,
    "cor": "PRATA",
    "combustivel": "ALCOOL/GASOLINA",
    "cilindrada": "999 cc",
    "potencia": "76",
    "chassi": "9BWZZZ377VT004251",
    "renavam": "00864532067",
    "motor": "CHA123456",
    "especie": "PASSAGEIRO",
    "tipo": "AUTOMOVEL",
    "categoria": "PARTICULAR",
    "carroceria": null,
    "capacidadePassageiros": 5,
    "cmt": 0,
    "pbt": 0,
    "cmc": 0,
    "qtdEixos": 2,
    "eixoTraseiro": null,
    "eixoAuxiliar": null,
    "remarcacaoChassi": "NÃO",
    "numeroCambio": null,
    "procedencia": "NACIONAL",
    "numeroCarroceria": null
  },
  "proprietario": {
    "nome": "JOAO DA SILVA SANTOS",
    "cpf": "12345678900",
    "tipoDocumento": "CPF",
    "codigoTipo": "1"
  },
  "localizacao": {
    "municipio": "SAO PAULO",
    "codigoMunicipio": "7107",
    "uf": "SP"
  },
  "documentos": {
    "dataEmissaoCrv": "2016-03-15",
    "anoExercicioLicenciamentoPago": "2024",
    "dataEmissaoCRLV": "2024-01-20",
    "numeroCrlv": "123456789",
    "dataCrlv": "2024-01-20"
  },
  "restricoes": {
    "furtoRoubo": false,
    "renajud": false,
    "financeira": false,
    "arrendamento": false,
    "judicial": false,
    "administrativa": false,
    "outras": \[\],
    "detalhes": \[\]
  },
  "comunicacaoVenda": false,
  "indicadores": {
    "multaRenainf": false,
    "comunicacaoVenda": false,
    "pendenciaEmissao": false,
    "restricaoRenajud": false,
    "leilao": false,
    "rouboFurto": false,
    "alarme": false,
    "siniav": null,
    "recall1": null,
    "recall2": null,
    "recall3": null,
    "recall4": null,
    "rfb": null,
    "descricaoRfb": null
  },
  "faturamento": {
    "tipoDoc": null,
    "numeroId": null,
    "uf": null,
    "dataLimite": null,
    "natureza": null
  },
  "importacao": {
    "natureza": null,
    "descricaoDocImportador": null,
    "numeroIdImportador": null,
    "codigoOrgaoRfb": null,
    "descricaoOrgaoRfb": null,
    "registroAduaneiro": null,
    "numeroDeclaracaoImportacao": null,
    "dataDistImportacao": null,
    "paisTransferencia": null,
    "codigoPaisTransferencia": null,
    "dataAtualizacaoMre": null,
    "descricaoTipoImportacao": null,
    "numeroProcessoImportacao": null,
    "dataBaixaImportacao": null,
    "dataUltimaAtualizacao": null
  },
  "proprietarioIndicado": null,
  "Consulta": {
    "timestamp": "2026-06-11T12:30:07.455Z",
    "source": "serpro",
    "consultedBy": "renavam",
    "tempoRespostaMs": 905,
    "isPesquisado": false
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Token "radar-serpro" não configurado na plataforma. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- RENAVAM antigo tem 9 dígitos; o padrão atual tem 11. Ambos são aceitos.


## Empresas

Cadastro completo de pessoa jurídica.

### CNPJ

\`GET https://api.athenasbuscas.com/api/ext/v1/cnpj/:cnpj\`

Ficha cadastral da pessoa jurídica na Receita Federal: razão social, nome fantasia, capital social, natureza jurídica, porte, atividade principal e secundárias, situação cadastral, endereço completo, contatos, quadro societário e enquadramento no Simples Nacional / MEI.

- \*\*Grupo:\*\* Empresas
- \*\*Fonte:\*\* Receita Federal (via cnpj.ws)
- \*\*Latência típica:\*\* 1–5 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Onboarding e validação de fornecedor ou cliente PJ
- Prospecção B2B filtrada por CNAE, porte e região
- Checagem de situação cadastral antes de emitir nota

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cnpj\` | path | string | sim | 14 dígitos, com ou sem pontuação. | \`00000000000191\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/cnpj/00000000000191" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/cnpj/00000000000191', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/cnpj/00000000000191',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`razao\_social / capital\_social\` | string | Identificação e capital declarado. |
| \`porte / natureza\_juridica\` | object | Códigos e descrições oficiais. |
| \`simples\` | object | Opção pelo Simples e MEI, com datas de entrada e exclusão. |
| \`estabelecimento\` | object | CNPJ do estabelecimento, matriz/filial, situação cadastral, endereço, telefones e email. |
| \`estabelecimento.atividade\_principal\` | object | CNAE principal com seção, divisão e descrição. |
| \`estabelecimento.atividades\_secundarias\[\]\` | array | Demais CNAEs registrados. |
| \`estabelecimento.inscricoes\_estaduais\[\]\` | array | IEs por estado com indicador de atividade. |
| \`socios\[\]\` | array | Quadro societário: nome, qualificação, data de entrada e faixa etária. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "cnpj\_raiz": "00000000",
  "razao\_social": "EMPRESA EXEMPLO LTDA",
  "capital\_social": "100000.00",
  "responsavel\_federativo": "",
  "atualizado\_em": "2026-07-15T03:00:00.000Z",
  "porte": {
    "id": "03",
    "descricao": "Empresa de Pequeno Porte"
  },
  "natureza\_juridica": {
    "id": "2062",
    "descricao": "Sociedade Empresária Limitada"
  },
  "qualificacao\_do\_responsavel": {
    "id": 49,
    "descricao": "Sócio-Administrador"
  },
  "simples": {
    "simples": "Sim",
    "data\_opcao\_simples": "2018-01-01",
    "data\_exclusao\_simples": null,
    "mei": "Não",
    "data\_opcao\_mei": null,
    "data\_exclusao\_mei": null
  },
  "estabelecimento": {
    "cnpj": "00000000000191",
    "atividade\_principal": {
      "id": "6201501",
      "secao": "J",
      "divisao": "62",
      "descricao": "Desenvolvimento de programas de computador sob encomenda"
    },
    "atividades\_secundarias": \[
      {
        "id": "6202300",
        "descricao": "Desenvolvimento e licenciamento de programas customizáveis"
      }
    \],
    "tipo": "Matriz",
    "nome\_fantasia": "EXEMPLO TECH",
    "situacao\_cadastral": "Ativa",
    "data\_situacao\_cadastral": "2005-11-03",
    "motivo\_situacao\_cadastral": null,
    "data\_inicio\_atividade": "2005-11-03",
    "tipo\_logradouro": "RUA",
    "logradouro": "DAS FLORES",
    "numero": "123",
    "complemento": "SALA 45",
    "bairro": "JARDIM PAULISTA",
    "cep": "01234567",
    "ddd1": "11",
    "telefone1": "34567890",
    "ddd2": null,
    "telefone2": null,
    "email": "contato@exemplo.com.br",
    "estado": {
      "id": 35,
      "nome": "São Paulo",
      "sigla": "SP",
      "ibge\_id": 35
    },
    "cidade": {
      "id": 3550308,
      "nome": "São Paulo",
      "ibge\_id": 3550308,
      "siafi\_id": "7107"
    },
    "inscricoes\_estaduais": \[
      {
        "inscricao\_estadual": "123456789012",
        "ativo": true,
        "estado": { "sigla": "SP" }
      }
    \]
  },
  "socios": \[
    {
      "cpf\_cnpj\_socio": "\*\*\*456789\*\*",
      "nome": "NOME DO SOCIO",
      "tipo": "Pessoa Física",
      "data\_entrada": "2005-11-03",
      "faixa\_etaria": "41 a 50 anos",
      "qualificacao\_socio": {
        "id": 49,
        "descricao": "Sócio-Administrador"
      },
      "pais": { "nome": "Brasil" }
    }
  \],
  "\_meta": {
    "cnpjConsultado": "00000000000191",
    "cnpjFormatado": "00.000.000/0001-91",
    "tempoRespostaMs": 640,
    "timestamp": "2026-08-06T12:30:07.455Z"
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Limite de consultas da fonte pública atingido — tente novamente em instantes. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- O CPF dos sócios vem mascarado na origem (formato \*\*\*456789\*\*) — é assim que a Receita publica.
- A resposta é um passthrough enriquecido da fonte: o bloco \_meta traz o CNPJ consultado e o tempo de resposta.


### Funcionários (CNPJ)

\`GET https://api.athenasbuscas.com/api/ext/v1/employees/:cnpj\`

Lista paginada dos vínculos empregatícios declarados pelo estabelecimento na RAIS: nome, CPF, PIS, nascimento, escolaridade, admissão, demissão, CBO, jornada contratada e salário mensal. Acompanha estatísticas do quadro (ativos, desligados, salário médio, distribuição por sexo e por ano-base) calculadas sobre o total, não só sobre a página.

- \*\*Grupo:\*\* Empresas
- \*\*Fonte:\*\* RAIS — Ministério do Trabalho
- \*\*Latência típica:\*\* &lt; 1 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Dimensionar o quadro real de funcionários de um fornecedor ou concorrente
- Due diligence trabalhista: quem trabalha (ou trabalhou) na empresa
- Localizar uma pessoa a partir do empregador

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cnpj\` | path | string | sim | 14 dígitos, com ou sem pontuação. Busca em CNPJ, CNPJCEI e CEI. | \`07836162000103\` |
| \`page\` | query | integer | não | Página desejada (padrão 1). | \`1\` |
| \`pageSize\` | query | integer | não | Registros por página (padrão 50, máximo 200). | \`50\` |
| \`q\` | query | string | não | Filtra pelo início do nome do funcionário. | \`MARIA\` |
| \`ano\` | query | string | não | Restringe ao ano-base declarado. | \`2016\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/employees/07836162000103?page=1&amp;pageSize=50" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/employees/07836162000103?page=1&amp;pageSize=50', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/employees/07836162000103?page=1&amp;pageSize=50',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`empresa\` | object | Estabelecimento como declarado na RAIS: razão social, fantasia, CNAE, endereço, telefone e email. |
| \`paginacao\` | object | pagina, porPagina, total, totalPaginas e relacao ("eq" ou "gte"). |
| \`estatisticas\` | object | totalVinculos, ativos, desligados, salarioMedio, maiorSalario, porSexo\[\] e porAno\[\]. |
| \`funcionarios\[\]\` | array | Trabalhador (nome, cpf, pis, dataNascimento, idade, sexo, raçaCor, escolaridade, CTPS) + o bloco \`vinculo\`. |
| \`funcionarios\[\].vinculo\` | object | admissao, demissao, ativo, situacao, tempoVinculoMeses, cbo2002, horasContratadas e salários. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-08-06T12:30:07.455Z",
  "cnpj": "07836162000103",
  "cnpjFormatado": "07.836.162/0001-03",
  "empresa": {
    "razaoSocial": "EMPRESA EXEMPLO LTDA",
    "nomeFantasia": "EXEMPLO",
    "cnpj": "07836162000103",
    "cnpjFormatado": "07.836.162/0001-03",
    "cei": "07836162000103",
    "tipoEstabelecimento": "CNPJ",
    "cnaeSubclasse": "5829800",
    "cnaeClasse": null,
    "subsetorIbge": null,
    "faixaTamanhoEmpresa": "1",
    "endereco": {
      "logradouro": "RUA EXEMPLO",
      "numero": "79",
      "complemento": null,
      "bairro": "CENTRO",
      "cep": "50080-220",
      "municipio": "RECIFE",
      "uf": "PE",
      "completo": "RUA EXEMPLO, 79 — CENTRO — RECIFE - PE"
    },
    "telefone": "8130000000",
    "email": "CONTATO@EXEMPLO.COM.BR"
  },
  "paginacao": {
    "pagina": 1,
    "porPagina": 50,
    "total": 137,
    "totalPaginas": 3,
    "relacao": "eq"
  },
  "filtros": {
    "nome": null,
    "ano": null
  },
  "estatisticas": {
    "totalVinculos": 137,
    "ativos": 92,
    "desligados": 45,
    "salarioMedio": 1834.22,
    "salarioMedioFormatado": "R$ 1.834,22",
    "maiorSalario": 12500,
    "maiorSalarioFormatado": "R$ 12.500,00",
    "porSexo": \[
      { "sexo": "M", "descricao": "Masculino", "total": 81 },
      { "sexo": "F", "descricao": "Feminino", "total": 56 }
    \],
    "porAno": \[
      { "ano": "2016", "total": 137 }
    \]
  },
  "funcionarios": \[
    {
      "nome": "NOME COMPLETO DA PESSOA",
      "cpf": "12345678900",
      "cpfFormatado": "123.456.789-00",
      "pis": "13110292458",
      "pisFormatado": "131.10292.45-8",
      "dataNascimento": "1984-05-02",
      "idade": 42,
      "sexo": "M",
      "sexoDescricao": "Masculino",
      "racaCor": "8",
      "racaCorDescricao": "Parda",
      "grauInstrucao": "08",
      "grauInstrucaoDescricao": "Ensino Superior incompleto",
      "portadorDeficiencia": false,
      "tipoDeficiencia": "Não deficiente",
      "ctps": { "numero": "00038886", "serie": "00072" },
      "vinculo": {
        "id": 47313174,
        "anoDeclarado": "2016",
        "competencia": "201600",
        "admissao": "2012-12-01",
        "demissao": null,
        "ativo": true,
        "situacao": "Ativo",
        "tempoVinculoMeses": 164,
        "cbo2002": "782305",
        "horasContratadas": 44,
        "salarioMensal": 1000,
        "salarioMensalFormatado": "R$ 1.000,00",
        "salarioMensalDeclarado": 1000,
        "salarioMensalDeclaradoFormatado": "R$ 1.000,00",
        "aprendiz": false,
        "tipoMovimentacao": null,
        "observacao": null
      }
    }
  \],
  "\_meta": {
    "fonte": "RAIS — Ministério do Trabalho",
    "indice": "rais\_2019\_completa",
    "observacaoSalario": "Valores mensais em reais na competência declarada (sem correção monetária).",
    "tempoRespostaMs": 61
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Índice da RAIS indisponível no cluster de busca. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Um documento da RAIS = um vínculo em um ano-base. A mesma pessoa aparece mais de uma vez quando há vários anos declarados.
- \`estatisticas\` pode vir null se o índice não permitir agregação naqueles campos — trate como opcional.
- Salários são da competência declarada, sem correção monetária.


## Web / Infra

Inteligência sobre IPs e domínios.

### IP

\`GET https://api.athenasbuscas.com/api/ext/v1/ip/:ip\`

Aceita IPv4 e IPv6. Devolve localização aproximada com coordenadas e timezone, dados de rede (ISP, organização, ASN), DNS reverso e — o mais valioso para antifraude — a classificação do IP: móvel, proxy/VPN ou datacenter.

- \*\*Grupo:\*\* Web / Infraestrutura
- \*\*Fonte:\*\* ip-api + GeoIP local + DNS reverso
- \*\*Latência típica:\*\* &lt; 1 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Antifraude: sinalizar acesso via VPN, proxy ou datacenter
- Geolocalização de acesso para regras de risco
- Enriquecimento de logs de aplicação e SIEM

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`ip\` | path | string | sim | Endereço IPv4 ou IPv6 válido. | \`8.8.8.8\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/ip/8.8.8.8" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/ip/8.8.8.8', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/ip/8.8.8.8',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`versao\` | string | "IPv4" ou "IPv6". |
| \`localizacao\` | object | País, região, cidade, CEP, latitude/longitude, timezone e moeda. |
| \`rede\` | object | ISP, organização, ASN e nome do ASN. |
| \`classificacao\` | object | mobile, proxy\_vpn e hosting\_datacenter — booleanos de risco. |
| \`dns\_reverso\` | object | Hostnames resolvidos e o principal. |
| \`fontes\` | object | Quais fontes responderam nesta consulta. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "ip\_consultado": "8.8.8.8",
  "versao": "IPv4",
  "localizacao": {
    "pais": "United States",
    "codigo\_pais": "US",
    "continente": "North America",
    "codigo\_continente": "NA",
    "regiao": "Virginia",
    "codigo\_regiao": "VA",
    "cidade": "Ashburn",
    "distrito": "",
    "cep": "20149",
    "latitude": 39.03,
    "longitude": -77.5,
    "timezone": "America/New\_York",
    "utc\_offset\_segundos": -14400,
    "moeda": "USD"
  },
  "rede": {
    "isp": "Google LLC",
    "organizacao": "Google Public DNS",
    "asn": "AS15169 Google LLC",
    "asn\_nome": "GOOGLE",
    "area\_codigo": 0,
    "eu": null
  },
  "classificacao": {
    "mobile": false,
    "proxy\_vpn": false,
    "hosting\_datacenter": true
  },
  "dns\_reverso": {
    "hostnames": \["dns.google"\],
    "principal": "dns.google",
    "erro": null
  },
  "fontes": {
    "geoip\_lite": true,
    "ip\_api": true,
    "ip\_api\_error": null
  },
  "\_meta": {
    "tempoRespostaMs": 210,
    "timestamp": "2026-08-06T12:30:07.455Z"
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Geolocalização de IP é aproximada por natureza: confie na cidade/região, nunca em endereço exato.
- classificacao.proxy\_vpn é o sinal mais útil para score de risco em login e checkout.


### Domínio (WHOIS)

\`GET https://api.athenasbuscas.com/api/ext/v1/domain/:domain\`

Une WHOIS e DNS numa chamada. O WHOIS é normalizado tanto para o padrão ICANN quanto para o formato do Registro.br (que expõe CNPJ/CPF do titular), e ainda devolve o texto cru. O bloco DNS traz A, AAAA, MX, NS, TXT, CNAME e SOA.

- \*\*Grupo:\*\* Web / Infraestrutura
- \*\*Fonte:\*\* WHOIS (Registro.br / ICANN) + resolvedores DNS
- \*\*Latência típica:\*\* 1–5 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Verificar titularidade e idade de domínio em antifraude
- Due diligence de fornecedor a partir do site
- Diagnóstico de configuração de email (SPF/MX) e DNS

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`domain\` | path | string | sim | Domínio sem http:// e sem www. Subdomínios são aceitos para o DNS. | \`exemplo.com.br\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/domain/exemplo.com.br" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/domain/exemplo.com.br', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/domain/exemplo.com.br',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`whois.registrador\` | string | Registrador responsável (+ URL e contato de abuso). |
| \`whois.data\_criacao / data\_expiracao\` | string | Datas de registro e vencimento — idade é sinal forte de confiança. |
| \`whois.registrante\` | object | Titular: nome, organização, documento (CNPJ/CPF no .br), email e país. |
| \`whois.nameservers\[\] / status\[\]\` | array | NSs delegados e status do domínio. |
| \`whois.texto\_cru\` | string | Resposta WHOIS original, para auditoria. |
| \`dns.a / aaaa / mx / ns / txt / cname / soa\` | array\\|object | Registros DNS. Cada tipo vira { error } quando não existe. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "dominio\_consultado": "exemplo.com.br",
  "whois": {
    "nome\_dominio": "exemplo.com.br",
    "registry\_id": null,
    "registrador": "Registro.br",
    "registrador\_url": "https://registro.br",
    "registrador\_iana\_id": null,
    "registrador\_email\_abuso": "mail-abuse@registro.br",
    "registrador\_telefone\_abuso": null,
    "whois\_server": "whois.registro.br",
    "data\_criacao": "1999-03-15T00:00:00.000Z",
    "data\_atualizacao": "2026-02-10T00:00:00.000Z",
    "data\_expiracao": "2027-03-15T00:00:00.000Z",
    "status": \["published"\],
    "nameservers": \["ns1.exemplo.com.br", "ns2.exemplo.com.br"\],
    "dnssec": "signedDelegation",
    "registrante": {
      "nome": "EMPRESA EXEMPLO LTDA",
      "organizacao": "EMPRESA EXEMPLO LTDA",
      "documento": "00.000.000/0001-91",
      "documento\_tipo": "CNPJ",
      "documento\_raw": "000.000.000/0001-91",
      "responsavel": "NOME DO RESPONSAVEL",
      "email": "contato@exemplo.com.br",
      "pais": "BR"
    },
    "admin": { "nic": "ABCDE" },
    "tecnico": { "nic": "FGHIJ" },
    "contatos\_br": \[
      {
        "nic": "ABCDE",
        "nome": "NOME DO RESPONSAVEL",
        "email": "contato@exemplo.com.br",
        "criado": "19990315",
        "alterado": "20260210"
      }
    \],
    "formato": "registro.br",
    "texto\_cru": "domain: exemplo.com.br\\nowner: EMPRESA EXEMPLO LTDA\\n...",
    "servidores\_consultados": \["whois.registro.br"\],
    "erro": null
  },
  "dns": {
    "a": \["203.0.113.10"\],
    "aaaa": { "error": "ENODATA" },
    "mx": \[
      { "exchange": "mx1.exemplo.com.br", "priority": 10 }
    \],
    "ns": \["ns1.exemplo.com.br", "ns2.exemplo.com.br"\],
    "txt": [["v=spf1 include:_spf.exemplo.com.br ~all"]],
    "cname": { "error": "ENODATA" },
    "soa": {
      "nsname": "ns1.exemplo.com.br",
      "hostmaster": "hostmaster.exemplo.com.br",
      "serial": 2026021001,
      "refresh": 3600,
      "retry": 900,
      "expire": 604800,
      "minttl": 300
    }
  },
  "\_meta": {
    "tempoRespostaMs": 1830,
    "timestamp": "2026-08-06T12:30:07.455Z"
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Domínios .br expõem o CNPJ/CPF do titular; gTLDs geralmente vêm com privacidade (redacted).
- Cada registro DNS pode vir como { "error": "ENODATA" } — verifique Array.isArray antes de iterar.


### Logins Vazados

\`GET https://api.athenasbuscas.com/api/ext/v1/leaked-logins?q=\`

Consulta o índice de logins vazados. Aceita URL/domínio, e-mail, CPF (com ou sem pontuação) ou glob com \* (ex: \*@empresa.co\*, \*nubank.com\*). Padrões amplos (\*, \*@\*, \*.com) são recusados.

- \*\*Grupo:\*\* Web / Infraestrutura
- \*\*Fonte:\*\* stealerlogs
- \*\*Latência típica:\*\* 1–4 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Checar se um e-mail ou CPF aparece em dumps de stealer
- Levantar contas vazadas de um domínio (antifraude / credential stuffing)
- Auditar exposição de acessos a um site específico
- Buscar todos os e-mails de um domínio corporativo com \*@empresa.com.br

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`q\` | query | string | sim | URL, domínio, e-mail, CPF ou padrão com \* (ex: \*@empresa.co\*). Mínimo 5 letras/números; \* sozinho e \*.com são recusados. | \`exemplo.com\` |
| \`type\` | query | string | não | url, email, cpf ou auto (padrão). | \`url\` |
| \`page\` | query | integer | não | Página (padrão 1). | \`1\` |
| \`limit\` | query | integer | não | Itens por página (padrão 20, máximo 50). | \`20\` |
| \`root\_domain\` | query | string | não | Filtra a lista por um site específico. | \`exemplo.com\` |
| \`scope\` | query | string | não | Na busca por URL: domain (padrão, todo o site) ou url (somente a URL exata). | \`domain\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/leaked-logins?q=exemplo.com&amp;page=1&amp;limit=20" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/leaked-logins?q=exemplo.com&amp;page=1&amp;limit=20', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/leaked-logins?q=exemplo.com&amp;page=1&amp;limit=20',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`results\[\]\` | array | Credenciais: url, login, password, domain, root\_domain, is\_business\_mail, timestamp. |
| \`total\` | integer | Total de hits no índice. |
| \`page / total\_pages / limit\` | integer | Paginação. A listagem corta em 10.000 registros mais recentes. |
| \`stats\` | object | unique\_domains, unique\_logins, business\_mail, top\_domains\[\], newest, oldest. |
| \`type\` | string | Tipo efetivamente usado (url, email ou cpf). |
| \`wildcard\` | boolean | true quando q contém \* e a busca usou padrão. |
| \`match\` | object | Na busca por URL: field (domain\\|root\_domain), host parseado e root (eTLD+1). No padrão \*: field, kind (term\\|prefix\\|wildcard) e value. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "query": "exemplo.com",
  "type": "url",
  "scope": "domain",
  "root\_domain": null,
  "results": \[
    {
      "id": "a1b2c3d4e5",
      "url": "https://www.exemplo.com/login",
      "login": "maria.silva@email.com",
      "password": "Senha@2024",
      "root\_domain": "exemplo.com",
      "domain": "www.exemplo.com",
      "is\_business\_mail": false,
      "email\_root\_domain": "email.com",
      "email\_domain": "email.com",
      "timestamp": "2026-04-22T21:59:34.434176-03:00"
    },
    {
      "id": "f6e5d4c3b2",
      "url": "acesso.gov.br",
      "login": "123.456.789-00",
      "password": "Gov@2023",
      "root\_domain": "acesso.gov.br",
      "domain": "acesso.gov.br",
      "is\_business\_mail": false,
      "email\_root\_domain": null,
      "email\_domain": null,
      "timestamp": "2026-04-25T21:14:02.901248-03:00"
    }
  \],
  "total": 2,
  "page": 1,
  "limit": 20,
  "total\_pages": 1,
  "stats": {
    "unique\_domains": 2,
    "unique\_logins": 2,
    "business\_mail": 0,
    "top\_domains": \[
      { "domain": "exemplo.com", "count": 1 },
      { "domain": "acesso.gov.br", "count": 1 }
    \],
    "newest": "2026-04-25T21:14:02.901248-03:00",
    "oldest": "2026-04-22T21:59:34.434176-03:00"
  },
  "\_meta": {
    "tempoRespostaMs": 420,
    "timestamp": "2026-09-08T12:00:00.000Z",
    "truncated": false
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Padrão com \* inválido ou amplo demais (\*, \*@\*, \*.com, literal curto). |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhuma credencial vazada encontrada. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Índice de logins vazados indisponível. |
| \`504\` | Busca por padrão estourou o tempo. Torne o trecho mais específico. |

#### Observações

- Ordenação fixa por @timestamp descendente — os vazamentos mais novos vêm primeiro.
- CPF é buscado com e sem máscara (123.456.789-00 e 12345678900).
- URL/domínio: o host é extraído da URL. dominio.tld pesquisa o campo root\_domain; sub.dominio.tld (incluindo www) pesquisa o campo domain.
- Padrão \*: \*@empresa.com vira term em email\_domain; \*@empresa.co\* vira prefix; \*nubank.com\* pesquisa root\_domain/domain. \* sozinho, \*@\*, \*.com e \*.com.br são recusados (400).


## Trabalhista

Vínculos empregatícios declarados na RAIS — por CPF ou PIS/PASEP.

### RAIS por CPF

\`GET https://api.athenasbuscas.com/api/ext/v1/rais/:cpf\`

Devolve todos os vínculos declarados para o CPF: empregador (razão social, CNPJ, endereço, CNAE), admissão, demissão, CBO, jornada e salário mensal — mais os dados do trabalhador que a RAIS carrega (PIS, nascimento, sexo, raça/cor, escolaridade, deficiência e CTPS) e um resumo com totais e lista de empregadores.

- \*\*Grupo:\*\* Trabalhista
- \*\*Fonte:\*\* RAIS — Ministério do Trabalho
- \*\*Latência típica:\*\* &lt; 1 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Comprovar vínculo empregatício e renda declarada
- Análise de crédito com renda formal em vez de renda presumida
- Localização de pessoa pelo empregador atual

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/rais/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/rais/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/rais/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`trabalhador\` | object | nome, cpf, pis, dataNascimento, idade, sexo, racaCor, grauInstrucao (com descrição), deficiência e CTPS. |
| \`resumo\` | object | totalVinculos, vinculosAtivos, vinculosEncerrados, totalEmpresas, maior/menor salário, ultimaAdmissao e anos\[\]. |
| \`empresas\[\]\` | array | Empregadores distintos com CNPJ, município/UF, nº de vínculos e período. |
| \`vinculos\[\]\` | array | Cada vínculo: admissao, demissao, situacao, tempoVinculoMeses, cbo2002, horasContratadas, salários e o objeto \`empresa\`. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-08-06T12:30:07.455Z",
  "cpf": "12345678900",
  "trabalhador": {
    "nome": "NOME COMPLETO DA PESSOA",
    "cpf": "12345678900",
    "cpfFormatado": "123.456.789-00",
    "pis": "13110292458",
    "pisFormatado": "131.10292.45-8",
    "dataNascimento": "1984-05-02",
    "idade": 42,
    "sexo": "M",
    "sexoDescricao": "Masculino",
    "racaCor": "8",
    "racaCorDescricao": "Parda",
    "grauInstrucao": "08",
    "grauInstrucaoDescricao": "Ensino Superior incompleto",
    "portadorDeficiencia": false,
    "tipoDeficiencia": "Não deficiente",
    "ctps": {
      "numero": "00038886",
      "serie": "00072"
    }
  },
  "resumo": {
    "totalVinculos": 2,
    "vinculosAtivos": 1,
    "vinculosEncerrados": 1,
    "totalEmpresas": 2,
    "maiorSalario": 2450.75,
    "menorSalario": 1000,
    "ultimaAdmissao": "2012-12-01",
    "anos": \["2014", "2016"\]
  },
  "empresas": \[
    {
      "razaoSocial": "EMPRESA EXEMPLO LTDA",
      "nomeFantasia": "EXEMPLO",
      "cnpj": "07836162000103",
      "cnpjFormatado": "07.836.162/0001-03",
      "municipio": "RECIFE",
      "uf": "PE",
      "vinculos": 1,
      "admissao": "2012-12-01",
      "demissao": null,
      "ativo": true
    }
  \],
  "vinculos": \[
    {
      "id": 47313174,
      "anoDeclarado": "2016",
      "competencia": "201600",
      "admissao": "2012-12-01",
      "demissao": null,
      "ativo": true,
      "situacao": "Ativo",
      "tempoVinculoMeses": 164,
      "cbo2002": "782305",
      "horasContratadas": 44,
      "salarioMensal": 1000,
      "salarioMensalFormatado": "R$ 1.000,00",
      "salarioMensalDeclarado": 1000,
      "salarioMensalDeclaradoFormatado": "R$ 1.000,00",
      "aprendiz": false,
      "tipoMovimentacao": null,
      "observacao": null,
      "empresa": {
        "razaoSocial": "EMPRESA EXEMPLO LTDA",
        "nomeFantasia": "EXEMPLO",
        "cnpj": "07836162000103",
        "cnpjFormatado": "07.836.162/0001-03",
        "cei": "07836162000103",
        "tipoEstabelecimento": "CNPJ",
        "cnaeSubclasse": "5829800",
        "cnaeClasse": null,
        "subsetorIbge": null,
        "faixaTamanhoEmpresa": "1",
        "endereco": {
          "logradouro": "RUA EXEMPLO",
          "numero": "79",
          "complemento": null,
          "bairro": "CENTRO",
          "cep": "50080-220",
          "municipio": "RECIFE",
          "uf": "PE",
          "completo": "RUA EXEMPLO, 79 — CENTRO — RECIFE - PE"
        },
        "telefone": "8130000000",
        "email": "CONTATO@EXEMPLO.COM.BR"
      }
    }
  \],
  "\_meta": {
    "fonte": "RAIS — Ministério do Trabalho",
    "indice": "rais\_2019\_completa",
    "observacaoSalario": "Valores mensais em reais na competência declarada (sem correção monetária).",
    "tempoRespostaMs": 42
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Índice da RAIS indisponível no cluster de busca. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- Vínculo sem DEMISSAO é considerado ativo no ano-base declarado — não é garantia de emprego vigente hoje.
- Códigos de raça/cor e escolaridade vêm decodificados nos campos \*Descricao.
- Até 200 vínculos por consulta, ordenados da admissão mais recente para a mais antiga.


### PIS/PASEP

\`GET https://api.athenasbuscas.com/api/ext/v1/pis/:pis\`

Mesma resposta do módulo RAIS por CPF, porém indexada pelo número do PIS/PASEP/NIT — útil quando o que se tem em mãos é a folha de pagamento, o extrato do FGTS ou a CTPS, e não o CPF. A resposta traz o CPF resolvido dentro de \`trabalhador\`.

- \*\*Grupo:\*\* Trabalhista
- \*\*Fonte:\*\* RAIS — Ministério do Trabalho
- \*\*Latência típica:\*\* &lt; 1 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Descobrir o CPF e o nome do titular a partir do PIS
- Conferência de folha de pagamento e eSocial
- Auditoria de vínculos declarados por terceiros

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`pis\` | path | string | sim | 11 dígitos, com ou sem pontuação (PIS, PASEP ou NIT). | \`13110292458\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/pis/13110292458" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/pis/13110292458', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/pis/13110292458',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`pis\` | string | PIS consultado (somente dígitos). |
| \`trabalhador\` | object | Mesma estrutura do módulo RAIS por CPF — inclui o CPF resolvido. |
| \`resumo / empresas\[\] / vinculos\[\]\` | object\\|array | Idênticos ao módulo RAIS por CPF. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-08-06T12:30:07.455Z",
  "pis": "13110292458",
  "trabalhador": {
    "nome": "NOME COMPLETO DA PESSOA",
    "cpf": "12345678900",
    "cpfFormatado": "123.456.789-00",
    "pis": "13110292458",
    "pisFormatado": "131.10292.45-8",
    "dataNascimento": "1984-05-02",
    "idade": 42,
    "sexo": "M",
    "sexoDescricao": "Masculino",
    "racaCor": "8",
    "racaCorDescricao": "Parda",
    "grauInstrucao": "08",
    "grauInstrucaoDescricao": "Ensino Superior incompleto",
    "portadorDeficiencia": false,
    "tipoDeficiencia": "Não deficiente",
    "ctps": {
      "numero": "00038886",
      "serie": "00072"
    }
  },
  "resumo": {
    "totalVinculos": 1,
    "vinculosAtivos": 1,
    "vinculosEncerrados": 0,
    "totalEmpresas": 1,
    "maiorSalario": 1000,
    "menorSalario": 1000,
    "ultimaAdmissao": "2012-12-01",
    "anos": \["2016"\]
  },
  "empresas": \["(mesma estrutura do módulo RAIS por CPF)"\],
  "vinculos": \["(mesma estrutura do módulo RAIS por CPF)"\],
  "\_meta": {
    "fonte": "RAIS — Ministério do Trabalho",
    "indice": "rais\_2019\_completa",
    "observacaoSalario": "Valores mensais em reais na competência declarada (sem correção monetária).",
    "tempoRespostaMs": 38
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Índice da RAIS indisponível no cluster de busca. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- O PIS tem 11 dígitos, como o CPF — confira qual documento está enviando antes de gastar o crédito.
- Um mesmo trabalhador pode ter mais de um PIS histórico; a consulta cobre apenas o número informado.


## Fiscal

Declarações de Imposto de Renda e situação do CPF na Receita Federal.

### IRPF (Imposto de Renda)

\`GET https://api.athenasbuscas.com/api/ext/v1/irpf/:cpf\`

Devolve o histórico fiscal do CPF na Receita Federal entre os anos-base 2014 e 2022: se houve declaração em cada ano, qual foi a situação (restituição creditada, imposto a pagar, saldo zero, declaração ausente) e, quando houve restituição, o lote, a data do crédito, o banco e a agência em que o dinheiro caiu. Vem com um resumo consolidado e o nome do contribuinte resolvido no cadastro civil.

- \*\*Grupo:\*\* Fiscal
- \*\*Fonte:\*\* Receita Federal — situação da declaração de IRPF
- \*\*Latência típica:\*\* &lt; 1 s
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Confirmar se a pessoa é declarante de IRPF — proxy de renda acima do limite de isenção
- Descobrir em qual banco e agência o titular mantém conta (a restituição cai em conta própria)
- Enriquecimento de análise de crédito e prevenção a fraude com dado fiscal

#### Parâmetros

| Nome | Local | Tipo | Obrigatório | Descrição | Exemplo |
| --- | --- | --- | --- | --- | --- |
| \`cpf\` | path | string | sim | 11 dígitos, com ou sem pontuação. | \`12345678900\` |

#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/irpf/12345678900" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/irpf/12345678900', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/irpf/12345678900',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`titular\` | object | nome, cpf, nascimento, idade, nome da mãe e óbito — do cadastro civil. \`null\` se o CPF não estiver no cadastro. |
| \`resumo\` | object | anos\[\], primeiroAno/ultimoAno, anosComDeclaracao, anosSemDeclaracao, anosComRestituicao, anosComImpostoAPagar, declaranteIrpf, ultimaRestituicao e bancos\[\]. |
| \`declaracoes\[\]\` | array | Uma entrada por ano-base: ano, anoExercicio, situacao (codigo, descricao, detalhe, tom, original), declarou e restituicao (lote, dataLote, banco, agencia). |

#### Exemplo de resposta (200)

\`\`\`json
{
  "success": true,
  "timestamp": "2026-08-06T12:30:07.455Z",
  "cpf": "12345678900",
  "titular": {
    "nome": "NOME COMPLETO DA PESSOA",
    "cpf": "12345678900",
    "cpfFormatado": "123.456.789-00",
    "dataNascimento": "1979-04-16",
    "nasc": "16/04/1979",
    "idade": 47,
    "nomeMae": "NOME COMPLETO DA MAE",
    "obito": { "falecido": false, "data": null },
    "contatosId": "41195239"
  },
  "resumo": {
    "totalRegistros": 9,
    "anos": \["2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022"\],
    "primeiroAno": "2014",
    "ultimoAno": "2022",
    "anosComDeclaracao": 8,
    "anosSemDeclaracao": 0,
    "anosComRestituicao": 7,
    "anosComImpostoAPagar": 1,
    "declaranteIrpf": true,
    "ultimaRestituicao": {
      "ano": "2021",
      "lote": 2,
      "dataLote": "30/06/2021",
      "banco": "Itaú Unibanco",
      "agencia": "0452"
    },
    "bancos": \[
      { "nome": "Itaú Unibanco", "agencias": \["0452"\], "anos": \["2021"\] },
      { "nome": "Banco do Brasil", "agencias": \["0384"\], "anos": \["2014", "2015", "2016", "2017", "2018", "2019"\] }
    \]
  },
  "declaracoes": \[
    {
      "ano": "2022",
      "anoExercicio": "2023",
      "situacao": {
        "codigo": "SEM\_STATUS",
        "descricao": "Situação não informada pela Receita",
        "tom": "neutral",
        "declarou": null,
        "restituicao": false,
        "detalhe": null,
        "original": "NENHUM DOS CAMPOS DE STATUS PREENCHIDO - EM BRANCO"
      },
      "declarou": null,
      "restituicao": {
        "houve": false,
        "lote": null,
        "dataLote": null,
        "dataLoteBr": null,
        "banco": null,
        "bancoOriginal": null,
        "agencia": null
      },
      "dataConsulta": "2023-03-19",
      "dataConsultaBr": "19/03/2023",
      "dataInclusao": "12/04/2023"
    },
    {
      "ano": "2021",
      "anoExercicio": "2022",
      "situacao": {
        "codigo": "RESTITUICAO\_CREDITADA",
        "descricao": "Restituição creditada",
        "tom": "green",
        "declarou": true,
        "restituicao": true,
        "detalhe": null,
        "original": "CREDITADA"
      },
      "declarou": true,
      "restituicao": {
        "houve": true,
        "lote": 2,
        "dataLote": "2021-06-30",
        "dataLoteBr": "30/06/2021",
        "banco": "Itaú Unibanco",
        "bancoOriginal": "ITAU UNIBANCO S.A.",
        "agencia": "0452"
      },
      "dataConsulta": "2021-10-18",
      "dataConsultaBr": "18/10/2021",
      "dataInclusao": "21/03/2022"
    },
    {
      "ano": "2020",
      "anoExercicio": "2021",
      "situacao": {
        "codigo": "IMPOSTO\_A\_PAGAR",
        "descricao": "Imposto a pagar",
        "tom": "amber",
        "declarou": true,
        "restituicao": false,
        "detalhe": "Débito automático ativo a partir da 1ª cota / cota única",
        "original": "IMPOSTO A PAGAR, COM SOLICITACAO DE DEBITO AUTOMATICO. SITUACAO DO DEBITO AUTOMATICO: ATIVO A PARTIR DA 1A COTA/COTA UNICA"
      },
      "declarou": true,
      "restituicao": {
        "houve": false,
        "lote": null,
        "dataLote": null,
        "dataLoteBr": null,
        "banco": null,
        "bancoOriginal": null,
        "agencia": null
      },
      "dataConsulta": "2021-04-02",
      "dataConsultaBr": "02/04/2021",
      "dataInclusao": "10/05/2021"
    }
  \],
  "\_meta": {
    "fonte": "Receita Federal — situação da declaração de IRPF",
    "indice": "srs\_irpf",
    "linhasBase": 9,
    "tempoRespostaMs": 763
  }
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Consulta realizada com sucesso — 1 crédito debitado. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | Nenhum dado encontrado para o valor consultado. Crédito estornado. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`503\` | Índice de IRPF indisponível no cluster de busca. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- A base cobre os anos-base de 2014 a 2022 — a ausência de um ano significa que a situação não foi apurada, não que não houve declaração.
- \`situacao.codigo\` é estável e é o campo para automatizar: RESTITUICAO\_CREDITADA, RESTITUICAO\_ENVIADA, RESTITUICAO\_LIBERADA, RESTITUICAO\_EM\_FILA, RESTITUICAO\_DEVOLVIDA, AGUARDANDO\_REAGENDAMENTO, IMPOSTO\_A\_PAGAR, SEM\_SALDO, DECLARACAO\_PROCESSADA, DECLARACAO\_RECEBIDA, NAO\_DECLAROU, CONSULTA\_RESTRITA, SEM\_STATUS.
- \`declarou\` é \`true\`, \`false\` ou \`null\` — \`null\` quando a própria situação não permite afirmar (consulta protegida por código de acesso ou status em branco na origem).
- A resposta não traz valores em reais: a fonte informa a situação e o lote da restituição, não o montante restituído.
- \`situacao.original\` preserva o texto exato da Receita, útil para auditoria.
- \`situacao.tom\` (green, blue, amber, red, neutral) é só uma sugestão de cor para renderizar o status — não use como regra de negócio.


## Operação

Monitoramento da própria API — disponibilidade e uptime. Não consome crédito.

### Status da API

\`GET https://api.athenasbuscas.com/api/ext/v1/status\`

Devolve o estado de cada endpoint da API e o uptime consolidado em 24h, 7 e 31 dias. Feito para você plugar no seu monitoramento e decidir, antes de disparar uma consulta, se vale a pena tentar agora ou reagendar. O uptime é medido sobre as consultas reais da plataforma — respostas 404 (sem dados) não contam como indisponibilidade, só 5xx e timeout.

- \*\*Grupo:\*\* Operação
- \*\*Fonte:\*\* Consultas reais registradas na plataforma
- \*\*Latência típica:\*\* &lt; 100 ms (cache de 60 s)
- \*\*Custo:\*\* 1 crédito por consulta bem-sucedida

#### Quando usar

- Checar a saúde da integração antes de processar um lote grande
- Alimentar dashboard ou alerta interno (Grafana, Datadog, healthcheck próprio)
- Decidir fallback quando um endpoint específico está instável

#### Parâmetros



#### Exemplo de requisição

\`\`\`bash
curl -s "https://api.athenasbuscas.com/api/ext/v1/status" \\
  -H "X-API-Key: SUA\_API\_KEY"
\`\`\`

\`\`\`javascript
const res = await fetch('https://api.athenasbuscas.com/api/ext/v1/status', {
  headers: { 'X-API-Key': 'SUA\_API\_KEY' }
});

if (!res.ok) {
  // 404 = sem dados (crédito estornado), 402 = sem saldo, 429 = rate limit
  throw new Error(\`Athenas API ${res.status}: ${(await res.json()).error}\`);
}

const data = await res.json();
console.log(data);
console.log('Créditos restantes:', res.headers.get('X-Credits-Remaining'));
\`\`\`

\`\`\`python
import requests

res = requests.get(
    'https://api.athenasbuscas.com/api/ext/v1/status',
    headers={'X-API-Key': 'SUA\_API\_KEY'},
    timeout=30,
)

if res.status\_code == 404:
    print('Nenhum dado encontrado (crédito estornado)')
else:
    res.raise\_for\_status()
    data = res.json()
    print(data)
    print('Créditos restantes:', res.headers.get('X-Credits-Remaining'))
\`\`\`

#### Campos da resposta

| Campo | Tipo | Descrição |
| --- | --- | --- |
| \`status\` | string | "operational", "partial\_outage", "major\_outage" ou "idle" (sem tráfego recente para avaliar). |
| \`operational\` | boolean | Atalho booleano: true só quando todos os endpoints avaliados estão operacionais. |
| \`description\` | string | Frase pronta explicando o estado — dá para exibir direto ao seu usuário final. |
| \`uptime\` | object | Uptime consolidado da API em percentual: { "24h": 99.4, "7d": 99.8, "31d": 99.7 }. |
| \`summary\` | object | Contagem de endpoints por estado: total, operational, degraded, unavailable, idle. |
| \`endpoints\[\]\` | array | Um item por endpoint: id, name, group, path, status, operational, uptime, avgResponseMs e sampledRequests. |
| \`thresholds\` | object | Limiares usados na classificação (operacional acima de 99%, degradado acima de 95%). "unavailable" só aparece quando o endpoint para de responder: falhas seguidas e nenhum sucesso nos últimos minutos. |
| \`generatedAt / cached\` | string\\|boolean | Momento do cálculo e se a resposta veio do cache de 60 s. |

#### Exemplo de resposta (200)

\`\`\`json
{
  "status": "partial\_outage",
  "operational": false,
  "description": "Plataforma operacional. Alguns endpoints dependem de fornecedores externos que estão instáveis no momento.",
  "generatedAt": "2026-08-07T09:12:44.108Z",
  "cached": false,
  "uptime": {
    "24h": 97.42,
    "7d": 99.31,
    "31d": 99.68
  },
  "summary": {
    "total": 23,
    "operational": 9,
    "degraded": 0,
    "unavailable": 3,
    "idle": 11
  },
  "thresholds": {
    "operationalAbovePct": 99,
    "degradedAbovePct": 95,
    "note": "Uptime medido sobre consultas reais. Respostas 404 (sem dados) não contam como indisponibilidade. Um endpoint só fica unavailable quando para de responder: falhas seguidas e nenhum sucesso nos últimos minutos."
  },
  "endpoints": \[
    {
      "id": "cpf",
      "name": "CPF Completo",
      "group": "CPF",
      "path": "/api/ext/v1/cpf/:cpf",
      "status": "unavailable",
      "operational": false,
      "uptime": { "24h": 25, "7d": 97.14, "31d": 98.9 },
      "avgResponseMs": 1840,
      "sampledRequests": { "24h": 4, "7d": 70, "31d": 312 }
    },
    {
      "id": "plate",
      "name": "Placa",
      "group": "Veículos",
      "path": "/api/ext/v1/plate/:plate",
      "status": "operational",
      "operational": true,
      "uptime": { "24h": 100, "7d": 100, "31d": 99.72 },
      "avgResponseMs": 920,
      "sampledRequests": { "24h": 1, "7d": 18, "31d": 143 }
    },
    {
      "id": "domain",
      "name": "Domínio (WHOIS)",
      "group": "Web / Infraestrutura",
      "path": "/api/ext/v1/domain/:domain",
      "status": "idle",
      "operational": false,
      "uptime": { "24h": null, "7d": null, "31d": 100 },
      "avgResponseMs": null,
      "sampledRequests": { "24h": 0, "7d": 0, "31d": 4 }
    }
  \]
}
\`\`\`

#### Códigos de resposta

| Código | Significado |
| --- | --- |
| \`200\` | Status calculado com sucesso. Não consome crédito. |
| \`400\` | Parâmetro inválido ou ausente. Não consome crédito. |
| \`401\` | X-API-Key ausente, inválida ou revogada. |
| \`402\` | Créditos insuficientes — recarregue em /dev/credits. |
| \`403\` | IP não autorizado pela whitelist da chave. |
| \`404\` | O endpointId informado não existe no catálogo. |
| \`429\` | Rate limit da chave excedido — veja o limite em /dev/api-keys. |
| \`500\` | Erro interno. Crédito estornado. |
| \`502\` | Fornecedor externo respondeu de forma inválida. Crédito estornado. |
| \`504\` | Timeout na consulta externa. Crédito estornado. |

#### Observações

- GET /status/:endpointId devolve só um endpoint — use o mesmo \`id\` que aparece em endpoints\[\].
- A resposta é cacheada por 60 s; consultar com frequência maior devolve o mesmo payload com cached: true.
- Não consome crédito nem entra no seu consumo, mas conta no rate limit da chave.
- Endpoints com status "idle" apenas não tiveram tráfego suficiente na janela — não significa indisponibilidade.


---

\_Documentação gerada pelo Portal Dev do Athenas Buscas. Os exemplos de resposta usam dados fictícios com a estrutura real devolvida pela API.\_

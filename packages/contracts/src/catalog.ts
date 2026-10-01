import type { ZodTypeAny } from 'zod';

import {
  athenasRawOutput,
  chassiConsultaInput,
  cnpjBasicoInput,
  cnpjFuncionariosInput,
  cpfCadsusInput,
  cpfDetranInput,
  cpfIntelligentInput,
  cpfObitoInput,
  cpfParentesInput,
  cpfRaisInput,
  cpfScoreInput,
  dominioWhoisInput,
  emailReversoInput,
  enderecoConsultaInput,
  ipGeolocalizacaoInput,
  irpfCpfInput,
  loginsVazadosInput,
  nomeAbreviadoInput,
  nomeCompletoInput,
  pisPasepInput,
  placaBasicoInput,
  renavamConsultaInput,
  sptransCpfInput,
  telefoneReversoInput,
} from './modules/athenas.js';
import { cpfBasicoInput, cpfBasicoOutput } from './modules/cpf-basico.js';
import { dossie360Input, dossie360Output } from './modules/dossie-360.js';
import { placeholderModuleInput, placeholderModuleOutput } from './modules/placeholders.js';

export type ModuleCategory = 'pessoais' | 'veiculares' | 'empresariais' | 'web';

export type ModuleContract = {
  slug: string;
  nome: string;
  categoria: ModuleCategory;
  tags: string[];
  descricao: string;
  destaque?: boolean;
  custoCreditos: number;
  mode: 'sync' | 'async';
  implemented: boolean;
  input: ZodTypeAny;
  output: ZodTypeAny;
};

type ModuleMetadata = Omit<ModuleContract, 'implemented' | 'input' | 'output'>;

function athenas(module: ModuleMetadata, input: ZodTypeAny): ModuleContract {
  return {
    ...module,
    implemented: true,
    input,
    output: athenasRawOutput,
  };
}

function placeholder(module: ModuleMetadata): ModuleContract {
  return {
    ...module,
    implemented: false,
    input: placeholderModuleInput,
    output: placeholderModuleOutput,
  };
}

export const MODULES: ModuleContract[] = [
  {
    slug: 'cpf-basico',
    nome: 'CPF Completo',
    categoria: 'pessoais',
    tags: ['CPF', 'pessoal'],
    descricao: 'Consulta informações cadastrais básicas associadas ao CPF.',
    custoCreditos: 1,
    mode: 'sync',
    implemented: true,
    input: cpfBasicoInput,
    output: cpfBasicoOutput,
  },
  {
    slug: 'dossie-360',
    nome: 'Dossiê 360',
    categoria: 'pessoais',
    tags: ['CPF', 'dossiê', 'especial'],
    descricao: 'Reúne um resumo de informações encontradas para um CPF.',
    destaque: true,
    custoCreditos: 1,
    mode: 'async',
    implemented: true,
    input: dossie360Input,
    output: dossie360Output,
  },
  athenas(
    {
      slug: 'cpf-cadsus',
      nome: 'CPF Cadsus',
      categoria: 'pessoais',
      tags: ['CPF', 'SUS'],
      descricao: 'Consulta o cadastro do CPF na base do SUS (CADSUS).',
      custoCreditos: 1,
      mode: 'sync',
    },
    cpfCadsusInput,
  ),
  athenas(
    {
      slug: 'cpf-intelligent',
      nome: 'CPF Intelligent',
      categoria: 'pessoais',
      tags: ['CPF', 'perfil', 'risco'],
      descricao: 'Consulta emprego, empresas, benefícios, vizinhos e indicadores de risco do CPF.',
      custoCreditos: 1,
      mode: 'async',
    },
    cpfIntelligentInput,
  ),
  athenas(
    {
      slug: 'cpf-obito',
      nome: 'Óbito por CPF',
      categoria: 'pessoais',
      tags: ['CPF', 'óbito'],
      descricao: 'Verifica a situação de vivo ou falecido associada ao CPF.',
      custoCreditos: 1,
      mode: 'sync',
    },
    cpfObitoInput,
  ),
  athenas(
    {
      slug: 'cpf-parentes',
      nome: 'Vínculos por CPF',
      categoria: 'pessoais',
      tags: ['CPF', 'vínculos'],
      descricao: 'Pesquisa a rede familiar do CPF e o grau de parentesco.',
      custoCreditos: 1,
      mode: 'async',
    },
    cpfParentesInput,
  ),
  athenas(
    {
      slug: 'cpf-score',
      nome: 'Indicadores por CPF',
      categoria: 'pessoais',
      tags: ['CPF', 'indicadores'],
      descricao: 'Consulta score, renda, processos e patrimônio associados ao CPF.',
      custoCreditos: 1,
      mode: 'sync',
    },
    cpfScoreInput,
  ),
  athenas(
    {
      slug: 'cpf-detran',
      nome: 'CPF DETRAN',
      categoria: 'pessoais',
      tags: ['CPF', 'CNH', 'DETRAN'],
      descricao: 'Consulta dados de habilitação do condutor pelo CPF.',
      custoCreditos: 1,
      mode: 'sync',
    },
    cpfDetranInput,
  ),
  athenas(
    {
      slug: 'sptrans-cpf',
      nome: 'SPTrans por CPF',
      categoria: 'pessoais',
      tags: ['CPF', 'SPTrans'],
      descricao: 'Consulta o cadastro do CPF no Bilhete Único e na SPTrans.',
      custoCreditos: 1,
      mode: 'sync',
    },
    sptransCpfInput,
  ),
  athenas(
    {
      slug: 'cpf-rais',
      nome: 'RAIS por CPF',
      categoria: 'pessoais',
      tags: ['CPF', 'RAIS', 'trabalho'],
      descricao: 'Consulta o histórico de vínculos empregatícios do CPF na RAIS.',
      custoCreditos: 1,
      mode: 'sync',
    },
    cpfRaisInput,
  ),
  athenas(
    {
      slug: 'pis-pasep',
      nome: 'PIS/PASEP',
      categoria: 'pessoais',
      tags: ['PIS', 'PASEP', 'trabalho'],
      descricao: 'Resolve o trabalhador e seus vínculos a partir do PIS, PASEP ou NIT.',
      custoCreditos: 1,
      mode: 'sync',
    },
    pisPasepInput,
  ),
  athenas(
    {
      slug: 'irpf-cpf',
      nome: 'IRPF por CPF',
      categoria: 'pessoais',
      tags: ['CPF', 'IRPF', 'fiscal'],
      descricao: 'Consulta a situação das declarações de IRPF do CPF por ano.',
      custoCreditos: 1,
      mode: 'sync',
    },
    irpfCpfInput,
  ),
  placeholder({
    slug: 'cpf-endereco',
    nome: 'Endereço por CPF',
    categoria: 'pessoais',
    tags: ['CPF', 'endereço'],
    descricao: 'Pesquisa endereços associados ao CPF informado.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'cpf-telefones',
    nome: 'Telefones por CPF',
    categoria: 'pessoais',
    tags: ['CPF', 'telefone'],
    descricao: 'Pesquisa telefones associados ao CPF informado.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'cpf-processos',
    nome: 'Processos por CPF',
    categoria: 'pessoais',
    tags: ['CPF', 'processos'],
    descricao: 'Pesquisa registros processuais associados ao CPF informado.',
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'cpf-renda',
    nome: 'Renda por CPF',
    categoria: 'pessoais',
    tags: ['CPF', 'renda'],
    descricao: 'Consulta indicadores cadastrais de renda associados ao CPF.',
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'cpf-beneficios',
    nome: 'Benefícios por CPF',
    categoria: 'pessoais',
    tags: ['CPF', 'benefícios'],
    descricao: 'Pesquisa registros de benefícios associados ao CPF informado.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  athenas(
    {
      slug: 'placa-basico',
      nome: 'Veículo por Placa',
      categoria: 'veiculares',
      tags: ['placa', 'veículo'],
      descricao: 'Consulta o veículo completo pela placa.',
      custoCreditos: 1,
      mode: 'sync',
    },
    placaBasicoInput,
  ),
  athenas(
    {
      slug: 'chassi-consulta',
      nome: 'Consulta por Chassi',
      categoria: 'veiculares',
      tags: ['chassi', 'veículo'],
      descricao: 'Consulta a ficha do veículo pelo número do chassi (VIN).',
      custoCreditos: 1,
      mode: 'sync',
    },
    chassiConsultaInput,
  ),
  athenas(
    {
      slug: 'renavam-consulta',
      nome: 'Consulta RENAVAM',
      categoria: 'veiculares',
      tags: ['RENAVAM', 'veículo'],
      descricao: 'Consulta a ficha do veículo pelo RENAVAM.',
      custoCreditos: 1,
      mode: 'sync',
    },
    renavamConsultaInput,
  ),
  placeholder({
    slug: 'placa-completa',
    nome: 'Dossiê Veicular',
    categoria: 'veiculares',
    tags: ['placa', 'veículo', 'especial'],
    descricao: 'Reúne informações veiculares relacionadas à placa consultada.',
    destaque: true,
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'placa-leilao',
    nome: 'Histórico de Leilão',
    categoria: 'veiculares',
    tags: ['placa', 'leilão'],
    descricao: 'Pesquisa registros de leilão associados ao veículo.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'placa-multas',
    nome: 'Multas por Placa',
    categoria: 'veiculares',
    tags: ['placa', 'multas'],
    descricao: 'Pesquisa registros de multas associados ao veículo.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'placa-restricoes',
    nome: 'Restrições por Placa',
    categoria: 'veiculares',
    tags: ['placa', 'restrições'],
    descricao: 'Pesquisa restrições cadastrais associadas ao veículo.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'placa-proprietario',
    nome: 'Proprietário por Placa',
    categoria: 'veiculares',
    tags: ['placa', 'proprietário'],
    descricao: 'Consulta informações de titularidade associadas ao veículo.',
    custoCreditos: 1,
    mode: 'async',
  }),
  athenas(
    {
      slug: 'cnpj-basico',
      nome: 'CNPJ Completo',
      categoria: 'empresariais',
      tags: ['CNPJ', 'empresa'],
      descricao: 'Consulta o cadastro completo de uma empresa pelo CNPJ.',
      custoCreditos: 1,
      mode: 'sync',
    },
    cnpjBasicoInput,
  ),
  athenas(
    {
      slug: 'cnpj-funcionarios',
      nome: 'Funcionários por CNPJ',
      categoria: 'empresariais',
      tags: ['CNPJ', 'funcionários', 'RAIS'],
      descricao: 'Consulta a folha de funcionários declarada na RAIS para o estabelecimento.',
      custoCreditos: 1,
      mode: 'sync',
    },
    cnpjFuncionariosInput,
  ),
  placeholder({
    slug: 'cnpj-completo',
    nome: 'Dossiê Empresarial',
    categoria: 'empresariais',
    tags: ['CNPJ', 'empresa', 'especial'],
    descricao: 'Reúne informações cadastrais e públicas relacionadas à empresa.',
    destaque: true,
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'cnpj-socios',
    nome: 'Quadro Societário',
    categoria: 'empresariais',
    tags: ['CNPJ', 'sócios'],
    descricao: 'Consulta dados do quadro societário cadastrado para a empresa.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'cnpj-endereco',
    nome: 'Endereço por CNPJ',
    categoria: 'empresariais',
    tags: ['CNPJ', 'endereço'],
    descricao: 'Consulta endereços cadastrais associados ao CNPJ informado.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'cnpj-processos',
    nome: 'Processos por CNPJ',
    categoria: 'empresariais',
    tags: ['CNPJ', 'processos'],
    descricao: 'Pesquisa registros processuais associados ao CNPJ informado.',
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'cnpj-protestos',
    nome: 'Protestos por CNPJ',
    categoria: 'empresariais',
    tags: ['CNPJ', 'protestos'],
    descricao: 'Pesquisa registros de protestos associados à empresa.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'cnpj-simples-nacional',
    nome: 'Regime Tributário',
    categoria: 'empresariais',
    tags: ['CNPJ', 'Simples Nacional'],
    descricao: 'Consulta informações públicas de enquadramento tributário da empresa.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  athenas(
    {
      slug: 'email-reverso',
      nome: 'Busca Reversa por E-mail',
      categoria: 'web',
      tags: ['e-mail', 'web'],
      descricao: 'Pesquisa referências públicas associadas ao e-mail informado.',
      custoCreditos: 1,
      mode: 'async',
    },
    emailReversoInput,
  ),
  athenas(
    {
      slug: 'telefone-reverso',
      nome: 'Busca Reversa por Telefone',
      categoria: 'web',
      tags: ['telefone', 'web'],
      descricao: 'Pesquisa referências públicas associadas ao telefone informado.',
      custoCreditos: 1,
      mode: 'async',
    },
    telefoneReversoInput,
  ),
  athenas(
    {
      slug: 'nome-abreviado',
      nome: 'Busca por Nome Abreviado',
      categoria: 'pessoais',
      tags: ['nome', 'pessoal'],
      descricao: 'Pesquisa pessoas por nome parcial ou abreviado, com paginação.',
      custoCreditos: 1,
      mode: 'sync',
    },
    nomeAbreviadoInput,
  ),
  athenas(
    {
      slug: 'nome-completo',
      nome: 'Busca por Nome Completo',
      categoria: 'pessoais',
      tags: ['nome', 'pessoal'],
      descricao: 'Pesquisa pessoas por nome completo, com paginação.',
      custoCreditos: 1,
      mode: 'sync',
    },
    nomeCompletoInput,
  ),
  athenas(
    {
      slug: 'endereco-consulta',
      nome: 'Consulta por Endereço',
      categoria: 'pessoais',
      tags: ['endereço', 'pessoal'],
      descricao: 'Pesquisa pessoas que moram ou moraram no endereço informado.',
      custoCreditos: 1,
      mode: 'sync',
    },
    enderecoConsultaInput,
  ),
  placeholder({
    slug: 'usuario-redes-sociais',
    nome: 'Busca por Usuário',
    categoria: 'web',
    tags: ['usuário', 'redes sociais'],
    descricao: 'Pesquisa perfis públicos que correspondem ao usuário informado.',
    custoCreditos: 1,
    mode: 'async',
  }),
  athenas(
    {
      slug: 'dominio-whois',
      nome: 'Consulta de Domínio',
      categoria: 'web',
      tags: ['domínio', 'WHOIS'],
      descricao: 'Consulta o WHOIS e os registros DNS de um domínio.',
      custoCreditos: 1,
      mode: 'sync',
    },
    dominioWhoisInput,
  ),
  athenas(
    {
      slug: 'ip-geolocalizacao',
      nome: 'Geolocalização de IP',
      categoria: 'web',
      tags: ['IP', 'geolocalização'],
      descricao: 'Consulta geolocalização, ISP, ASN e classificação de risco de um IP.',
      custoCreditos: 1,
      mode: 'sync',
    },
    ipGeolocalizacaoInput,
  ),
  athenas(
    {
      slug: 'logins-vazados',
      nome: 'Logins Vazados',
      categoria: 'web',
      tags: ['credenciais', 'vazamentos', 'web'],
      descricao: 'Pesquisa credenciais vazadas por URL, e-mail, CPF ou padrão.',
      custoCreditos: 1,
      mode: 'sync',
    },
    loginsVazadosInput,
  ),
];

export function getModule(slug: string): ModuleContract | undefined {
  return MODULES.find((module) => module.slug === slug);
}

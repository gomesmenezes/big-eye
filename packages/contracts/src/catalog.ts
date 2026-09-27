import type { ZodTypeAny } from 'zod';

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

type PlaceholderModule = Omit<ModuleContract, 'implemented' | 'input' | 'output'>;

function placeholder(module: PlaceholderModule): ModuleContract {
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
  placeholder({
    slug: 'cpf-cadsus',
    nome: 'CPF Cadsus',
    categoria: 'pessoais',
    tags: ['CPF', 'SUS'],
    descricao: 'Consulta cadastral relacionada ao CPF e ao Cadsus.',
    custoCreditos: 1,
    mode: 'sync',
  }),
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
    slug: 'cpf-parentes',
    nome: 'Vínculos por CPF',
    categoria: 'pessoais',
    tags: ['CPF', 'vínculos'],
    descricao: 'Pesquisa vínculos cadastrais associados ao CPF informado.',
    custoCreditos: 1,
    mode: 'async',
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
  placeholder({
    slug: 'cpf-score',
    nome: 'Indicadores por CPF',
    categoria: 'pessoais',
    tags: ['CPF', 'indicadores'],
    descricao: 'Consulta indicadores cadastrais associados ao CPF informado.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'placa-basico',
    nome: 'Veículo por Placa',
    categoria: 'veiculares',
    tags: ['placa', 'veículo'],
    descricao: 'Consulta dados básicos de um veículo pela placa.',
    custoCreditos: 1,
    mode: 'sync',
  }),
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
  placeholder({
    slug: 'renavam-consulta',
    nome: 'Consulta RENAVAM',
    categoria: 'veiculares',
    tags: ['RENAVAM', 'veículo'],
    descricao: 'Pesquisa informações cadastrais de um veículo pelo RENAVAM.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'chassi-consulta',
    nome: 'Consulta por Chassi',
    categoria: 'veiculares',
    tags: ['chassi', 'veículo'],
    descricao: 'Pesquisa informações cadastrais de um veículo pelo chassi.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'cnpj-basico',
    nome: 'CNPJ Completo',
    categoria: 'empresariais',
    tags: ['CNPJ', 'empresa'],
    descricao: 'Consulta informações cadastrais básicas de uma empresa pelo CNPJ.',
    custoCreditos: 1,
    mode: 'sync',
  }),
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
  placeholder({
    slug: 'telefone-reverso',
    nome: 'Busca Reversa por Telefone',
    categoria: 'web',
    tags: ['telefone', 'web'],
    descricao: 'Pesquisa referências públicas associadas ao telefone informado.',
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'email-reverso',
    nome: 'Busca Reversa por E-mail',
    categoria: 'web',
    tags: ['e-mail', 'web'],
    descricao: 'Pesquisa referências públicas associadas ao e-mail informado.',
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'usuario-redes-sociais',
    nome: 'Busca por Usuário',
    categoria: 'web',
    tags: ['usuário', 'redes sociais'],
    descricao: 'Pesquisa perfis públicos que correspondem ao usuário informado.',
    custoCreditos: 1,
    mode: 'async',
  }),
  placeholder({
    slug: 'dominio-whois',
    nome: 'Consulta de Domínio',
    categoria: 'web',
    tags: ['domínio', 'WHOIS'],
    descricao: 'Consulta informações públicas de registro de um domínio.',
    custoCreditos: 1,
    mode: 'sync',
  }),
  placeholder({
    slug: 'ip-geolocalizacao',
    nome: 'Geolocalização de IP',
    categoria: 'web',
    tags: ['IP', 'geolocalização'],
    descricao: 'Consulta dados aproximados associados a um endereço IP.',
    custoCreditos: 1,
    mode: 'sync',
  }),
];

export function getModule(slug: string): ModuleContract | undefined {
  return MODULES.find((module) => module.slug === slug);
}

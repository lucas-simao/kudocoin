// What Kudocoin says in Slack, in the giver's language (docs/decisions/slack.md). Portuguese is the source;
// English and Spanish are typed by it, so every language has every sentence. {{name}} is filled in, already
// escaped for Slack by whoever fills it.

export type SlackLang = 'pt-BR' | 'en' | 'es'

const ptBR = {
  notConnected: 'Este Slack ainda não está ligado a uma organização do Kudocoin. Um admin liga em Configurações → Slack.',
  connect: 'Para dar moedas pelo Slack, ligue sua conta do Kudocoin uma vez. O link vale 15 minutos e só você o vê.',
  connectButton: 'Ligar minha conta',
  usage: 'Use `/kudos @pessoa [quantidade] motivo`, por exemplo `/kudos @ana 2 revisou meu PR`.',
  receiverNotLinked: '{{receiver}} ainda não ligou a conta do Kudocoin. Quando digitar `/kudos` no Slack, recebe o link. Nada foi gasto.',
  gave: '{{giver}} deu {{n}} {{coin}} para {{receiver}}',
  gaveReason: '{{giver}} deu {{n}} {{coin}} para {{receiver}}: {{reason}}',
  balance: '{{receiver}} soma {{balance}} {{coin}} nesta temporada.',
  youGave: 'Você deu {{n}} {{coin}} para {{receiver}}. Hoje ainda pode dar {{left}}.',
  failed: 'Algo deu errado do nosso lado. Tente de novo.',
  errors: {
    self_give: 'Você não pode dar moedas para si mesmo.',
    not_a_member: 'Essa pessoa não está na organização.',
    not_found: 'Você não está mais na organização ligada a este Slack.',
    amount_invalid: 'Escolha de 1 a {{max}}.',
    reason_required: 'Escreva um motivo depois da quantidade.',
    reason_too_long: 'O motivo pode ter até {{max}} caracteres.',
    allowance_exceeded: 'Hoje você só pode dar mais {{left}}.',
    receiver_limit_exceeded: 'Essa pessoa só pode receber mais {{left}} hoje.',
    season_closed: 'Esta temporada está fechada.',
    too_many_requests: 'Muitas tentativas seguidas. Espere um minuto.',
  },
}

export type SlackMessages = typeof ptBR
export type SlackError = keyof SlackMessages['errors']

const en: SlackMessages = {
  notConnected: 'This Slack is not connected to a Kudocoin organization yet. An admin connects it in Settings → Slack.',
  connect: 'To give coins from Slack, connect your Kudocoin account once. The link works for 15 minutes and only you can see it.',
  connectButton: 'Connect my account',
  usage: 'Use `/kudos @person [amount] reason`, for example `/kudos @ana 2 reviewed my PR`.',
  receiverNotLinked: '{{receiver}} has not connected their Kudocoin account yet. When they type `/kudos` in Slack, they get the link. Nothing was spent.',
  gave: '{{giver}} gave {{n}} {{coin}} to {{receiver}}',
  gaveReason: '{{giver}} gave {{n}} {{coin}} to {{receiver}}: {{reason}}',
  balance: '{{receiver}} has {{balance}} {{coin}} this season.',
  youGave: 'You gave {{n}} {{coin}} to {{receiver}}. You can give {{left}} more today.',
  failed: 'Something went wrong on our side. Try again.',
  errors: {
    self_give: 'You cannot give coins to yourself.',
    not_a_member: 'This person is not in the organization.',
    not_found: 'You are no longer in the organization connected to this Slack.',
    amount_invalid: 'Pick from 1 to {{max}}.',
    reason_required: 'Write a reason after the amount.',
    reason_too_long: 'The reason can be up to {{max}} characters.',
    allowance_exceeded: 'You can only give {{left}} more today.',
    receiver_limit_exceeded: 'This person can only receive {{left}} more today.',
    season_closed: 'This season is closed.',
    too_many_requests: 'Too many tries in a row. Wait a minute.',
  },
}

const es: SlackMessages = {
  notConnected: 'Este Slack todavía no está conectado a una organización de Kudocoin. Un admin lo conecta en Configuración → Slack.',
  connect: 'Para dar monedas desde Slack, conecta tu cuenta de Kudocoin una vez. El enlace sirve 15 minutos y solo tú lo ves.',
  connectButton: 'Conectar mi cuenta',
  usage: 'Usa `/kudos @persona [cantidad] motivo`, por ejemplo `/kudos @ana 2 revisó mi PR`.',
  receiverNotLinked: '{{receiver}} todavía no conectó su cuenta de Kudocoin. Cuando escriba `/kudos` en Slack, recibe el enlace. No se gastó nada.',
  gave: '{{giver}} dio {{n}} {{coin}} a {{receiver}}',
  gaveReason: '{{giver}} dio {{n}} {{coin}} a {{receiver}}: {{reason}}',
  balance: '{{receiver}} suma {{balance}} {{coin}} en esta temporada.',
  youGave: 'Diste {{n}} {{coin}} a {{receiver}}. Hoy todavía puedes dar {{left}}.',
  failed: 'Algo salió mal de nuestro lado. Inténtalo de nuevo.',
  errors: {
    self_give: 'No puedes darte monedas a ti mismo.',
    not_a_member: 'Esta persona no está en la organización.',
    not_found: 'Ya no estás en la organización conectada a este Slack.',
    amount_invalid: 'Elige de 1 a {{max}}.',
    reason_required: 'Escribe un motivo después de la cantidad.',
    reason_too_long: 'El motivo puede tener hasta {{max}} caracteres.',
    allowance_exceeded: 'Hoy solo puedes dar {{left}} más.',
    receiver_limit_exceeded: 'Esta persona solo puede recibir {{left}} más hoy.',
    season_closed: 'Esta temporada está cerrada.',
    too_many_requests: 'Demasiados intentos seguidos. Espera un minuto.',
  },
}

export const SLACK_MESSAGES: Record<SlackLang, SlackMessages> = { 'pt-BR': ptBR, en, es }

export function slackLang(value: unknown): SlackLang {
  return value === 'pt-BR' || value === 'es' ? value : 'en'
}

export function fill(text: string, vars: Record<string, string | number> = {}): string {
  return text.replace(/\{\{(\w+)\}\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole))
}

export function isSlackError(code: string): code is SlackError {
  return code in ptBR.errors
}

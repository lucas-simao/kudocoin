// What Kudocoin says in Slack, in the giver's language (docs/decisions/slack.md). Portuguese is the source;
// English and Spanish are typed by it, so every language has every sentence. {{name}} is filled in, already
// escaped for Slack by whoever fills it.

export type SlackLang = 'pt-BR' | 'en' | 'es'

const ptBR = {
  notConnected: 'Este Slack ainda não está ligado a uma organização do Kudocoin. Um admin liga em Configurações → Slack.',
  connect: 'Para dar moedas pelo Slack, ligue sua conta do Kudocoin uma vez. O link vale 15 minutos e só você o vê.',
  connectButton: 'Ligar minha conta',
  help: [
    '*Comandos do Kudocoin*',
    '• `/kudos @pessoa [quantidade] motivo` dá moedas, por exemplo `/kudos @ana 2 revisou meu PR`. Sem quantidade, dá 1.',
    '• `/kudos summary` mostra o placar da temporada e quanto você ainda pode dar hoje. Só você vê.',
    '• `/kudos summary share` mostra o placar no canal, para todo mundo.',
    '• `/kudos help` mostra esta lista.',
    '<{{url}}|Abrir o Kudocoin>',
  ].join('\n'),
  unknown: 'Não entendi esse comando.',
  summaryTitle: '*{{org}}* · Temporada {{n}}',
  summaryEnds: 'Termina em {{date}}',
  summaryPrize: 'Prêmio: {{prize}}',
  summaryEmpty: 'Ninguém recebeu moedas nesta temporada ainda.',
  summaryMore: '…e mais {{n}}.',
  summaryYou: 'Você está em {{place}}º lugar, com {{balance}} {{coin}}. Hoje ainda pode dar {{left}}.',
  summaryYouNone: 'Você ainda não recebeu moedas nesta temporada. Hoje ainda pode dar {{left}}.',
  summaryLink: '<{{url}}|Ver o placar completo>',
  formerMember: 'Ex-membro',
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
  help: [
    '*Kudocoin commands*',
    '• `/kudos @person [amount] reason` gives coins, for example `/kudos @ana 2 reviewed my PR`. Without an amount, it gives 1.',
    '• `/kudos summary` shows the season’s leaderboard and how many you can still give today. Only you see it.',
    '• `/kudos summary share` shows the leaderboard in the channel, for everyone.',
    '• `/kudos help` shows this list.',
    '<{{url}}|Open Kudocoin>',
  ].join('\n'),
  unknown: 'I did not understand that command.',
  summaryTitle: '*{{org}}* · Season {{n}}',
  summaryEnds: 'Ends on {{date}}',
  summaryPrize: 'Prize: {{prize}}',
  summaryEmpty: 'Nobody has received coins this season yet.',
  summaryMore: '…and {{n}} more.',
  summaryYou: 'You are #{{place}} with {{balance}} {{coin}}. You can give {{left}} more today.',
  summaryYouNone: 'You have not received coins this season yet. You can give {{left}} more today.',
  summaryLink: '<{{url}}|See the full leaderboard>',
  formerMember: 'Former member',
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
  help: [
    '*Comandos de Kudocoin*',
    '• `/kudos @persona [cantidad] motivo` da monedas, por ejemplo `/kudos @ana 2 revisó mi PR`. Sin cantidad, da 1.',
    '• `/kudos summary` muestra el marcador de la temporada y cuántas puedes dar todavía hoy. Solo tú lo ves.',
    '• `/kudos summary share` muestra el marcador en el canal, para todos.',
    '• `/kudos help` muestra esta lista.',
    '<{{url}}|Abrir Kudocoin>',
  ].join('\n'),
  unknown: 'No entendí ese comando.',
  summaryTitle: '*{{org}}* · Temporada {{n}}',
  summaryEnds: 'Termina el {{date}}',
  summaryPrize: 'Premio: {{prize}}',
  summaryEmpty: 'Nadie ha recibido monedas en esta temporada todavía.',
  summaryMore: '…y {{n}} más.',
  summaryYou: 'Estás en el puesto {{place}}, con {{balance}} {{coin}}. Hoy todavía puedes dar {{left}}.',
  summaryYouNone: 'Todavía no recibiste monedas en esta temporada. Hoy todavía puedes dar {{left}}.',
  summaryLink: '<{{url}}|Ver el marcador completo>',
  formerMember: 'Exmiembro',
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

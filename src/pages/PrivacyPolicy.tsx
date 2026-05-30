import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalLayout, { type LegalSection } from './legal/LegalLayout';

const CONTACT = 'prince.neres@simplifytec.com.br';
const EFFECTIVE = '2026-05-30';

const EN: { title: string; updated: string; back: string; sections: LegalSection[] } = {
  title: 'Privacy Policy',
  updated: `Last updated: ${EFFECTIVE}`,
  back: 'Back',
  sections: [
    {
      heading: 'Overview',
      body: [
        'Flash Learn is a spaced-repetition flashcard app that helps you study and remember what you learn. This Privacy Policy explains what information we collect, why we collect it, and how you can control it. Flash Learn is operated by Prince Neres.',
        'By using Flash Learn at https://flashlearn.princeneres.dev you agree to the practices described here.',
      ],
    },
    {
      heading: 'Information we collect',
      body: [
        'We only collect what is needed to run the app:',
        [
          'Account information — when you sign in with Google, we receive your name, email address, and profile picture. When you sign up with email, we store your email address. Authentication is handled by Supabase.',
          'Your content — the decks, flashcards, and study notes you create.',
          'Study activity — review history, scheduling data, streaks, and statistics used to power spaced repetition and your progress charts.',
        ],
      ],
    },
    {
      heading: 'How we use your information',
      body: [
        'We use the information above to:',
        [
          'Create and secure your account and let you sign in.',
          'Store and sync your decks and flashcards across your devices.',
          'Calculate review schedules, streaks, leaderboards, and statistics.',
          'Operate, maintain, and improve the app.',
        ],
        'We do not sell your personal data, and we do not use it for advertising.',
      ],
    },
    {
      heading: 'Google user data',
      body: [
        'When you sign in with Google we request only your basic profile (name, email, and picture) to create and identify your account. We do not access your Gmail, Drive, contacts, or any other Google service. Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.',
      ],
    },
    {
      heading: 'AI deck generation',
      body: [
        'AI-assisted deck generation is optional. If you choose to use it, you provide your own API key for a third-party AI provider (Anthropic or OpenAI). That key is stored only in your browser (local storage) and never sent to our servers. The topics you submit for generation are sent directly from your browser to the provider you selected and are subject to that provider’s privacy policy.',
      ],
    },
    {
      heading: 'Data storage and processing',
      body: [
        'Your account and content are stored using Supabase, our backend and database provider, which processes data on our behalf. We apply reasonable technical and organizational measures to protect your data.',
      ],
    },
    {
      heading: 'Data retention and deletion',
      body: [
        'We keep your data for as long as your account is active. You can delete individual decks and cards at any time from within the app. To delete your account and all associated data, contact us at the email below and we will remove it.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'Depending on your location, you may have the right to access, correct, export, or delete your personal data. To exercise these rights, contact us using the details below.',
      ],
    },
    {
      heading: "Children's privacy",
      body: [
        'Flash Learn is not directed to children under 13, and we do not knowingly collect personal information from them.',
      ],
    },
    {
      heading: 'Changes to this policy',
      body: [
        'We may update this Privacy Policy from time to time. When we do, we will revise the "Last updated" date above. Material changes will be communicated within the app.',
      ],
    },
    {
      heading: 'Contact us',
      body: [`If you have questions about this Privacy Policy, contact us at ${CONTACT}.`],
    },
  ],
};

const PT: { title: string; updated: string; back: string; sections: LegalSection[] } = {
  title: 'Política de Privacidade',
  updated: `Última atualização: ${EFFECTIVE}`,
  back: 'Voltar',
  sections: [
    {
      heading: 'Visão geral',
      body: [
        'O Flash Learn é um aplicativo de flashcards com repetição espaçada que ajuda você a estudar e memorizar o que aprende. Esta Política de Privacidade explica quais informações coletamos, por que as coletamos e como você pode controlá-las. O Flash Learn é operado por Prince Neres.',
        'Ao usar o Flash Learn em https://flashlearn.princeneres.dev, você concorda com as práticas descritas aqui.',
      ],
    },
    {
      heading: 'Informações que coletamos',
      body: [
        'Coletamos apenas o necessário para o funcionamento do app:',
        [
          'Dados da conta — ao entrar com o Google, recebemos seu nome, endereço de e-mail e foto de perfil. Ao se cadastrar com e-mail, armazenamos seu endereço de e-mail. A autenticação é feita pelo Supabase.',
          'Seu conteúdo — os baralhos, flashcards e notas de estudo que você cria.',
          'Atividade de estudo — histórico de revisões, dados de agendamento, sequências (streaks) e estatísticas usadas para a repetição espaçada e seus gráficos de progresso.',
        ],
      ],
    },
    {
      heading: 'Como usamos suas informações',
      body: [
        'Usamos as informações acima para:',
        [
          'Criar e proteger sua conta e permitir o login.',
          'Armazenar e sincronizar seus baralhos e flashcards entre seus dispositivos.',
          'Calcular agendamentos de revisão, sequências, rankings e estatísticas.',
          'Operar, manter e melhorar o aplicativo.',
        ],
        'Não vendemos seus dados pessoais e não os usamos para publicidade.',
      ],
    },
    {
      heading: 'Dados de usuário do Google',
      body: [
        'Ao entrar com o Google, solicitamos apenas seu perfil básico (nome, e-mail e foto) para criar e identificar sua conta. Não acessamos seu Gmail, Drive, contatos ou qualquer outro serviço do Google. O uso de informações recebidas das APIs do Google segue a Política de Dados do Usuário dos Serviços de API do Google, incluindo os requisitos de Uso Limitado.',
      ],
    },
    {
      heading: 'Geração de baralhos por IA',
      body: [
        'A geração de baralhos com auxílio de IA é opcional. Se você optar por usá-la, fornece sua própria chave de API de um provedor de IA terceiro (Anthropic ou OpenAI). Essa chave fica armazenada apenas no seu navegador (armazenamento local) e nunca é enviada aos nossos servidores. Os temas que você envia para geração vão diretamente do seu navegador para o provedor escolhido e estão sujeitos à política de privacidade desse provedor.',
      ],
    },
    {
      heading: 'Armazenamento e processamento de dados',
      body: [
        'Sua conta e seu conteúdo são armazenados usando o Supabase, nosso provedor de backend e banco de dados, que processa os dados em nosso nome. Aplicamos medidas técnicas e organizacionais razoáveis para proteger seus dados.',
      ],
    },
    {
      heading: 'Retenção e exclusão de dados',
      body: [
        'Mantemos seus dados enquanto sua conta estiver ativa. Você pode excluir baralhos e cartões individuais a qualquer momento dentro do app. Para excluir sua conta e todos os dados associados, entre em contato pelo e-mail abaixo e faremos a remoção.',
      ],
    },
    {
      heading: 'Seus direitos',
      body: [
        'Dependendo da sua localização, você pode ter o direito de acessar, corrigir, exportar ou excluir seus dados pessoais. Para exercer esses direitos, entre em contato pelos dados abaixo.',
      ],
    },
    {
      heading: 'Privacidade de crianças',
      body: [
        'O Flash Learn não se destina a crianças menores de 13 anos e não coletamos intencionalmente informações pessoais delas.',
      ],
    },
    {
      heading: 'Alterações nesta política',
      body: [
        'Podemos atualizar esta Política de Privacidade periodicamente. Quando isso acontecer, atualizaremos a data de "Última atualização" acima. Alterações relevantes serão comunicadas dentro do app.',
      ],
    },
    {
      heading: 'Fale conosco',
      body: [
        `Se tiver dúvidas sobre esta Política de Privacidade, entre em contato pelo ${CONTACT}.`,
      ],
    },
  ],
};

const PrivacyPolicy: React.FC = () => {
  const { i18n } = useTranslation();
  const c = i18n.language?.startsWith('pt') ? PT : EN;
  return (
    <LegalLayout
      title={c.title}
      updatedLabel={c.updated}
      backLabel={c.back}
      sections={c.sections}
    />
  );
};

export default PrivacyPolicy;

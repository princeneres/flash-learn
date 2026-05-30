import React from 'react';
import { useTranslation } from 'react-i18next';
import LegalLayout, { type LegalSection } from './legal/LegalLayout';

const CONTACT = 'prince.neres@simplifytec.com.br';
const EFFECTIVE = '2026-05-30';

const EN: { title: string; updated: string; back: string; sections: LegalSection[] } = {
  title: 'Terms of Service',
  updated: `Last updated: ${EFFECTIVE}`,
  back: 'Back',
  sections: [
    {
      heading: 'Acceptance of terms',
      body: [
        'These Terms of Service ("Terms") govern your use of Flash Learn, available at https://flashlearn.princeneres.dev and operated by Prince Neres. By creating an account or using the app, you agree to these Terms. If you do not agree, please do not use the app.',
      ],
    },
    {
      heading: 'The service',
      body: [
        'Flash Learn lets you create, organize, and study flashcards using spaced repetition, track your progress, and optionally generate decks with AI. The service is provided free of charge and may change over time.',
      ],
    },
    {
      heading: 'Your account',
      body: [
        'You are responsible for maintaining the security of your account and for all activity that happens under it. You must provide accurate information and promptly update it as needed. You must be at least 13 years old to use Flash Learn.',
      ],
    },
    {
      heading: 'Your content',
      body: [
        'You retain ownership of the decks, flashcards, and other content you create. You are responsible for that content and must have the rights to any material you upload. You grant us the limited permission needed to store, display, and sync your content so we can provide the service to you.',
        'Decks you choose to make public may be viewed and copied by other users.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'You agree not to:',
        [
          'Use the app for any unlawful purpose or to infringe the rights of others.',
          'Upload malicious code or attempt to disrupt or gain unauthorized access to the service.',
          'Abuse, harass, or harm other users, including through public content.',
        ],
      ],
    },
    {
      heading: 'Third-party AI services',
      body: [
        'If you use AI deck generation, you provide your own API key for a third-party provider (Anthropic or OpenAI). Your use of those providers is governed by their own terms, and you are responsible for any costs they charge. Flash Learn is not responsible for the accuracy of AI-generated content.',
      ],
    },
    {
      heading: 'Disclaimer and limitation of liability',
      body: [
        'The service is provided "as is" and "as available," without warranties of any kind. We do not guarantee that the service will be uninterrupted, error-free, or that your data will never be lost. To the maximum extent permitted by law, Flash Learn and its operator are not liable for any indirect, incidental, or consequential damages arising from your use of the service.',
      ],
    },
    {
      heading: 'Termination',
      body: [
        'You may stop using the app and request deletion of your account at any time. We may suspend or terminate accounts that violate these Terms.',
      ],
    },
    {
      heading: 'Changes to these terms',
      body: [
        'We may update these Terms from time to time. When we do, we will revise the "Last updated" date above. Continued use of the app after changes take effect means you accept the updated Terms.',
      ],
    },
    {
      heading: 'Contact us',
      body: [`If you have questions about these Terms, contact us at ${CONTACT}.`],
    },
  ],
};

const PT: { title: string; updated: string; back: string; sections: LegalSection[] } = {
  title: 'Termos de Serviço',
  updated: `Última atualização: ${EFFECTIVE}`,
  back: 'Voltar',
  sections: [
    {
      heading: 'Aceitação dos termos',
      body: [
        'Estes Termos de Serviço ("Termos") regem o uso do Flash Learn, disponível em https://flashlearn.princeneres.dev e operado por Prince Neres. Ao criar uma conta ou usar o app, você concorda com estes Termos. Se não concordar, não utilize o aplicativo.',
      ],
    },
    {
      heading: 'O serviço',
      body: [
        'O Flash Learn permite criar, organizar e estudar flashcards com repetição espaçada, acompanhar seu progresso e, opcionalmente, gerar baralhos com IA. O serviço é oferecido gratuitamente e pode mudar ao longo do tempo.',
      ],
    },
    {
      heading: 'Sua conta',
      body: [
        'Você é responsável por manter a segurança da sua conta e por toda atividade realizada nela. Deve fornecer informações precisas e mantê-las atualizadas. É necessário ter pelo menos 13 anos para usar o Flash Learn.',
      ],
    },
    {
      heading: 'Seu conteúdo',
      body: [
        'Você mantém a propriedade dos baralhos, flashcards e demais conteúdos que cria. Você é responsável por esse conteúdo e deve ter os direitos sobre qualquer material que enviar. Você nos concede a permissão limitada necessária para armazenar, exibir e sincronizar seu conteúdo, de modo que possamos prestar o serviço.',
        'Baralhos que você optar por tornar públicos poderão ser visualizados e copiados por outros usuários.',
      ],
    },
    {
      heading: 'Uso aceitável',
      body: [
        'Você concorda em não:',
        [
          'Usar o app para qualquer finalidade ilegal ou para violar direitos de terceiros.',
          'Enviar código malicioso ou tentar interromper ou acessar o serviço sem autorização.',
          'Abusar, assediar ou prejudicar outros usuários, inclusive por meio de conteúdo público.',
        ],
      ],
    },
    {
      heading: 'Serviços de IA de terceiros',
      body: [
        'Se usar a geração de baralhos por IA, você fornece sua própria chave de API de um provedor terceiro (Anthropic ou OpenAI). O uso desses provedores é regido pelos termos deles, e você é responsável por quaisquer custos cobrados. O Flash Learn não se responsabiliza pela exatidão do conteúdo gerado por IA.',
      ],
    },
    {
      heading: 'Isenção e limitação de responsabilidade',
      body: [
        'O serviço é fornecido "como está" e "conforme disponível", sem garantias de qualquer tipo. Não garantimos que o serviço será ininterrupto, livre de erros ou que seus dados nunca serão perdidos. Na máxima extensão permitida por lei, o Flash Learn e seu operador não se responsabilizam por danos indiretos, incidentais ou consequenciais decorrentes do uso do serviço.',
      ],
    },
    {
      heading: 'Encerramento',
      body: [
        'Você pode parar de usar o app e solicitar a exclusão da sua conta a qualquer momento. Podemos suspender ou encerrar contas que violem estes Termos.',
      ],
    },
    {
      heading: 'Alterações nestes termos',
      body: [
        'Podemos atualizar estes Termos periodicamente. Quando isso acontecer, atualizaremos a data de "Última atualização" acima. O uso contínuo do app após a vigência das alterações significa que você aceita os Termos atualizados.',
      ],
    },
    {
      heading: 'Fale conosco',
      body: [`Se tiver dúvidas sobre estes Termos, entre em contato pelo ${CONTACT}.`],
    },
  ],
};

const TermsOfService: React.FC = () => {
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

export default TermsOfService;

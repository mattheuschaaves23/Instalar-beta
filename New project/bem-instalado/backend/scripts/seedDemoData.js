const bcrypt = require('bcrypt');
const crypto = require('crypto');
const pool = require('../config/database');

const DEMO_EMAIL_PATTERN = 'demo.instalador.%@instalar.local';
const DEMO_PASSWORD = 'demo123456';

const demoInstallers = [
  {
    name: 'Matheus Chaves',
    businessName: 'InstaLar Home Premium',
    city: 'Florianópolis',
    state: 'SC',
    region: 'Grande Florianópolis',
    phone: '48999816000',
    bio: 'Especialista em instalação de papel de parede com acabamento fino e organização total da obra.',
    method: 'Aplicação seca com preparo técnico da parede e limpeza final.',
    days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
    serviceHours: '08:00 às 19:00',
    baseServiceCost: 55,
    travelFee: 25,
    yearsExperience: 11,
    featured: true,
    certified: true,
    certificateName: 'Certificação Profissional InstaLar',
    certificateFile: 'https://picsum.photos/seed/certificate-1/1200/800',
    installerPhoto: 'https://i.pravatar.cc/500?img=12',
    logo: 'https://picsum.photos/seed/logo-instalar-1/600/600',
    gallery: [
      'https://picsum.photos/seed/instalar-g1a/1200/850',
      'https://picsum.photos/seed/instalar-g1b/1200/850',
      'https://picsum.photos/seed/instalar-g1c/1200/850',
      'https://picsum.photos/seed/instalar-g1d/1200/850',
    ],
  },
  {
    name: 'Rafael Costa',
    businessName: 'Costa Wall Design',
    city: 'Palhoça',
    state: 'SC',
    region: 'Palhoça e São José',
    phone: '48999223344',
    bio: 'Atendimento rápido para residências e salas comerciais, com foco em durabilidade.',
    method: 'Medição técnica no local e aplicação por ambientes.',
    days: ['seg', 'ter', 'qua', 'qui', 'sex'],
    serviceHours: '09:00 às 18:00',
    baseServiceCost: 52,
    travelFee: 20,
    yearsExperience: 8,
    featured: true,
    certified: true,
    certificateName: 'Certificação Técnica em Revestimentos',
    certificateFile: 'https://picsum.photos/seed/certificate-2/1200/800',
    installerPhoto: 'https://i.pravatar.cc/500?img=15',
    logo: 'https://picsum.photos/seed/logo-instalar-2/600/600',
    gallery: [
      'https://picsum.photos/seed/instalar-g2a/1200/850',
      'https://picsum.photos/seed/instalar-g2b/1200/850',
      'https://picsum.photos/seed/instalar-g2c/1200/850',
      'https://picsum.photos/seed/instalar-g2d/1200/850',
    ],
  },
  {
    name: 'Bruno Almeida',
    businessName: 'Almeida Decor Instalações',
    city: 'São José',
    state: 'SC',
    region: 'São José e Biguaçu',
    phone: '48999112233',
    bio: 'Instalador com foco em ambientes infantis, salas e painéis personalizados.',
    method: 'Aplicação detalhada com inspeção de alinhamento em cada faixa.',
    days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
    serviceHours: '08:30 às 18:30',
    baseServiceCost: 50,
    travelFee: 18,
    yearsExperience: 6,
    featured: false,
    certified: true,
    certificateName: 'Curso Avançado em Papel de Parede',
    certificateFile: 'https://picsum.photos/seed/certificate-3/1200/800',
    installerPhoto: 'https://i.pravatar.cc/500?img=32',
    logo: 'https://picsum.photos/seed/logo-instalar-3/600/600',
    gallery: [
      'https://picsum.photos/seed/instalar-g3a/1200/850',
      'https://picsum.photos/seed/instalar-g3b/1200/850',
      'https://picsum.photos/seed/instalar-g3c/1200/850',
      'https://picsum.photos/seed/instalar-g3d/1200/850',
    ],
  },
  {
    name: 'André Luiz',
    businessName: 'Luiz Paper Pro',
    city: 'Blumenau',
    state: 'SC',
    region: 'Blumenau e região',
    phone: '47998556644',
    bio: 'Execução profissional com alto padrão de acabamento e pontualidade no cronograma.',
    method: 'Preparação completa da superfície + instalação com cola premium.',
    days: ['seg', 'ter', 'qua', 'qui', 'sex'],
    serviceHours: '08:00 às 17:30',
    baseServiceCost: 58,
    travelFee: 28,
    yearsExperience: 9,
    featured: true,
    certified: false,
    certificateName: '',
    certificateFile: '',
    installerPhoto: 'https://i.pravatar.cc/500?img=45',
    logo: 'https://picsum.photos/seed/logo-instalar-4/600/600',
    gallery: [
      'https://picsum.photos/seed/instalar-g4a/1200/850',
      'https://picsum.photos/seed/instalar-g4b/1200/850',
      'https://picsum.photos/seed/instalar-g4c/1200/850',
      'https://picsum.photos/seed/instalar-g4d/1200/850',
    ],
  },
  {
    name: 'Leandro Martins',
    businessName: 'Martins Wall Studio',
    city: 'Curitiba',
    state: 'PR',
    region: 'Curitiba e metropolitana',
    phone: '41999887766',
    bio: 'Serviço limpo e organizado para ambientes residenciais e corporativos.',
    method: 'Aplicação por etapas com conferência de padrão e recortes técnicos.',
    days: ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'],
    serviceHours: '09:00 às 19:00',
    baseServiceCost: 54,
    travelFee: 24,
    yearsExperience: 7,
    featured: false,
    certified: true,
    certificateName: 'Certificação de Instalação Decor Premium',
    certificateFile: 'https://picsum.photos/seed/certificate-5/1200/800',
    installerPhoto: 'https://i.pravatar.cc/500?img=56',
    logo: 'https://picsum.photos/seed/logo-instalar-5/600/600',
    gallery: [
      'https://picsum.photos/seed/instalar-g5a/1200/850',
      'https://picsum.photos/seed/instalar-g5b/1200/850',
      'https://picsum.photos/seed/instalar-g5c/1200/850',
      'https://picsum.photos/seed/instalar-g5d/1200/850',
    ],
  },
];

const reviewTemplates = [
  { name: 'Juliana M.', region: 'Florianópolis/SC', rating: 5, comment: 'Serviço impecável, acabamento perfeito e atendimento muito educado.' },
  { name: 'Ricardo P.', region: 'Palhoça/SC', rating: 5, comment: 'Chegou no horário e deixou tudo limpo. Resultado ficou excelente.' },
  { name: 'Fernanda S.', region: 'São José/SC', rating: 4, comment: 'Ótimo profissional, tirou minhas dúvidas e entregou o que combinamos.' },
  { name: 'Carlos T.', region: 'Blumenau/SC', rating: 5, comment: 'Instalação rápida e visual premium. Recomendo com tranquilidade.' },
  { name: 'Patrícia L.', region: 'Curitiba/PR', rating: 5, comment: 'Muito capricho no detalhe, o ambiente ficou lindo.' },
  { name: 'Mariana R.', region: 'Florianópolis/SC', rating: 4, comment: 'Boa comunicação e execução organizada do começo ao fim.' },
];

async function clearDemoData(client) {
  const { rows } = await client.query(`SELECT id FROM users WHERE email LIKE $1`, [DEMO_EMAIL_PATTERN]);
  const installerIds = rows.map((row) => row.id);

  if (installerIds.length) {
    await client.query(`DELETE FROM installer_reviews WHERE installer_id = ANY($1::INT[])`, [installerIds]);
    await client.query(`DELETE FROM users WHERE id = ANY($1::INT[])`, [installerIds]);
  }

  return installerIds.length;
}

async function seedDemoData() {
  const mode = process.argv.includes('--clear') ? 'clear' : 'seed';
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const removedCount = await clearDemoData(client);

    if (mode === 'clear') {
      await client.query('COMMIT');
      console.log(`Dados demo removidos com sucesso. Perfis apagados: ${removedCount}.`);
      return;
    }

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const insertedInstallers = [];

    for (let index = 0; index < demoInstallers.length; index += 1) {
      const installer = demoInstallers[index];
      const email = `demo.instalador.${index + 1}@instalar.local`;

      const installerInsert = await client.query(
        `
          INSERT INTO users (
            name,
            email,
            password,
            phone,
            business_name,
            city,
            state,
            service_region,
            bio,
            installation_method,
            installation_days,
            service_hours,
            base_service_cost,
            travel_fee,
            years_experience,
            public_profile,
            featured_installer,
            certification_verified,
            certificate_name,
            certificate_file,
            installer_photo,
            logo,
            installation_gallery,
            wallpaper_store_recommended,
            safety_notes
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::TEXT[], $12, $13, $14, $15,
            TRUE, $16, $17, $18, $19, $20, $21, $22::jsonb, TRUE, $23
          )
          RETURNING id, email, name
        `,
        [
          installer.name,
          email,
          passwordHash,
          installer.phone,
          installer.businessName,
          installer.city,
          installer.state,
          installer.region,
          installer.bio,
          installer.method,
          installer.days,
          installer.serviceHours,
          installer.baseServiceCost,
          installer.travelFee,
          installer.yearsExperience,
          installer.featured,
          installer.certified,
          installer.certificateName || null,
          installer.certificateFile || null,
          installer.installerPhoto,
          installer.logo,
          JSON.stringify(installer.gallery),
          'SEED_DEMO',
        ]
      );

      insertedInstallers.push(installerInsert.rows[0]);
    }

    let createdReviews = 0;
    for (let i = 0; i < insertedInstallers.length; i += 1) {
      const installer = insertedInstallers[i];
      const baseOffset = i % reviewTemplates.length;

      for (let j = 0; j < 4; j += 1) {
        const template = reviewTemplates[(baseOffset + j) % reviewTemplates.length];
        const fingerprint = crypto
          .createHash('sha256')
          .update(`seed-demo-${installer.id}-${template.name}-${j}-${Date.now()}`)
          .digest('hex');

        await client.query(
          `
            INSERT INTO installer_reviews (
              installer_id,
              reviewer_name,
              reviewer_region,
              rating,
              comment,
              reviewer_ip,
              reviewer_fingerprint
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `,
          [
            installer.id,
            template.name,
            template.region,
            template.rating,
            template.comment,
            `10.0.0.${(i + 1) * 10 + j}`,
            fingerprint,
          ]
        );

        createdReviews += 1;
      }
    }

    await client.query('COMMIT');

    console.log('Seed demo concluído com sucesso.');
    console.log(`Perfis fake criados: ${insertedInstallers.length}`);
    console.log(`Avaliações fake criadas: ${createdReviews}`);
    console.log(`Senha padrão para os perfis demo: ${DEMO_PASSWORD}`);
    console.log('E-mails criados:');
    insertedInstallers.forEach((installer) => {
      console.log(`- ${installer.email}`);
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Falha ao criar seed demo.');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDemoData();

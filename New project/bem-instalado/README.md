# Bem Instalado

Plataforma SaaS para instaladores de papel de parede, com identidade premium em tons de preto e dourado, operacao comercial, agenda, assinatura via PIX e preparo para deploy em producao.

## O que ja esta pronto

- Tela com visual premium, animacoes sutis e interface responsiva.
- Cadastro e login com JWT.
- Clientes, orcamentos, PDF, WhatsApp, agenda e notificacoes.
- Perfil com configuracoes comerciais e 2FA.
- Assinatura com PIX em modo manual ou automatico via Mercado Pago.
- Servidor pronto para servir o frontend em producao.
- Inicializacao automatica das tabelas do banco no start da aplicacao.
- Blueprint de deploy em [render.yaml](C:\Users\giete\OneDrive\Documentos\New project\bem-instalado\render.yaml).

## Rodar localmente

1. Crie os arquivos de ambiente:

```powershell
Copy-Item .\backend\.env.example .\backend\.env -Force
Copy-Item .\frontend\.env.example .\frontend\.env -Force
```

2. Configure o banco em [backend/.env](C:\Users\giete\OneDrive\Documentos\New project\bem-instalado\backend\.env).

3. Crie o banco e as tabelas:

```powershell
$env:PGPASSWORD='SUA_SENHA'
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d postgres -c "CREATE DATABASE bem_instalado;"
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d bem_instalado -f ".\backend\db\schema.sql"
```

4. Suba tudo:

```powershell
.\start.ps1 -Install
```

## Enderecos locais

- Site: `http://localhost:3000`
- API: `http://localhost:5000`
- Healthcheck: `http://localhost:5000/api/health`

## PIX automatico com Mercado Pago

Quando estas variaveis estiverem preenchidas em [backend/.env](C:\Users\giete\OneDrive\Documentos\New project\bem-instalado\backend\.env), o sistema deixa de depender do botao manual e passa a validar o pagamento automaticamente:

- `APP_URL`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PIX_EXPIRATION_MINUTES`
- `MERCADOPAGO_STATEMENT_DESCRIPTOR`
- `MERCADOPAGO_WEBHOOK_TOKEN` (recomendado para proteger o endpoint do webhook)

O fluxo fica assim:

- o backend cria o PIX no Mercado Pago
- o cliente paga
- o webhook do Mercado Pago chama `/api/subscriptions/webhook/mercadopago`
- a assinatura muda para `active` automaticamente

## Hardening ja aplicado

- Rate limit em login, cadastro, busca publica, avaliacoes e criacao de pagamento.
- Webhook do Mercado Pago com validacao de token opcional e deduplicacao de evento.
- Tabela de auditoria (`audit_logs`) para trilha das acoes administrativas e autenticacao.
- Tabela `payment_webhook_events` para evitar processamento duplicado de notificacoes.

Sem essas credenciais, o projeto continua operando no modo manual para voce nao ficar bloqueado.

## Publicar em producao

Use o guia em [GUIA-DEPLOY-RENDER.md](C:\Users\giete\OneDrive\Documentos\New project\bem-instalado\GUIA-DEPLOY-RENDER.md). O projeto ja esta preparado para:

- build automatico do frontend durante o deploy
- criacao automatica das tabelas ao subir o servico
- servidor Node servindo a aplicacao completa
- healthcheck para monitoramento
- Postgres gerenciado

## Observacao importante

Eu consigo deixar o codigo e os arquivos de deploy prontos sozinho. O que ainda depende de voce e entrar na plataforma de hospedagem, conectar repositorio, informar variaveis de ambiente e contratar um plano que nao entre em sleep.

# Guia de Deploy no Render

Este projeto ja esta preparado para subir em um unico servico Node no Render, servindo a API e o frontend juntos.

## Antes de publicar

Voce vai precisar de:

- conta no Render
- repositorio com este projeto no GitHub
- plano pago se quiser ficar 24 horas no ar sem sleep

## Arquivo ja pronto

O projeto possui [render.yaml](C:\Users\giete\OneDrive\Documentos\New project\bem-instalado\render.yaml), que cria:

- 1 banco Postgres gerenciado
- 1 web service Node

## Passo a passo

1. Envie a pasta `bem-instalado` para um repositorio no GitHub.
2. No Render, escolha a opcao para criar servicos a partir de Blueprint.
3. Aponte para o repositorio.
4. Confirme a criacao do banco e do web service.
5. Defina a variavel `FRONTEND_URL` com o dominio final do projeto.

## Variaveis importantes

- `NODE_ENV=production`
- `JWT_SECRET`
- `DATABASE_URL`
- `FRONTEND_URL`
- `APP_URL`
- `MERCADOPAGO_ACCESS_TOKEN`
- `MERCADOPAGO_PIX_EXPIRATION_MINUTES`
- `MERCADOPAGO_STATEMENT_DESCRIPTOR`

## Como este deploy funciona

- o Render executa `npm install && npm run build:web` dentro de `backend`
- isso instala o backend, instala o frontend e gera a pasta `frontend/build`
- no start, a aplicacao roda a inicializacao do banco antes de subir o servidor
- em producao, o Express serve a API e a interface pelo mesmo dominio

## Depois do primeiro deploy

Teste:

- `/api/health`
- cadastro
- login
- criacao de cliente
- geracao de orcamento
- pagamento PIX

## PIX automatico com Mercado Pago

Para a assinatura validar sozinha:

1. publique o projeto e copie a URL final
2. defina `APP_URL` com esse dominio
3. defina `MERCADOPAGO_ACCESS_TOKEN`
4. gere um PIX na tela de assinatura
5. o backend vai enviar `notification_url` para o Mercado Pago usando:

`APP_URL/api/subscriptions/webhook/mercadopago?source_news=webhooks`

Depois disso, quando o pagamento for aprovado, a assinatura passa a ser ativada automaticamente.

## O que ainda depende de voce

- criar conta no Render
- conectar o GitHub
- escolher o plano
- configurar dominio proprio, se quiser

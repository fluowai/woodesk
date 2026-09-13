# Deploy do Woodesk

O produto continua seguindo o empacotamento existente. O self-host instala imagens publicadas; não se deve introduzir `build` obrigatório no `docker-compose.prod.yml`.

Antes de publicar mudanças de schema:

1. aplicar a migration em ambiente de validação;
2. verificar o `baseline.sql` em modo install e update;
3. rodar as invariantes de banco/RLS;
4. atualizar o `MANIFEST.md`;
5. executar os checks de imagem quando o artefato de deploy for tocado.

As conexões de Google Business, WAHA, Meta, voz e demais providers devem ser configuradas por variáveis de ambiente e/ou conexões criptografadas existentes. Nunca incluir tokens em imagem, log ou bundle do navegador.

O comando de produção continua usando os dois arquivos de compose quando houver proxy externo:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.traefik.yml --env-file .env up -d app
```

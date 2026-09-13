# Instagram Studio e calendário editorial

## Estado

A migration `20260912140000_0237_woodesk_marketing_content` adiciona ativos editoriais e agendamento. Ela não duplica campanhas Meta Ads; publicação aprovada passa pelo worker `content_publish`.

Todo conteúdo criado por IA nasce como rascunho que exige aprovação humana. `context` preserva o contexto de organização, público, tom e objetivo usado na geração.

Publicação usa Meta Graph API/Instagram Messaging API após auditoria de escopo, credencial, limites e termos. O calendário é separado da fila de publicação: o item agenda o momento; o worker/provider executa a entrega.
## Rascunhos via API

`POST /api/v1/woodesk/content/drafts` persiste rascunhos editoriais com contexto de negócio, público, tom e objetivo. Para Instagram, a capacidade é protegida pela feature flag `instagram_studio`; outros canais usam `marketing_calendar`.

`GET /api/v1/woodesk/content/drafts` lista conteúdos com filtros opcionais por canal e status.

Todo rascunho nasce com `status=draft` e `requires_approval=true`. A rota de rascunho não publica no Meta nem aceita tokens do cliente: publicação ocorre somente após aprovação explícita, pelo worker e com credencial server-side.

As contas conectadas agora têm base segura em `instagram_accounts`: uma linha por organização/conta, token cifrado, RLS tenant-aware e coluna secreta inacessível ao frontend. O endpoint de status expõe apenas identificador, usuário, estado e expiração; o token nunca é devolvido.

O início e o callback OAuth usam estado HMAC com usuário/sessão e nonce de uso único. O callback troca o código exclusivamente no servidor e cifra o token com `fn_encrypt_oauth`. A UI permite selecionar uma conta Business conectada por rascunho; a organização é validada novamente no servidor antes de persistir a seleção.

O início e o callback também revalidam a feature flag `instagram_studio`; se ela for desligada durante o fluxo, o callback não grava a credencial.

Após a conexão, o callback projeta a conta de forma idempotente em `channel_sessions` como `provider='instagram_graph'`, usando a ponte da migration 0254 e uma referência própria para `instagram_accounts`. Isso prepara a timeline canônica sem reutilizar identificadores ou sessões do WhatsApp.

O endpoint `/api/v1/webhooks/instagram/:token` implementa o handshake `GET` da Meta com `META_WEBHOOK_VERIFY_TOKEN` e o `POST` assinado por `META_APP_SECRET`; eventos válidos são encaminhados ao inbox canônico, com identidade `instagram_identity` e idempotência por `external_id`.

Agentes podem responder por `POST /api/v1/woodesk/instagram/conversations/:id/reply`. A rota valida papel, tenant, feature flag e texto e enfileira `instagram_reply`; o token Meta é resolvido e decifrado exclusivamente no worker.

Conexão e desconexão geram os eventos de auditoria `woodesk.instagram_connected` e `woodesk.instagram_disconnected`.

Gestores podem consultar as contas conectadas e desconectá-las por `DELETE /api/v1/woodesk/instagram/accounts/:id`; a rota tenta revogar a autorização na Graph API, remove a credencial local mesmo quando a Meta está indisponível, mantém o escopo da organização e audita a ação.

Conteúdo aprovado pode ser publicado imediatamente pela UI: a rota transforma a ação em item de calendário com execução em aproximadamente um segundo e sempre entrega pelo worker `content_publish`, preservando retries e idempotência.

O Studio aceita os formatos `post`, `carousel`, `story`, `reel`, `caption` e `script`. O adapter Meta publica `post` com imagem única, `carousel` com 2–10 imagens, `story` com imagem e `reel` com vídeo; caption e script ficam como rascunho/agendamento e falham explicitamente até receberem adapters próprios.

O worker de publicação resolve a conta selecionada em `context.instagram_account_id`, sempre dentro da própria organização, decifra o token somente durante a execução com `fn_decrypt_oauth` e entrega a credencial ao adapter em memória. Sem seleção explícita, usa a conta conectada mais recentemente. Se a conta estiver expirada, revogada ou ausente, o item falha explicitamente como provider não configurado.

O callback também registra `expires_in` como `token_expires_at`; o worker exclui credenciais vencidas da resolução, evitando chamadas à Graph API com token expirado.

Um `manager` pode aprovar o conteúdo em `POST /api/v1/woodesk/content/:id/approve`. A aprovação grava `approved_by` e `approved_at`; ela não equivale a publicação.

Conteúdo aprovado pode ser agendado em `POST /api/v1/woodesk/content/:id/schedule`, com `scheduled_for` e `timezone`. O calendário grava o item como `scheduled`; o worker/provider `content_publish` entrega nos formatos suportados e falha explicitamente nos formatos sem adapter.

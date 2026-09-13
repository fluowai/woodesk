# Auditoria inicial de referências externas

Esta é a primeira parcela da auditoria externa. Nenhum código foi copiado.

| Projeto | O que realmente fornece | Licença observada | Decisão |
|---|---|---|---|
| `LeadGenerationTools/google-maps-extractor` | Extensão Chrome que extrai listagens e exporta CSV/XLSX; usa automação de navegador | Apache-2.0 | REFERENCE; não executar extensão/scraper no servidor sem revisão de Termos do Google e isolamento |
| `jhowbhz/maps-to-lead` | Conversão de resultados de mapas para JSON e envio por webhook | não confirmada na página auditada | REFERENCE; não incorporar código até licença ser confirmada |
| `googleapis/google-api-nodejs-client` | Cliente oficial Node.js com OAuth2, API keys e JWT para APIs Google | Apache-2.0 | PRIMARY candidate para integrações oficiais Google; ainda depende de escopos/API habilitados |
| `pipecat-ai/pipecat` | Framework Python para agentes de voz/multimodais em tempo real e multiagentes | BSD-2-Clause | COMPLEMENTARY; deve rodar como sidecar/serviço, não dentro de Route Handler Node |

O primeiro projeto explicita que a extração acontece no navegador e que a própria operação deve respeitar os Termos do Google e a legislação de proteção de dados. Isso é incompatível com ativar scraping server-side silencioso como provider padrão. O contrato interno permanece preparado para um provider autorizado, mas o registry não registra nenhum provider de produção ainda.

## Critério para os próximos projetos

Cada repositório será classificado em `PRIMARY`, `COMPLEMENTARY`, `FALLBACK`, `REFERENCE`, `DUPLICATE`, `INCOMPATIBLE`, `REJECTED_LICENSE` ou `REJECTED_SECURITY`, com licença e método de execução confirmados antes de qualquer dependência ou cópia.

## Fontes auditadas

- https://github.com/LeadGenerationTools/google-maps-extractor
- https://github.com/jhowbhz/maps-to-lead
- https://github.com/googleapis/google-api-nodejs-client
- https://github.com/pipecat-ai/pipecat

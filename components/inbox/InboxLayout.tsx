"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/hooks/i18n/useT";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/auth/AuthProvider";
import { estadoDaJanela, formatarDecorrido } from "@/lib/channels/janela";
import { JanelaFechadaAviso } from "@/components/inbox/JanelaFechadaAviso";
import { useClaimConversation } from "@/hooks/inbox/useClaimConversation";
import { useCloseConversation } from "@/hooks/inbox/useCloseConversation";
import { useMarkAsRead } from "@/hooks/inbox/useMarkAsRead";
import {
  useConversationsRealtime,
  type ConversationsFilters,
  type ConversationWithContact,
} from "@/hooks/inbox/useConversationsRealtime";
import { useConversation, isNotFound } from "@/hooks/inbox/useConversation";
import { ConversationList } from "./ConversationList";
import { InboxFilters, type InboxFiltersValue, type InboxTab } from "./InboxFilters";
import { ChatThread } from "./ChatThread";
import { Composer, type ComposerHandle } from "./Composer";
import { ConversationHeader } from "./ConversationHeader";
import { RetentionNotice } from "./RetentionNotice";
import { CRMSidePanel } from "./CRMSidePanel";
import type { Message as ConversationMensagem } from "@/lib/types/messaging";
import { InboxKeyboardShortcuts } from "./InboxKeyboardShortcuts";

import { ShortcutsHelpDialog } from "./ShortcutsHelpDialog";
import { OpenConversationProvider } from "@/hooks/notifications/OpenConversationContext";
// ADR-05: ícone de feature sai do mapa canônico, nunca do pacote direto.
import { CaretLeft, ChatCircle, IdentificationCard } from "@/lib/ui/icons";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { comandosDaFila } from "@/lib/inbox/comando-da-conversa";
import { useAutomaticoAtivo } from "@/hooks/ai/useAutomaticoAtivo";

/**
 * QUAL COLUNA APARECE NO CELULAR — as duas saem da MESMA pergunta.
 *
 * Abaixo do `md` só cabe uma coluna por vez, então a lista e a conversa se
 * alternam. O defeito que esta função existe para tornar impossível é as duas
 * decidirem por dados DIFERENTES: a lista somia com `selectedId` (o id) e a
 * conversa aparecia com `selectedConversation` (o objeto já carregado). Entre
 * uma coisa e a outra existe uma janela em que nenhuma das duas aparece — e
 * essa janela tem dois casos reais no telefone:
 *
 *   1. o deep-link `/inbox/<id>`, enquanto a busca única ainda responde;
 *   2. a conversa fora do acesso, que é estado PERMANENTE — e cuja mensagem
 *      ("Conversa não encontrada") ficava escondida junto, deixando o dono
 *      numa tela branca sem nem o botão de voltar.
 *
 * Com uma pergunta só, "as duas escondidas" deixa de ser representável.
 * `md:flex` em ambas: no desktop as duas colunas convivem e a regra não vale.
 */
export function colunasDoCelular(temSelecao: boolean): { lista: string; conversa: string } {
  return {
    lista: temSelecao ? "hidden md:flex" : "flex",
    conversa: temSelecao ? "flex" : "hidden md:flex",
  };
}

/**
 * O QUE CADA ABA SIGNIFICA. Exportada porque é a definição em si — o defeito
 * que este mapa já teve (Minhas mostrando tudo que o atendente fechou) não
 * aparece em nenhuma tela até alguém reclamar, então vale prender por teste.
 */
export function tabToFilter(
  tab: InboxFiltersValue["tab"],
  automaticoDaOrg?: boolean,
): Partial<ConversationsFilters> {
  switch (tab) {
    case "unassigned":
      // A FILA PERGUNTA POR QUEM MANDA, NÃO POR STATUS.
      //
      // Antes ela pedia `assigned_to=unassigned` + os dois estados de espera. Só
      // que "sem dono e aberta" é também a conversa que o robô está atendendo
      // agora — medido na VPS em 2026-08-30, a aba dizia 83 e 47 daquelas tinham
      // o automático no comando. O atendente abria a Fila e via como trabalho
      // dele quase tudo que já estava sendo respondido.
      //
      // `comandosDaFila` é quem cruza isso com o fato org-wide: numa instalação
      // sem nenhum agente no ar, `automatico` também é "esperando gente".
      return { comando: comandosDaFila(automaticoDaOrg) };
    case "mine":
      // Sem `exclude_finished` a aba mostra tudo que o atendente JÁ atendeu —
      // `Fechar` muda o status mas não solta o dono (de propósito: quem atendeu
      // é histórico). O lugar de "minhas fechadas" é a aba Fechadas.
      return { assigned_to: "me", exclude_finished: true };
    case "closed":
      return { status: "closed" };
    case "ai":
      // `ai_handling` é escrito por UM caminho só em produção (a volta pelo botão
      // "Devolver ao automático"), então a aba vivia mostrando 2 enquanto o robô
      // atendia 47. Agora ela pergunta a régua do MOTOR.
      return { comando: ["automatico"] };
    case "all":
    default:
      return {};
  }
}

const FILTER_TABS: InboxTab[] = ["unassigned", "mine", "all", "closed", "ai"];

/**
 * Lê ?filter= (G4-02, deep-link). ?filter=all é HONRADO mesmo para agent — a
 * lista volta RLS-scoped (a tab só some cosmeticamente); default: fila.
 */
function parseFilterParam(v: string | null): InboxTab {
  return v && FILTER_TABS.includes(v as InboxTab) ? (v as InboxTab) : "unassigned";
}

interface InboxLayoutProps {
  initialSelectedId?: string | null;
}

export function InboxLayout({ initialSelectedId = null }: InboxLayoutProps = {}) {
  const t = useT();
  const { activeOrg, user } = useAuth();
  const supportReadonly = user.support?.access_mode === "support_readonly";
  const orgId = activeOrg?.orgId ?? null;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = parseFilterParam(searchParams.get("filter"));

  // tab vive na URL (?filter=); os demais filtros são estado local de sessão.
  const [aux, setAux] = useState<Omit<InboxFiltersValue, "tab">>({
    search: "",
    onlyUnread: false,
  });
  const filterValue: InboxFiltersValue = { tab, ...aux };
  const setFilterValue = useCallback(
    (next: InboxFiltersValue) => {
      if (next.tab !== tab) {
        const params = new URLSearchParams(searchParams);
        params.set("filter", next.tab);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      }
      const { tab: _t, ...rest } = next;
      setAux(rest);
    },
    [tab, searchParams, router, pathname],
  );

  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const [helpOpen, setHelpOpen] = useState(false);
  /** A ficha do contato como painel deslizante — só existe abaixo do `xl`. */
  const [fichaAberta, setFichaAberta] = useState(false);
  /**
   * A mensagem escolhida para responder "em cima".
   *
   * Mora aqui, e não no composer, porque quem ESCOLHE é a lista de mensagens e
   * quem MOSTRA é o composer — são irmãos, e o estado comum é do pai.
   */
  const [respondendo, setRespondendo] = useState<ConversationMensagem | null>(null);

  /**
   * A ORG tem automático de pé? Sobe para cá porque agora é a ABA que precisa —
   * `ConversationList` e `ConversationHeader` continuam lendo o mesmo hook, e o
   * react-query dedupa: segue sendo uma requisição só.
   *
   * `undefined` enquanto carrega, e `comandosDaFila` trata isso como "assume que
   * há" — a mesma convenção da regra. Numa org SEM automático a Fila nasce menor
   * e completa quando a resposta chega; a janela é de ~200ms e o rótulo nunca
   * discorda do filtro, porque os dois usam a mesma convenção.
   */
  const { data: automaticoDaOrg } = useAutomaticoAtivo();
  const composerRef = useRef<ComposerHandle | null>(null);

  const filters: ConversationsFilters = useMemo(
    () => ({
      ...tabToFilter(filterValue.tab, automaticoDaOrg),
      search: filterValue.search || undefined,
      channel_session_id: filterValue.channel_session_id,
      tag: filterValue.tag,
    }),
    [
      filterValue.tab,
      automaticoDaOrg,
      filterValue.search,
      filterValue.channel_session_id,
      filterValue.tag,
    ],
  );

  const clientFilter = useMemo(
    () =>
      filterValue.onlyUnread
        ? (c: ConversationWithContact) => (c.unread_count_for_assignee ?? 0) > 0
        : undefined,
    [filterValue.onlyUnread],
  );

  // We need the selected conversation object for header / composer / side panel.
  // Source it from the same query the list uses to avoid an extra request.
  const listQ = useConversationsRealtime(filters, orgId);
  const inList = useMemo(() => {
    const all = listQ.data?.pages.flatMap((p) => p.data) ?? [];
    return all.find((c) => c.id === selectedId) ?? null;
  }, [listQ.data, selectedId]);

  // Deep-link para conversa fora do filtro atual (ou fora do escopo do agent):
  // busca única RLS-scoped. 404/vazio ⇒ inacessível ⇒ estado vazio claro (GAP D),
  // nunca stack trace. A RLS (G4-01) é quem garante o não-vazamento.
  //
  // ⚠️ ELA NÃO ESPERA A LISTA — e a espera custava DUAS voltas de rede inteiras.
  //
  // A condição tinha um terceiro termo, `&& !listQ.isLoading`, para poupar uma
  // requisição quando a conversa fosse aparecer na lista de qualquer jeito. O
  // preço real, medido no trace do CI (run 34226618108, deep-link para uma
  // conversa FECHADA — que nenhuma aba da Fila devolve, então a busca única é a
  // única fonte do objeto):
  //
  //   46.725  GET conversations?comando=aguardando               1091ms
  //   48.275  GET conversations?comando=aguardando,automatico     896ms
  //   49.183  GET conversations/<id>                              565ms
  //   49.775  GET contacts/<id>/crm-summary                    (>1034ms)
  //
  // São QUATRO idas em série depois do documento. A lista é pedida duas vezes
  // porque a `queryKey` muda quando `useAutomaticoAtivo` responde (ver
  // `comandosDaFila`), e `isLoading` volta a ser verdadeiro na chave nova — ou
  // seja, o gate segurava a busca única até a SEGUNDA lista assentar, e só
  // então o painel do contato podia começar a carregar. O painel do contato
  // aparecia ~4,7s depois da navegação, e é assim que `encerramento-atendimento`
  // ficou intermitente: a Memória do contato chegava ~0,1–0,6s DEPOIS dos 5s da
  // asserção (o screenshot de falha, tirado logo em seguida, já a mostra).
  //
  // Sem o gate, a busca única sai na primeira leva, em paralelo com a lista, e o
  // objeto existe uma volta depois do documento em vez de três. O custo é UMA
  // requisição extra por deep-link cuja conversa acabe aparecendo na lista —
  // clicar numa conversa da lista já carregada continua sem pedir nada, porque
  // aí `inList` já a tem no primeiro render.
  const needsFetch = !!selectedId && !inList;
  const single = useConversation(selectedId, needsFetch);
  const selectedConversation: ConversationWithContact | null = inList ?? single.data ?? null;
  const selectionNotFound =
    needsFetch && !single.isPending && !single.data && isNotFound(single.error);

  const colunas = colunasDoCelular(Boolean(selectedId));

  const claim = useClaimConversation();
  const close = useCloseConversation();

  // A leitura da conversa aberta é do upstream e fica: sem ela o contador de
  // não-lidas nunca zera para quem abre a conversa.
  useMarkAsRead(
    selectedConversation?.id ?? null,
    selectedConversation?.unread_count_for_assignee ?? 0,
  );

  // Aceita `null`: é o VOLTAR do celular, que limpa a seleção e devolve a lista.
  // É um SUPERCONJUNTO do `handleSelect` do upstream — o tipo dele não aceita
  // `null`, e sem isso o botão de voltar não teria o que chamar.
  //
  // A seleção NÃO vive na URL (só o `?filter=` vive) — então este voltar é
  // estado local, e o botão de voltar do navegador não desfaz a seleção. É a
  // limitação conhecida deste caminho; trocar por URL mudaria o deep-link de
  // conversa, que hoje entra por `initialSelectedId` vindo da rota.
  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    // Sem isto, escolher "responder" numa conversa e trocar para outra levaria
    // a citação junto — e a resposta sairia citando mensagem de outro cliente.
    setRespondendo(null);
  }, []);
  const handleVisibleChange = useCallback((ids: string[]) => setVisibleIds(ids), []);
  const handleFocusReply = useCallback(() => composerRef.current?.focus(), []);
  const handleClaim = useCallback(() => {
    if (!selectedConversation) return;
    claim.mutate({
      conversation_id: selectedConversation.id,
      expected_assignee: selectedConversation.assigned_to_user_id,
    });
  }, [claim, selectedConversation]);
  const handleClose = useCallback(() => {
    if (!selectedConversation) return;
    close.mutate({ conversation_id: selectedConversation.id });
  }, [close, selectedConversation]);

  // A janela vence SOZINHA com a aba aberta. Sem este relógio, quem deixa o
  // inbox aberto a tarde inteira seguiria com o composer liberado numa conversa
  // que já venceu — e o bloqueio só apareceria no próximo recarregamento.
  const [agoraJanela, setAgoraJanela] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setAgoraJanela(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  // A janela de 24h fecha o composer, e o motivo DIZ há quanto tempo fechou.
  //
  // Antes disto o texto livre saía, o CRM marcava `failed` e o operador via um
  // `131047` — descobrindo a regra pelo erro, uma mensagem por vez. Barrar aqui
  // é o pedido explícito do dono: se não dá para enviar, que não deixe tentar.
  //
  // Reusa o `blockedReason` que já existe (contato bloqueado/anonimizado) em vez
  // de um segundo mecanismo de bloqueio: dois caminhos para desabilitar o mesmo
  // composer divergem, e o segundo esquece de cobrir o áudio ou o anexo.
  const janela = estadoDaJanela(
    selectedConversation?.channel_sessions?.provider ?? null,
    selectedConversation?.last_inbound_at ?? null,
    agoraJanela,
  );
  const motivoDaJanela =
    janela.tipo === "fechada"
      ? janela.fechadaHaMs === null
        ? t("O cliente ainda não escreveu — a janela de 24h nunca abriu. Só um modelo aprovado sai daqui.")
        : `${t("A janela de 24h fechou há")} ${formatarDecorrido(janela.fechadaHaMs)}. ${t("Só um modelo aprovado sai daqui — texto livre é recusado pela plataforma.")}`
      : null;

  const blockedReason = selectedConversation?.contacts?.is_blocked
    ? t("Contato bloqueado — envio de mensagens desabilitado.")
    : selectedConversation?.contacts?.is_anonymized
      ? t("Contato anonimizado — não é possível enviar mensagens.")
      : null;

  // Altura da grade: a conta desconta TUDO que fica acima e abaixo dela.
  //   3.5rem            TopBar (`h-14`, em components/shell/TopBar.tsx)
  //   2 * --space-6     padding do <main> do AppShell (`p-6`, em cima e embaixo)
  //
  // Com `100vh-3.5rem` o padding ficava de fora e a grade media 48px a MAIS que a
  // tela. Quem pagava a diferença era o composer, que fica no rodapé: nascia
  // parcialmente abaixo da borda, atrapalhando justo na hora de escrever.
  //
  // As duas parcelas NÃO estão na mesma unidade, e por isso o padding entra pelo
  // token e não como `3rem`: o `@theme inline` de `app/globals.css` remapeia a
  // escala de spacing para `var(--space-N)` — `--space-6` é `24px` LITERAL —, mas
  // não remapeia o `14`, que o Tailwind 4 calcula pelo multiplicador `--spacing`
  // e segue sendo `3.5rem` de verdade. (Até o Tailwind 4 quem remapeava era o
  // `tailwind.config.ts`; o arquivo não existe mais, o efeito é o mesmo.)
  // Escrever a soma como
  // `6.5rem` só acerta enquanto a raiz for 16px; com acessibilidade de fonte maior
  // ou menor o composer sai da tela de novo. Pelo token, a conta se auto-corrige
  // se a escala de espaçamento mudar.
  //
  // `dvh` em vez de `vh` porque no celular a `vh` ignora a barra do navegador — o
  // mesmo corte, só que pior e mudando conforme se rola a página.

  // TRÊS COLUNAS QUE CABEM — medido, não estimado.
  //
  // O `xl` do Tailwind dispara em 1280px, e era ali que a terceira coluna
  // nascia: no ponto exato em que não havia espaço para ela. Com a barra de
  // navegação (240px) sobram 1040px, e o grid pedia 300 + 707 + 320 = 1327 —
  // o painel de CRM ficava 311px FORA da viewport, alcançável só rolando o
  // `main` de lado, que ninguém faz. Em 1280 o atendente simplesmente não via
  // contexto nenhum do cliente.
  //
  // Os 707px eram o `min-content` do `ConversationHeader` (a barra de ações
  // era `shrink-0`), e `1fr` é `minmax(auto, 1fr)`: não encolhe abaixo disso.
  // Consertado o header, o `1fr` volta a encolher sozinho — `minmax(0,1fr)`
  // foi medido aqui e não mudou um pixel, então não entrou.
  //
  // Duas faixas em vez de uma: compacta onde aperta, generosa onde há espaço.
  // Em 1280 isso dá 424px de conversa em vez de 372 — 54px de folga sobre o
  // piso do composer (370px), em vez dos 2px que a versão de uma faixa só
  // deixava. Margem de 2px não é margem, é sorte.
  return (
    <OpenConversationProvider conversationId={selectedId}>
    <div
      className="grid h-full w-full grid-cols-1 md:grid-cols-[300px_1fr] xl:grid-cols-[272px_1fr_296px] 2xl:grid-cols-[300px_1fr_320px]"
      /*
       * O ESTADO DO TEMPO REAL, LEGÍVEL DE FORA — mesmo par que o dossiê do lead
       * já publica (`LeadDossier`), e pela mesma razão: quando a entrega morre,
       * nenhuma tela avisa. Foi o único achado que atravessou o dia intacto
       * quando o realtime quebrou pela primeira vez, e voltou a morder agora.
       *
       * `divergencias` é o que a rede de segurança contou: refetch trouxe estado
       * novo que o canal NÃO tinha entregue. Zero com o canal vivo; subindo é a
       * assinatura de canal que assina e não entrega — o defeito que não grita.
       *
       * ⚠️ `data-realtime-status` vem do STATUS do canal, não de um objeto que
       * existe sempre. A primeira versão desta linha derivava o valor de
       * `listQ.seguranca`, que nunca é nulo — ela diria `ativo` inclusive com o
       * canal morto. Controle decorativo é pior que controle nenhum: mente com
       * cara de instrumento.
       *
       * Atributo de dado e não texto na tela de propósito: quem lê isto é o
       * teste e quem depura, não o atendente. Pôr um aviso permanente na cara de
       * quem atende seria ruído; esconder o sinal do todo é o que custou o dia.
       */
      data-realtime-status={listQ.realtimeStatus}
      data-refetch-divergencias={listQ.seguranca?.divergencias ?? 0}
    >
      {/*
        NO CELULAR, UMA COISA POR VEZ.

        Antes as duas colunas caíam empilhadas em `grid-cols-1`: a lista inteira
        primeiro e a conversa DEPOIS dela. Para responder era preciso rolar a
        lista toda até o fim, e o composer ficava fora da tela — que é o
        "incômodo" relatado por quem atende do telefone.

        Sem media query em JavaScript de propósito: `useMediaQuery` decide DEPOIS
        da hidratação, então a primeira pintura mostra o layout errado e pisca. A
        classe condicional é resolvida pelo CSS, na primeira pintura, e some no
        `md` — onde as duas colunas cabem juntas e a regra não se aplica.
      */}
      <div
        className={cn(
          "h-full min-h-0 flex-col border-r border-border md:flex bg-surface",
          colunas.lista,
        )}
      >
        <InboxFilters value={filterValue} onChange={setFilterValue} />
        <div className="min-h-0 flex-1 overflow-hidden">
          <ConversationList
            listQuery={listQ}
            filters={filters}
            selectedId={selectedId}
            onSelect={handleSelect}
            clientFilter={clientFilter}
            onVisibleChange={handleVisibleChange}
          />
        </div>
      </div>

      {/*
        AS DUAS COLUNAS DECIDEM PELO MESMO DADO — `selectedId`, não o objeto.

        A da lista some quando há `selectedId`; se esta aparecesse só quando a
        conversa já está CARREGADA, a janela entre as duas coisas não mostra
        nenhuma das colunas. No celular isso é a tela em branco, e ela tem dois
        casos reais: o instante do deep-link `/inbox/<id>`, enquanto a busca
        única ainda responde; e o estado permanente de conversa fora do acesso,
        cuja mensagem ("Conversa não encontrada") é justamente o que ficava
        escondido — deixando o dono numa tela vazia, sem sequer o botão de
        voltar, porque ele morava dentro do ramo da conversa carregada.
      */}
      <div
        className={cn(
          "h-full min-h-0 flex-col border-r border-border md:flex bg-surface",
          colunas.conversa,
        )}
      >
        {/*
          A barra do celular vive FORA do ramo da conversa carregada: o caminho
          de volta tem de existir inclusive quando não há o que mostrar — é aí
          que ele é a única saída. A porta da ficha, essa sim, depende da
          conversa, e só aparece quando há uma.
        */}
        {selectedId && (
          <div className="flex items-center gap-1 border-b border-border px-1 py-1 md:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-1 px-2"
              onClick={() => handleSelect(null)}
            >
              <CaretLeft size={16} />
              {t("Conversas")}
            </Button>
            <div className="flex-1" />
            {selectedConversation && (
              <Sheet open={fichaAberta} onOpenChange={setFichaAberta}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 gap-1 px-2 xl:hidden">
                    <IdentificationCard size={16} />
                    {t("Ficha")}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[min(22rem,90vw)] overflow-y-auto p-0">
                  <SheetTitle className="sr-only">{t("Ficha do contato")}</SheetTitle>
                  <CRMSidePanel conversation={selectedConversation} />
                </SheetContent>
              </Sheet>
            )}
          </div>
        )}
        {selectedConversation ? (
          <>
            <ConversationHeader conversation={selectedConversation} />
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChatThread conversationId={selectedConversation.id} onResponder={setRespondendo} />
            </div>
            <RetentionNotice conversationId={selectedConversation.id} />
            {motivoDaJanela && (
              <JanelaFechadaAviso
                conversationId={selectedConversation.id}
                provider={selectedConversation.channel_sessions?.provider ?? null}
                motivo={motivoDaJanela}
              />
            )}
            <Composer
              ref={composerRef}
              conversationId={selectedConversation.id}
              blockedReason={supportReadonly ? "Acompanhamento somente leitura" : blockedReason}
              janelaFechada={motivoDaJanela}
              disabled={selectedConversation.status === "closed"}
              contactName={selectedConversation.contacts?.name ?? null}
              respondendo={respondendo}
              onCancelarResposta={() => setRespondendo(null)}
              currentContactId={selectedConversation.contact_id}
            />
          </>
        ) : selectionNotFound ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            {t("Conversa não encontrada ou fora do seu acesso.")}
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-8 px-6 text-center bg-bg">
            <div className="flex flex-col items-center gap-3">
              <div className="relative mb-4 text-blue-600">
                <ChatCircle size={80} weight="fill" />
                <div className="absolute -top-4 -right-4 animate-pulse">
                  {/* Pequenos elementos decorativos parecidos com o mockup */}
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <line x1="20" y1="8" x2="20" y2="2" />
                    <line x1="32" y1="12" x2="37" y2="7" />
                    <line x1="34" y1="24" x2="40" y2="24" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{t("Selecione uma conversa")}</h2>
              <p className="text-base text-muted-foreground max-w-md">
                {t("Escolha uma conversa na lista ao lado ou comece um novo atendimento.")}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-4xl w-full mt-8">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card p-6 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-blue-200">
                <div className="rounded-full bg-green-100 p-3 text-green-600">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t("Conecte seus canais")}</h3>
                <p className="text-xs text-muted-foreground text-center">
                  {t("WhatsApp, Instagram, Facebook e muito mais")}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card p-6 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-blue-200">
                <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                  <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M216,88H199.36A80.23,80.23,0,0,0,163.53,30.34,16,16,0,0,0,136.21,41a64.12,64.12,0,0,1,38.16,47H81.63A64.12,64.12,0,0,1,119.79,41a16,16,0,0,0-27.32-10.61A80.23,80.23,0,0,0,56.64,88H40a16,16,0,0,0-16,16v40a16,16,0,0,0,16,16H56.55A80,80,0,0,0,200.56,160H216a16,16,0,0,0,16-16V104A16,16,0,0,0,216,88Zm0,56H200.75A80.4,80.4,0,0,0,128,184c-35.84,0-66.27-23.77-72.75-40H40V104H55.25C61.73,87.77,92.16,64,128,64c35.84,0,66.27,23.77,72.75,40H216Zm-120-24a12,12,0,1,1,12,12A12,12,0,0,1,96,120Zm64,0a12,12,0,1,1,12,12A12,12,0,0,1,160,120Z"></path></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t("Use agentes de IA")}</h3>
                <p className="text-xs text-muted-foreground text-center">
                  {t("Automatize respostas e ganhe tempo")}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card p-6 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-blue-200">
                <div className="rounded-full bg-orange-100 p-3 text-orange-600">
                  <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M128,136a40,40,0,1,0-40-40A40,40,0,0,0,128,136Zm0-64a24,24,0,1,1-24,24A24,24,0,0,1,128,72ZM216.51,194.27a128,128,0,0,0-177,0,8,8,0,0,0,11,11.45,112,112,0,0,1,154.95,0,8,8,0,1,0,11-11.45ZM53,158.46a104.14,104.14,0,0,1,150.05,0,8,8,0,0,0,11.39-11.23,120.12,120.12,0,0,0-172.82,0,8,8,0,0,0,11.38,11.23Z"></path></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t("Gerencie seus clientes")}</h3>
                <p className="text-xs text-muted-foreground text-center">
                  {t("Tudo integrado ao seu CRM")}
                </p>
              </div>

              <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-200 dark:border-border bg-white dark:bg-card p-6 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-blue-200">
                <div className="rounded-full bg-red-100 p-3 text-red-600">
                  <svg width="24" height="24" viewBox="0 0 256 256" fill="currentColor"><path d="M224,200h-8V40a8,8,0,0,0-8-8H152a8,8,0,0,0-8,8V200H112V88a8,8,0,0,0-8-8H48a8,8,0,0,0-8,8V200H32a8,8,0,0,0,0,16H224a8,8,0,0,0,0-16ZM160,48h40V200H160ZM56,96H96V200H56Z"></path></svg>
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{t("Acompanhe resultados")}</h3>
                <p className="text-xs text-muted-foreground text-center">
                  {t("Relatórios em tempo real")}
                </p>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              {/* O logo miniaturizado para o footer pode ser simplificado com a letra W azul */}
              <span className="font-bold text-blue-600">W</span>
              <span>{t('"Mais que tecnologia, relacionamentos de verdade."')}</span>
            </div>
          </div>
        )}
      </div>

      <div className="hidden h-full min-h-0 xl:block bg-surface">
        <CRMSidePanel conversation={selectedConversation} />
      </div>

      <InboxKeyboardShortcuts
        visibleIds={visibleIds}
        selectedId={selectedId}
        onSelect={handleSelect}
        onFocusReply={handleFocusReply}
        onClaim={supportReadonly ? () => {} : handleClaim}
        onClose={supportReadonly ? () => {} : handleClose}
        onToggleHelp={() => setHelpOpen((v) => !v)}
      />
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
    </OpenConversationProvider>
  );
}

#!/usr/bin/env bash
# Os $p, $e, $s, $i e $id entre aspas simples são variáveis do GraphQL, não do shell.
# shellcheck disable=SC2016
# Publica um serviço (backend ou frontend) na Railway, se ele mudou, e espera o deploy terminar.
#
# Uso (no GitHub Actions, com o repositório inteiro no checkout: fetch-depth 0):
#   RAILWAY_TOKEN=<token do projeto> [FORCAR=true] .github/scripts/railway-deploy.sh <backend|frontend>
#
# - O token vem só do secret RAILWAY_TOKEN do ambiente "production" do GitHub (nunca do repositório).
#   É um token de PROJETO (Railway → projeto → Settings → Tokens): só publica neste projeto e ambiente.
#   O script confere isso antes de tudo (projectToken) e diz no log se o token é de conta ou inválido.
# - As consultas vão direto à API GraphQL da Railway, com o cabeçalho Project-Access-Token. Só o upload
#   usa o CLI (railway up), que é o uso documentado do token de projeto.
# - Cada deploy leva a mensagem "commit <sha>". A comparação é com o último deploy que deu certo
#   (SUCCESS, ou SLEEPING quando o serviço dormiu), e não com o push anterior: um merge cuja rodada foi
#   cancelada (ou que só mexeu no outro serviço) entra no próximo deploy.
# - Se o main já andou além deste commit, não publica: a rodada do commit mais novo publica tudo.
# - FORCAR=true (o "Run workflow" à mão) publica mesmo sem mudança.
# - Antes do deploy, grava COMMIT_SHA=<sha> no serviço: o /api/health e o /versao.json mostram o commit no ar.
# - Sai com 0 se publicou com sucesso (build, migração e health check passaram) ou se não precisava
#   publicar. Grava publicou=true|false no GITHUB_OUTPUT.
set -euo pipefail

servico="${1:?informe o serviço: backend ou frontend}"
case "$servico" in
  backend | frontend) ;;
  *) echo "Serviço desconhecido: $servico" >&2; exit 2 ;;
esac
: "${RAILWAY_TOKEN:?o secret RAILWAY_TOKEN não está definido}"
commit="${GITHUB_SHA:-$(git rev-parse HEAD)}"
saida_gh="${GITHUB_OUTPUT:-/dev/null}"
api_url="${RAILWAY_API_URL:-https://backboard.railway.com/graphql/v2}"
espera_max_s="${ESPERA_MAX_S:-900}"
intervalo_s="${INTERVALO_S:-10}"
dica_token="Crie um token no projeto raiz-orbital (Settings → Tokens, ambiente production) e troque o secret RAILWAY_TOKEN do ambiente production do GitHub."

publicou() { echo "publicou=$1" >>"$saida_gh"; }

# gql <query> [variáveis em JSON] [cabeçalho de autenticação]: imprime a resposta da API.
gql() {
  local variaveis="${2:-}" auth="${3:-Project-Access-Token: $RAILWAY_TOKEN}" corpo
  [[ -n "$variaveis" ]] || variaveis='{}'
  corpo="$(jq -nc --arg q "$1" --argjson v "$variaveis" '{query: $q, variables: $v}')"
  curl --silent --show-error --max-time 30 "$api_url" \
    -H "Content-Type: application/json" -H "$auth" --data "$corpo"
}

# sem_erro <resposta> <o que>: para e mostra o erro se a API recusou o pedido.
sem_erro() {
  if ! jq -e '.data and ((.errors // []) | length == 0)' <<<"$1" >/dev/null 2>&1; then
    echo "A API da Railway recusou $2:" >&2
    jq -c '.errors // .' <<<"$1" >&2 2>/dev/null || echo "$1" >&2
    exit 1
  fi
}

# Arquivos do serviço que mudaram entre dois commits (no backend, sem a documentação).
mudancas() {
  local desde="$1"
  local arquivos
  arquivos="$(git diff --name-only "$desde" "$commit" -- "projeto/$servico")"
  if [[ "$servico" == "backend" ]]; then
    arquivos="$(grep -vE '^projeto/backend/(docs/|.*\.md$)' <<<"$arquivos" || true)"
  fi
  sed '/^$/d' <<<"$arquivos"
}

# 1. Só o commit mais novo do main publica.
topo="$(git ls-remote origin refs/heads/main | cut -f1)"
if [[ -n "$topo" && "$topo" != "$commit" ]]; then
  echo "O main já está em ${topo:0:7} (este é ${commit:0:7}): a rodada do commit mais novo publica."
  publicou false
  exit 0
fi

# 2. O token é de projeto? (de qual projeto e ambiente: só os ids, nunca o token)
resposta="$(gql 'query { projectToken { projectId environmentId } }' || true)"
projeto="$(jq -r '.data.projectToken.projectId // empty' <<<"$resposta" 2>/dev/null || true)"
ambiente="$(jq -r '.data.projectToken.environmentId // empty' <<<"$resposta" 2>/dev/null || true)"
if [[ -z "$projeto" || -z "$ambiente" ]]; then
  conta="$(gql 'query { me { id } }' '' "Authorization: Bearer $RAILWAY_TOKEN" || true)"
  if jq -e '.data.me.id' <<<"$conta" >/dev/null 2>&1; then
    echo "O RAILWAY_TOKEN é um token de CONTA, não de projeto. $dica_token" >&2
  else
    echo "A Railway não aceita o RAILWAY_TOKEN (inválido, revogado ou colado errado). $dica_token" >&2
  fi
  exit 1
fi
echo "Token do projeto $projeto, ambiente $ambiente."

resposta="$(gql 'query($p: String!) { project(id: $p) { services { edges { node { id name } } } } }' \
  "$(jq -nc --arg p "$projeto" '{p: $p}')")"
sem_erro "$resposta" "a lista de serviços"
servico_id="$(jq -r --arg s "$servico" '.data.project.services.edges[].node | select(.name == $s) | .id' <<<"$resposta")"
if [[ -z "$servico_id" ]]; then
  echo "O serviço $servico não existe no projeto $projeto." >&2
  exit 1
fi

# 3. Mudou desde o último deploy que deu certo?
if [[ "${FORCAR:-false}" != "true" ]]; then
  resposta="$(gql 'query($p: String!, $e: String!, $s: String!) { deployments(first: 50, input: {projectId: $p, environmentId: $e, serviceId: $s}) { edges { node { id status meta } } } }' \
    "$(jq -nc --arg p "$projeto" --arg e "$ambiente" --arg s "$servico_id" '{p: $p, e: $e, s: $s}')")"
  sem_erro "$resposta" "a lista de deploys"
  ultimo="$(jq -r '[.data.deployments.edges[].node | select(.status == "SUCCESS" or .status == "SLEEPING")][0].meta.cliMessage // ""' <<<"$resposta" |
    sed -nE 's/^commit ([0-9a-f]{40})$/\1/p')"
  if [[ -n "$ultimo" ]] && git cat-file -e "${ultimo}^{commit}" 2>/dev/null; then
    lista="$(mudancas "$ultimo")"
    if [[ -z "$lista" ]]; then
      echo "Nada mudou no $servico desde o último deploy (${ultimo:0:7})."
      publicou false
      exit 0
    fi
    echo "Mudou no $servico desde ${ultimo:0:7}:"
    echo "$lista"
  else
    echo "Último deploy sem commit conhecido: publica."
  fi
fi

# 4. Carimba a versão: o /api/health (backend) e o /versao.json (frontend) passam a dizer este commit.
resposta="$(gql 'mutation($i: VariableUpsertInput!) { variableUpsert(input: $i) }' \
  "$(jq -nc --arg p "$projeto" --arg e "$ambiente" --arg s "$servico_id" --arg v "$commit" \
    '{i: {projectId: $p, environmentId: $e, serviceId: $s, name: "COMMIT_SHA", value: $v, skipDeploys: true}}')")"
sem_erro "$resposta" "a variável COMMIT_SHA"

# 5. Publica e espera.
echo "Enviando projeto/$servico (${commit:0:7}) para a Railway..."
if ! resposta="$(railway up "projeto/$servico" --path-as-root --service "$servico_id" \
  --detach --json --message "commit $commit" 2>&1)"; then
  echo "O railway up falhou:" >&2
  echo "$resposta" >&2
  exit 1
fi
deploy_id="$(grep -oE '"deploymentId" *: *"[^"]+"' <<<"$resposta" | head -n1 | sed -E 's/.*"([^"]+)"$/\1/' || true)"
if [[ -z "$deploy_id" ]]; then
  echo "A Railway não devolveu o id do deploy:" >&2
  echo "$resposta" >&2
  exit 1
fi
echo "Deploy: $deploy_id"

passou=0
while ((passou < espera_max_s)); do
  resposta="$(gql 'query($id: String!) { deployment(id: $id) { status } }' "$(jq -nc --arg id "$deploy_id" '{id: $id}')")"
  sem_erro "$resposta" "o status do deploy"
  status="$(jq -r '.data.deployment.status // empty' <<<"$resposta")"
  echo "  ${passou}s: ${status:-aguardando}"
  case "$status" in
    SUCCESS | SLEEPING)
      echo "Deploy do $servico concluído."
      publicou true
      exit 0
      ;;
    FAILED | CRASHED | REMOVED | SKIPPED)
      echo "Deploy do $servico terminou com $status. Últimas linhas do log:" >&2
      railway logs --deployment "$deploy_id" 2>&1 | tail -n 60 >&2 || true
      exit 1
      ;;
  esac
  sleep "$intervalo_s"
  passou=$((passou + intervalo_s))
done

echo "O deploy do $servico não terminou em ${espera_max_s}s." >&2
exit 1

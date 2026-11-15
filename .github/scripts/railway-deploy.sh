#!/usr/bin/env bash
# Publica um serviço (backend ou frontend) na Railway, se ele mudou, e espera o deploy terminar.
#
# Uso (no GitHub Actions, com o repositório inteiro no checkout: fetch-depth 0):
#   RAILWAY_TOKEN=<token do projeto> [FORCAR=true] .github/scripts/railway-deploy.sh <backend|frontend>
#
# - O token vem só do secret RAILWAY_TOKEN do ambiente "production" do GitHub (nunca do repositório).
#   É um token de projeto: só publica neste projeto e neste ambiente da Railway.
# - Cada deploy leva a mensagem "commit <sha>". A comparação é com o último deploy que deu certo, e não
#   com o push anterior: um merge cuja rodada foi cancelada (ou que só mexeu no outro serviço) entra no
#   próximo deploy.
# - Se o main já andou além deste commit, não publica: a rodada do commit mais novo publica tudo.
# - FORCAR=true (o "Run workflow" à mão) publica mesmo sem mudança.
# - Antes do deploy, grava COMMIT_SHA=<sha> no serviço: o /api/health e o /versao.json mostram o commit no ar.
# - Sai com 0 se publicou com SUCCESS (build, migração e health check passaram) ou se não precisava publicar.
#   Grava publicou=true|false no GITHUB_OUTPUT.
set -euo pipefail

servico="${1:?informe o serviço: backend ou frontend}"
case "$servico" in
  backend | frontend) ;;
  *) echo "Serviço desconhecido: $servico" >&2; exit 2 ;;
esac
: "${RAILWAY_TOKEN:?o secret RAILWAY_TOKEN não está definido}"
commit="${GITHUB_SHA:-$(git rev-parse HEAD)}"
saida_gh="${GITHUB_OUTPUT:-/dev/null}"
espera_max_s="${ESPERA_MAX_S:-900}"
intervalo_s=10

publicou() { echo "publicou=$1" >>"$saida_gh"; }

# Lista os deploys do serviço em JSON; se o CLI falhar, mostra a mensagem dele e para.
deploys() {
  local saida
  if ! saida="$(railway deployment list --service "$servico" --json --limit "$1" 2>&1)"; then
    echo "O railway deployment list falhou:" >&2
    echo "$saida" >&2
    exit 1
  fi
  echo "$saida"
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

# 2. Mudou desde o último deploy que deu certo?
if [[ "${FORCAR:-false}" != "true" ]]; then
  lista_deploys="$(deploys 50)"
  ultimo="$(jq -r '[.[] | select(.status == "SUCCESS")][0].meta.cliMessage // ""' <<<"$lista_deploys" |
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

# 3. Carimba a versão: o /api/health (backend) e o /versao.json (frontend) passam a dizer este commit.
if ! saida_var="$(railway variable set "COMMIT_SHA=$commit" --service "$servico" --skip-deploys 2>&1)"; then
  echo "O railway variable set falhou:" >&2
  echo "$saida_var" >&2
  exit 1
fi

# 4. Publica e espera.
echo "Enviando projeto/$servico (${commit:0:7}) para a Railway..."
if ! resposta="$(railway up "projeto/$servico" --path-as-root --service "$servico" \
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
  lista_deploys="$(deploys 20)"
  status="$(jq -r --arg id "$deploy_id" '.[] | select(.id == $id) | .status' <<<"$lista_deploys")"
  echo "  ${passou}s: ${status:-aguardando}"
  case "$status" in
    SUCCESS)
      echo "Deploy do $servico concluído."
      publicou true
      exit 0
      ;;
    FAILED | CRASHED | REMOVED | SKIPPED)
      echo "Deploy do $servico terminou com $status. Últimas linhas do log:" >&2
      railway logs --deployment "$deploy_id" --service "$servico" 2>&1 | tail -n 60 >&2 || true
      exit 1
      ;;
  esac
  sleep "$intervalo_s"
  passou=$((passou + intervalo_s))
done

echo "O deploy do $servico não terminou em ${espera_max_s}s." >&2
exit 1

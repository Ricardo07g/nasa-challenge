#!/usr/bin/env bash
# As condições vão entre aspas simples de propósito: o confere avalia depois, com eval.
# shellcheck disable=SC2016,SC2034
# Testes do railway-deploy.sh, sem rede e sem Railway: um "curl" falso que responde como a API GraphQL
# da Railway, um "railway" falso (só o up e o logs) e um repositório git temporário com um "origin"
# local. Rode: bash .github/scripts/test_railway_deploy.sh
set -euo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/railway-deploy.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
falhas=0
mkdir -p "$tmp/bin"

# --- curl falso: a API da Railway, conforme as variáveis STUB_*; anota as consultas em $STUB_LOG ---
cat >"$tmp/bin/curl" <<'STUB'
#!/usr/bin/env bash
auth=""
corpo=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    -H) [[ "$2" == Content-Type* ]] || auth="$2"; shift 2 ;;
    --data) corpo="$2"; shift 2 ;;
    *) shift ;;
  esac
done
q="$(jq -r .query <<<"$corpo")"
case "$q" in
  *projectToken*)
    echo "gql projectToken" >>"$STUB_LOG"
    if [[ "${STUB_TOKEN:-projeto}" == "projeto" && "$auth" == "Project-Access-Token: falso" ]]; then
      echo '{"data":{"projectToken":{"projectId":"proj-1","environmentId":"env-1"}}}'
    else
      echo '{"data":null,"errors":[{"message":"Not Authorized"}]}'
    fi
    ;;
  *services*)
    echo "gql services $(jq -c .variables <<<"$corpo")" >>"$STUB_LOG"
    echo '{"data":{"project":{"services":{"edges":[{"node":{"id":"svc-backend","name":"backend"}},{"node":{"id":"svc-frontend","name":"frontend"}},{"node":{"id":"svc-db","name":"db"}}]}}}}'
    ;;
  *"deployments("*)
    echo "gql deployments $(jq -c .variables <<<"$corpo")" >>"$STUB_LOG"
    jq -nc --arg m "${STUB_ULTIMA_MSG:-}" --arg st "${STUB_ULTIMO_STATUS:-SLEEPING}" \
      '{data: {deployments: {edges: [
        {node: {id: "dep-falho", status: "FAILED", meta: {cliMessage: "commit 0000000000000000000000000000000000000000"}}},
        {node: {id: "dep-velho", status: $st, meta: {cliMessage: $m}}}]}}}'
    ;;
  *variableUpsert*)
    echo "gql variableUpsert $(jq -c .variables.i <<<"$corpo")" >>"$STUB_LOG"
    echo '{"data":{"variableUpsert":true}}'
    ;;
  *"deployment(id"*)
    echo "gql deployment $(jq -c .variables <<<"$corpo")" >>"$STUB_LOG"
    echo "{\"data\":{\"deployment\":{\"status\":\"${STUB_STATUS_NOVO:-SUCCESS}\"}}}"
    ;;
  *"{ me {"*)
    echo "gql me" >>"$STUB_LOG"
    if [[ "${STUB_TOKEN:-}" == "conta" && "$auth" == "Authorization: Bearer falso" ]]; then
      echo '{"data":{"me":{"id":"usuario-1"}}}'
    else
      echo '{"data":null,"errors":[{"message":"Not Authorized"}]}'
    fi
    ;;
  *) echo "consulta inesperada: $q" >&2; exit 9 ;;
esac
STUB

# --- railway falso: só o upload e os logs (o resto vai pela API) ---
cat >"$tmp/bin/railway" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$STUB_LOG"
case "$1" in
  up)
    if [[ -n "${STUB_UP_FALHA:-}" ]]; then
      echo "$STUB_UP_FALHA"
      exit 1
    fi
    echo '{"deploymentId":"dep-novo","logsUrl":"x"}'
    ;;
  logs) echo "log do deploy" ;;
  *) echo "chamada inesperada: $*" >&2; exit 9 ;;
esac
STUB
chmod +x "$tmp/bin/curl" "$tmp/bin/railway"

# --- repositório: origin + clone com 4 commits (base, backend, docs do backend, frontend) ---
git init -q --bare "$tmp/origin.git"
git clone -q "$tmp/origin.git" "$tmp/repo" 2>/dev/null
cd "$tmp/repo"
git config user.email teste@example.com
git config user.name teste
git checkout -q -b main
mkdir -p projeto/backend/app projeto/backend/docs projeto/frontend/src
echo a >projeto/backend/app/x.py && git add -A && git commit -qm base
c_base="$(git rev-parse HEAD)"
echo b >projeto/backend/app/x.py && git add -A && git commit -qm backend
c_backend="$(git rev-parse HEAD)"
echo d >projeto/backend/docs/nota.md && echo e >projeto/backend/AGENTS.md && git add -A && git commit -qm docs
c_docs="$(git rev-parse HEAD)"
echo f >projeto/frontend/src/y.ts && git add -A && git commit -qm frontend
c_frontend="$(git rev-parse HEAD)"
git push -q origin main 2>/dev/null

roda() { # roda <serviço> <commit> [VAR=valor...]: devolve o código de saída; saída em $tmp/saida
  local servico="$1" commit="$2"
  shift 2
  : >"$tmp/chamadas"
  : >"$tmp/gh_output"
  set +e
  env PATH="$tmp/bin:$PATH" STUB_LOG="$tmp/chamadas" GITHUB_OUTPUT="$tmp/gh_output" GITHUB_SHA="$commit" \
    RAILWAY_TOKEN=falso RAILWAY_API_URL=http://api.falsa ESPERA_MAX_S=20 INTERVALO_S=0 "$@" \
    bash "$script" "$servico" >"$tmp/saida" 2>&1
  local codigo=$?
  set -e
  return $codigo
}

confere() { # confere <nome> <condição em bash>
  if eval "$2"; then
    echo "ok   $1"
  else
    echo "FALHOU $1"
    sed 's/^/       | /' "$tmp/saida"
    sed 's/^/       > /' "$tmp/chamadas"
    falhas=$((falhas + 1))
  fi
}
linha() { grep -n "$1" "$tmp/chamadas" | head -n1 | cut -d: -f1; }

# 1. O main já andou: não publica e nem consulta a Railway.
roda backend "$c_backend" STUB_ULTIMA_MSG="commit $c_base" && r=0 || r=$?
confere "main andou: sai com 0" '[[ $r -eq 0 ]]'
confere "main andou: não fala com a Railway" '[[ ! -s "$tmp/chamadas" ]]'
confere "main andou: publicou=false" 'grep -qx "publicou=false" "$tmp/gh_output"'

# 2. Backend sem mudança desde o último deploy (dormindo: SLEEPING também é deploy bom): não publica.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_docs" && r=0 || r=$?
confere "sem mudança no backend: sai com 0" '[[ $r -eq 0 ]]'
confere "sem mudança no backend: não chama o up" '! grep -q "^up " "$tmp/chamadas"'
confere "sem mudança no backend: não grava a variável" '! grep -q "variableUpsert" "$tmp/chamadas"'
confere "lista de deploys filtrada pelo serviço" \
  'grep -q "^gql deployments {\"p\":\"proj-1\",\"e\":\"env-1\",\"s\":\"svc-backend\"}$" "$tmp/chamadas"'

# 3. Último deploy com status SUCCESS (acordado) também vale.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_docs" STUB_ULTIMO_STATUS=SUCCESS && r=0 || r=$?
confere "último deploy SUCCESS: não chama o up" '! grep -q "^up " "$tmp/chamadas"'

# 4. Só a documentação do backend mudou: não publica.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_backend" && r=0 || r=$?
confere "só docs do backend: não chama o up" '! grep -q "^up " "$tmp/chamadas"'

# 5. O backend mudou desde o último deploy (mesmo com push depois): carimba e publica.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_base" && r=0 || r=$?
confere "backend mudou: sai com 0" '[[ $r -eq 0 ]]'
confere "backend mudou: up com a pasta, o id do serviço e a mensagem" \
  'grep -qx "up projeto/backend --path-as-root --service svc-backend --detach --json --message commit $c_frontend" "$tmp/chamadas"'
confere "backend mudou: grava COMMIT_SHA no serviço sem disparar deploy" \
  'grep -qx "gql variableUpsert {\"projectId\":\"proj-1\",\"environmentId\":\"env-1\",\"serviceId\":\"svc-backend\",\"name\":\"COMMIT_SHA\",\"value\":\"$c_frontend\",\"skipDeploys\":true}" "$tmp/chamadas"'
confere "backend mudou: grava o COMMIT_SHA antes do up" '[[ $(linha variableUpsert) -lt $(linha "^up ") ]]'
confere "backend mudou: espera o deploy novo" 'grep -q "^gql deployment {\"id\":\"dep-novo\"}$" "$tmp/chamadas"'
confere "backend mudou: publicou=true" 'grep -qx "publicou=true" "$tmp/gh_output"'

# 6. Frontend mudou: publica o frontend.
roda frontend "$c_frontend" STUB_ULTIMA_MSG="commit $c_docs" && r=0 || r=$?
confere "frontend mudou: up do frontend" 'grep -q "^up projeto/frontend --path-as-root --service svc-frontend " "$tmp/chamadas"'

# 7. Último deploy sem mensagem de commit: publica.
roda frontend "$c_frontend" STUB_ULTIMA_MSG="" && r=0 || r=$?
confere "sem commit conhecido: publica" 'grep -q "^up projeto/frontend " "$tmp/chamadas"'

# 8. FORCAR=true publica mesmo sem mudança (e nem consulta a lista).
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_frontend" FORCAR=true && r=0 || r=$?
confere "forçado: publica sem mudança" 'grep -q "^up projeto/backend " "$tmp/chamadas"'
confere "forçado: não consulta a lista de deploys" '! grep -q "^gql deployments" "$tmp/chamadas"'

# 9. O deploy novo dorme logo (SLEEPING): deu certo.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_base" STUB_STATUS_NOVO=SLEEPING && r=0 || r=$?
confere "deploy novo SLEEPING: sai com 0" '[[ $r -eq 0 ]]'
confere "deploy novo SLEEPING: publicou=true" 'grep -qx "publicou=true" "$tmp/gh_output"'

# 10. Deploy que falha: sai com erro e mostra o log.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_base" STUB_STATUS_NOVO=FAILED && r=0 || r=$?
confere "deploy falhou: sai com erro" '[[ $r -ne 0 ]]'
confere "deploy falhou: mostra o log" 'grep -q "log do deploy" "$tmp/saida"'

# 11. O up do CLI falha: sai com erro e mostra a mensagem dele.
roda frontend "$c_frontend" STUB_ULTIMA_MSG="" STUB_UP_FALHA="Unauthorized. Please check your RAILWAY_TOKEN" && r=0 || r=$?
confere "up falhou: sai com erro" '[[ $r -ne 0 ]]'
confere "up falhou: mostra a mensagem do CLI" 'grep -q "Unauthorized. Please check your RAILWAY_TOKEN" "$tmp/saida"'

# 12. O secret é um token de CONTA: para antes de tudo e diz o que fazer.
roda backend "$c_frontend" STUB_TOKEN=conta && r=0 || r=$?
confere "token de conta: sai com erro" '[[ $r -ne 0 ]]'
confere "token de conta: diz que é de conta e como trocar" 'grep -q "token de CONTA" "$tmp/saida" && grep -q "Settings → Tokens" "$tmp/saida"'
confere "token de conta: não chama o up" '! grep -q "^up " "$tmp/chamadas"'

# 13. Token que a Railway não aceita: para e diz o que fazer.
roda backend "$c_frontend" STUB_TOKEN=invalido && r=0 || r=$?
confere "token inválido: sai com erro" '[[ $r -ne 0 ]]'
confere "token inválido: explica" 'grep -q "não aceita o RAILWAY_TOKEN" "$tmp/saida"'

# 14. Serviço desconhecido: erro.
roda banco "$c_frontend" && r=0 || r=$?
confere "serviço desconhecido: erro" '[[ $r -eq 2 ]]'

if ((falhas > 0)); then
  echo "$falhas teste(s) falharam."
  exit 1
fi
echo "Todos os testes do railway-deploy.sh passaram."

#!/usr/bin/env bash
# As condições vão entre aspas simples de propósito: o confere avalia depois, com eval.
# shellcheck disable=SC2016,SC2034
# Testes do railway-deploy.sh, sem rede e sem Railway: um "railway" falso no PATH e um repositório git
# temporário com um "origin" local. Rode: bash .github/scripts/test_railway_deploy.sh
set -euo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/railway-deploy.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
falhas=0

# --- railway falso: responde conforme as variáveis STUB_* e anota as chamadas em $tmp/chamadas ---
mkdir -p "$tmp/bin"
cat >"$tmp/bin/railway" <<'STUB'
#!/usr/bin/env bash
echo "$*" >>"$STUB_LOG"
case "$1 $2" in
  "deployment list")
    if grep -q '^up ' "$STUB_LOG"; then
      echo "[{\"id\":\"dep-novo\",\"status\":\"${STUB_STATUS_NOVO:-SUCCESS}\",\"meta\":{}},{\"id\":\"dep-velho\",\"status\":\"SUCCESS\",\"meta\":{\"cliMessage\":\"${STUB_ULTIMA_MSG:-}\"}}]"
    else
      echo "[{\"id\":\"dep-velho\",\"status\":\"SUCCESS\",\"meta\":{\"cliMessage\":\"${STUB_ULTIMA_MSG:-}\"}}]"
    fi
    ;;
  "up projeto/backend" | "up projeto/frontend")
    if [[ -n "${STUB_UP_FALHA:-}" ]]; then
      echo "$STUB_UP_FALHA"
      exit 1
    fi
    echo '{"deploymentId":"dep-novo","logsUrl":"x"}'
    ;;
  "logs --deployment") echo "log do deploy" ;;
  *) echo "chamada inesperada: $*" >&2; exit 9 ;;
esac
STUB
chmod +x "$tmp/bin/railway"

# --- repositório: origin + clone com 3 commits (backend, docs do backend, frontend) ---
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
    RAILWAY_TOKEN=falso ESPERA_MAX_S=20 "$@" bash "$script" "$servico" >"$tmp/saida" 2>&1
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
    falhas=$((falhas + 1))
  fi
}

# 1. O main já andou: não publica.
roda backend "$c_backend" STUB_ULTIMA_MSG="commit $c_base" && r=0 || r=$?
confere "main andou: sai com 0" '[[ $r -eq 0 ]]'
confere "main andou: não chama o up" '! grep -q "^up " "$tmp/chamadas"'
confere "main andou: publicou=false" 'grep -qx "publicou=false" "$tmp/gh_output"'

# 2. Backend sem mudança desde o último deploy (só o frontend mudou): não publica.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_docs" && r=0 || r=$?
confere "sem mudança no backend: sai com 0" '[[ $r -eq 0 ]]'
confere "sem mudança no backend: não chama o up" '! grep -q "^up " "$tmp/chamadas"'

# 3. Só a documentação do backend mudou: não publica.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_backend" && r=0 || r=$?
confere "só docs do backend: não chama o up" '! grep -q "^up " "$tmp/chamadas"'

# 4. O backend mudou desde o último deploy (mesmo com push depois): publica com a mensagem do commit.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_base" && r=0 || r=$?
confere "backend mudou: sai com 0" '[[ $r -eq 0 ]]'
confere "backend mudou: chama o up com a pasta e a mensagem" \
  'grep -q "^up projeto/backend --path-as-root --service backend --detach --json --message commit $c_frontend$" "$tmp/chamadas"'
confere "backend mudou: publicou=true" 'grep -qx "publicou=true" "$tmp/gh_output"'

# 5. Frontend mudou: publica.
roda frontend "$c_frontend" STUB_ULTIMA_MSG="commit $c_docs" && r=0 || r=$?
confere "frontend mudou: chama o up do frontend" 'grep -q "^up projeto/frontend " "$tmp/chamadas"'

# 6. Último deploy sem mensagem de commit: publica.
roda frontend "$c_frontend" STUB_ULTIMA_MSG="" && r=0 || r=$?
confere "sem commit conhecido: publica" 'grep -q "^up projeto/frontend " "$tmp/chamadas"'

# 7. FORCAR=true publica mesmo sem mudança.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_frontend" FORCAR=true && r=0 || r=$?
confere "forçado: publica sem mudança" 'grep -q "^up projeto/backend " "$tmp/chamadas"'

# 8. Deploy que falha: sai com erro e mostra o log.
roda backend "$c_frontend" STUB_ULTIMA_MSG="commit $c_base" STUB_STATUS_NOVO=FAILED && r=0 || r=$?
confere "deploy falhou: sai com erro" '[[ $r -ne 0 ]]'
confere "deploy falhou: mostra o log" 'grep -q "log do deploy" "$tmp/saida"'

# 9. O up do CLI falha: sai com erro e mostra a mensagem dele (sem ela, não dá para saber a causa).
roda frontend "$c_frontend" STUB_ULTIMA_MSG="" STUB_UP_FALHA="Unauthorized. Please check your RAILWAY_TOKEN" && r=0 || r=$?
confere "up falhou: sai com erro" '[[ $r -ne 0 ]]'
confere "up falhou: mostra a mensagem do CLI" 'grep -q "Unauthorized. Please check your RAILWAY_TOKEN" "$tmp/saida"'

# 10. Serviço desconhecido: erro.
roda banco "$c_frontend" && r=0 || r=$?
confere "serviço desconhecido: erro" '[[ $r -eq 2 ]]'

if ((falhas > 0)); then
  echo "$falhas teste(s) falharam."
  exit 1
fi
echo "Todos os testes do railway-deploy.sh passaram."

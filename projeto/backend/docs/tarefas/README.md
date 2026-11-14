# Backlog de Tarefas de Engenharia — Backend

Este diretório gerencia as tarefas técnicas, épicos e melhorias do backend do **Raiz Orbital**.
Cada tarefa possui um identificador numérico sequencial (`0001`, `0002`, etc.) e segue o padrão MVC + Service/Repository com TDD obrigatório.

---

## Tabela de Tarefas

| ID | Título | Status | Prioridade | Responsável / Módulo |
| :---: | :--- | :---: | :---: | :--- |
| [**0001**](0001-ingestao-on-demand-dados-satelite.md) | **Pipeline de Ingestão On-Demand de Dados de Satélite e Solo (Cache-Aside Espacial)** | **Concluída** | **Alta** | `app/repositories/external/`, `app/services/` |

---

## Convenções de Tarefas

1. **Nomenclatura do arquivo:** `XXXX-descricao-curta-em-kebab-case.md` (ex.: `0001-ingestao-on-demand-dados-satelite.md`).
2. **Ciclo de Vida:**
   - `Pendente` (Planejada e especificada)
   - `Em Progresso` (Em desenvolvimento na branch)
   - `Concluída` (Merged com testes verdes e aderente a `AGENTS.md`)
3. **Padrão de Qualidade:**
   - TDD obrigatório (Red-Green-Refactor).
   - Sem chamadas de rede real nos testes unitários.
   - Respeito rigoroso às camadas (Controller → Service → Repository).

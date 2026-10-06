# Fechamento de Faturamento: do cálculo descartável à persistência atômica

Projeto desenvolvido como parte do MBA Full Cycle, implementando o fechamento do faturamento com cálculo das faturas de um período e persistência atômica no banco de dados (Unit of Work), reprocessamento substitutivo, presenters dinâmicos via Dynamic Factory, consulta de faturas persistidas, publicação de eventos via Mediator e estrita observância ao princípio de inversão de dependência (DIP).

---

## 🏛 Onde vive a transação do fechamento e como provamos a atomicidade

A transação do fechamento vive na infraestrutura de persistência, encapsulada pela porta `DatabaseConnection` estendida com a operação `transaction(work)`. O método `replacePeriod` em `InvoiceDatabaseRepository` (implementação de `InvoiceRepository`) delega a execução atômica para o `PgPromiseAdapter`, que utiliza o suporte nativo de transações (`tx`) do `pg-promise`. Toda a operação — a remoção das faturas prévias do período/regime e a inserção em lote das novas faturas — é executada em uma única transação de banco de dados. A camada de aplicação desconhece o `pg-promise` e a `DatabaseConnection`, mantendo a regra de DIP.

A atomicidade foi comprovada em testes de integração (`test/CloseInvoicing.test.ts`) em dois cenários críticos de falha:
1. **Falha forçada no meio do lote via Test Double:** Um fechamento inicial persiste 1 fatura com sucesso. Em seguida, um novo fechamento é disparado utilizando uma conexão com test double (`FailingDatabaseConnection`) que permite a execução do `DELETE`, mas simula um erro fatal na query de `INSERT` da fatura. Comprovamos que a transação sofre rollback total: o `DELETE` é desfeito, nenhuma fatura da nova execução fica gravada e a fatura do fechamento anterior permanece intacta no banco.
2. **Falha por integridade referencial do PostgreSQL:** Simulamos um lote em que uma das faturas referencia um contrato inexistente (`id_contract` inválido). O PostgreSQL lança violação de Foreign Key no meio do lote, acionando o rollback atômico do pg-promise e garantindo que o banco não permaneça em estado inconsistente.

---

## 🚀 Como subir o projeto

### 1. Pré-requisitos
- Node.js LTS (v18+)
- PostgreSQL 15+ (local ou via Docker)

### 2. Banco de Dados (PostgreSQL)

Caso utilize Docker:
```bash
docker run -d --name postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=123456 -e POSTGRES_DB=app -p 5432:5432 postgres:15-alpine
```

Ou em instalação local do PostgreSQL:
```bash
psql -U postgres -c "drop database if exists app;"
psql -U postgres -c "create database app;"
```

Execute o script de inicialização (`create.sql`), que já inclui a extensão `uuid-ossp`, o `drop schema if exists` e a tabela `branas.invoice`:
```bash
psql -U postgres -d app -v ON_ERROR_STOP=1 -f create.sql
```
*O script é idempotente e pode ser executado múltiplas vezes sem erros.*

### 3. Instalação de Dependências
```bash
npm install
```

### 4. Executando a API
A API depende do timezone `America/Sao_Paulo`:

No Linux / macOS / WSL:
```bash
TZ=America/Sao_Paulo npx ts-node src/main.ts
```

No Windows (PowerShell):
```powershell
$env:TZ='America/Sao_Paulo'; npx ts-node src/main.ts
```

A API iniciará na porta `3000`.

---

## 🧪 Como rodar a suíte de testes

Certifique-se de definir a variável de ambiente `TZ=America/Sao_Paulo`.
Para testes end-to-end da API (`api.test.ts` e `InvoicesApi.test.ts`), a API deve estar em execução no terminal.

No Linux / macOS / WSL:
```bash
TZ=America/Sao_Paulo npx jest
```

No Windows (PowerShell):
```powershell
$env:TZ='America/Sao_Paulo'; npx jest
```

Ou via script npm configurado:
```bash
npm test
```

---

## 🔍 Verificação de Higiene de Dependências (DIP)

Nenhum arquivo de `src/application` ou `src/domain` importa classes ou módulos de `src/infra`.
Para verificar:

```bash
grep -rEn "from ['\"][^'\"]*infra" src/application src/domain
```
*(O comando retorna vazio, comprovando a adesão estrita ao DIP)*

---

## 📡 Endpoints Disponíveis

### `POST /close_invoicing`
Realiza o fechamento contábil atômico e substitutivo do período.
- **Body:** `{ "month": 1, "year": 2022, "type": "accrual", "format": "json" }`
- **Resposta (JSON):**
  ```json
  [ { "date": "2022-01-01T13:00:00.000Z", "amount": 500 } ]
  ```
- **Resposta com `format: "csv"`:**
  ```text
  2022-01-01;500
  ```
- **Evento publicado via Mediator:** `InvoicesClosed` com `{ month: 1, year: 2022, type: "accrual", invoices: 1, total: 500 }` (impresso pelo listener `SendEmail`).

### `GET /invoices`
Consulta as faturas persistidas de um período/regime.
- **Query Params:** `month=1&year=2022&type=accrual&format=json`
- **Resposta:**
  ```json
  [ { "date": "2022-01-01T13:00:00.000Z", "amount": 500 } ]
  ```
- **Resposta com `format=csv`:**
  ```text
  2022-01-01;500
  ```

### `POST /generate_invoices`
Simulação de cálculo (não persiste dados, agora respeita o campo `format`).
- **Body:** `{ "month": 1, "year": 2022, "type": "cash", "format": "csv" }`
- **Resposta:**
  ```text
  2022-01-05;6000
  ```

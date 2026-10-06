import ContractDatabaseRepository from "../src/infra/repository/ContractDatabaseRepository";
import ContractRepository from "../src/application/repository/ContractRepository";
import DatabaseConnection from "../src/infra/database/DatabaseConnection";
import PgPromiseAdapter from "../src/infra/database/PgPromiseAdapter";
import InvoiceDatabaseRepository from "../src/infra/repository/InvoiceDatabaseRepository";
import InvoiceRepository, { InvoiceItem } from "../src/application/repository/InvoiceRepository";
import CloseInvoicing from "../src/application/usecase/CloseInvoicing";
import GetInvoices from "../src/application/usecase/GetInvoices";
import PresenterFactory from "../src/infra/presenter/PresenterFactory";
import Mediator from "../src/infra/mediator/Mediator";
import Contract from "../src/domain/Contract";

let connection: DatabaseConnection;
let contractRepository: ContractRepository;
let invoiceRepository: InvoiceRepository;
let presenterFactory: PresenterFactory;
let mediator: Mediator;
let closeInvoicing: CloseInvoicing;
let getInvoices: GetInvoices;

beforeEach(async () => {
	connection = new PgPromiseAdapter();
	contractRepository = new ContractDatabaseRepository(connection);
	invoiceRepository = new InvoiceDatabaseRepository(connection);
	presenterFactory = new PresenterFactory();
	mediator = new Mediator();
	closeInvoicing = new CloseInvoicing(contractRepository, invoiceRepository, presenterFactory, mediator);
	getInvoices = new GetInvoices(invoiceRepository, presenterFactory);
	// clean up invoices table before each test
	await connection.query("delete from branas.invoice", []);
});

afterEach(async () => {
	await connection.close();
});

test("Deve fechar o faturamento por regime de competência de ponta a ponta e persistir no banco", async function () {
	const input = {
		month: 1,
		year: 2022,
		type: "accrual"
	};
	const output = await closeInvoicing.execute(input);
	expect(output).toHaveLength(1);
	expect(output.at(0)?.date).toEqual(new Date("2022-01-01T13:00:00Z"));
	expect(output.at(0)?.amount).toBe(500);

	const persistedInvoices = await getInvoices.execute(input);
	expect(persistedInvoices).toHaveLength(1);
	expect(persistedInvoices.at(0)?.date).toEqual(new Date("2022-01-01T13:00:00Z"));
	expect(persistedInvoices.at(0)?.amount).toBe(500);
});

test("Deve reprocessar o fechamento sem duplicar faturas (substituição atômica)", async function () {
	const input = {
		month: 1,
		year: 2022,
		type: "accrual"
	};
	await closeInvoicing.execute(input);
	const firstRun = await getInvoices.execute(input);
	expect(firstRun).toHaveLength(1);

	// Segundo fechamento do mesmo período e regime
	await closeInvoicing.execute(input);
	const secondRun = await getInvoices.execute(input);
	expect(secondRun).toHaveLength(1);
	expect(secondRun.at(0)?.amount).toBe(500);
});

test("Deve fechar o faturamento e formatar em CSV", async function () {
	const input = {
		month: 1,
		year: 2022,
		type: "cash",
		format: "csv"
	};
	const output = await closeInvoicing.execute(input);
	expect(output).toBe("2022-01-05;6000");

	const persistedCsv = await getInvoices.execute(input);
	expect(persistedCsv).toBe("2022-01-05;6000");
});

test("Deve lançar erro para formato inválido no fechamento sem alterar o banco", async function () {
	const input = {
		month: 1,
		year: 2022,
		type: "accrual",
		format: "xml"
	};
	await expect(closeInvoicing.execute(input)).rejects.toThrow("Invalid format");
	const persistedInvoices = await getInvoices.execute({ month: 1, year: 2022, type: "accrual" });
	expect(persistedInvoices).toHaveLength(0);
});

test("Deve lançar erro para regime desconhecido", async function () {
	const input = {
		month: 1,
		year: 2022,
		type: "unknown"
	};
	await expect(closeInvoicing.execute(input)).rejects.toThrow("Invalid type");
});

test("Deve publicar o evento InvoicesClosed com o resumo do fechamento", async function () {
	let eventData: any;
	mediator.on("InvoicesClosed", async function (data: any) {
		eventData = data;
	});
	const input = {
		month: 1,
		year: 2022,
		type: "accrual"
	};
	await closeInvoicing.execute(input);
	expect(eventData).toEqual({
		month: 1,
		year: 2022,
		type: "accrual",
		invoices: 1,
		total: 500
	});
});

test("Deve retornar lista vazia para período sem faturas", async function () {
	const input = {
		month: 3,
		year: 2023,
		type: "cash"
	};
	const output = await closeInvoicing.execute(input);
	expect(output).toEqual([]);
	const persistedInvoices = await getInvoices.execute(input);
	expect(persistedInvoices).toEqual([]);
});

test("Deve garantir atomicidade (rollback total) quando falha ocorrer no meio da persistência do lote", async function () {
	// 1. Fechamento inicial bem-sucedido: 1 fatura de 500
	await closeInvoicing.execute({ month: 1, year: 2022, type: "accrual" });
	const initialInvoices = await invoiceRepository.list(1, 2022, "accrual");
	expect(initialInvoices).toHaveLength(1);
	expect(initialInvoices.at(0)?.amount).toBe(500);

	// 2. Test double da connection que falha na inserção da fatura dentro da transação (após o delete já ter executado)
	class FailingDatabaseConnection implements DatabaseConnection {
		constructor (readonly realConnection: DatabaseConnection) {}

		query(statement: string, params?: any): Promise<any> {
			return this.realConnection.query(statement, params);
		}

		close(): Promise<void> {
			return this.realConnection.close();
		}

		async transaction<T = any>(work: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
			return this.realConnection.transaction((txConnection) => {
				const failingTx: DatabaseConnection = {
					query: (statement: string, params?: any) => {
						if (statement.includes("insert into branas.invoice")) {
							throw new Error("Simulated database failure during batch insertion");
						}
						return txConnection.query(statement, params);
					},
					close: () => txConnection.close(),
					transaction: (w) => txConnection.transaction(w)
				};
				return work(failingTx);
			});
		}
	}

	const failingConnection = new FailingDatabaseConnection(connection);
	const failingInvoiceRepository = new InvoiceDatabaseRepository(failingConnection);
	const failingCloseInvoicing = new CloseInvoicing(contractRepository, failingInvoiceRepository, presenterFactory, mediator);

	// Executa novo fechamento que falha no meio do lote
	await expect(failingCloseInvoicing.execute({ month: 1, year: 2022, type: "accrual" })).rejects.toThrow(
		"Simulated database failure during batch insertion"
	);

	// 3. Comprova que o rollback foi total e o fechamento anterior permaneceu intacto!
	const invoicesAfterFailure = await invoiceRepository.list(1, 2022, "accrual");
	expect(invoicesAfterFailure).toHaveLength(1);
	expect(invoicesAfterFailure.at(0)?.amount).toBe(500);
});

test("Deve garantir atomicidade quando violação de integridade referencial ocorrer no meio do lote", async function () {
	// 1. Fechamento inicial com 1 fatura
	await closeInvoicing.execute({ month: 1, year: 2022, type: "accrual" });
	const initialInvoices = await invoiceRepository.list(1, 2022, "accrual");
	expect(initialInvoices).toHaveLength(1);

	// 2. Simula lote onde a segunda fatura tem id_contract inexistente, forçando erro de FK no PostgreSQL
	const fakeContractRepository: ContractRepository = {
		async list(): Promise<Contract[]> {
			const realContracts = await contractRepository.list();
			const invalidContract = new Contract(
				"00000000-0000-0000-0000-000000000000",
				"Contrato Inválido",
				1000,
				1,
				new Date("2022-01-01T10:00:00")
			);
			return [...realContracts, invalidContract];
		}
	};
	const closeWithInvalidContract = new CloseInvoicing(fakeContractRepository, invoiceRepository, presenterFactory, mediator);

	// O PostgreSQL deve lançar erro de foreign key constraint
	await expect(closeWithInvalidContract.execute({ month: 1, year: 2022, type: "accrual" })).rejects.toThrow();

	// 3. Comprova que o rollback total desfez tanto o delete quanto a inserção parcial do primeiro contrato
	const invoicesAfterFkFailure = await invoiceRepository.list(1, 2022, "accrual");
	expect(invoicesAfterFkFailure).toHaveLength(1);
	expect(invoicesAfterFkFailure.at(0)?.amount).toBe(500);
});

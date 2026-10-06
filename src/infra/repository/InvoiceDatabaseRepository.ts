import DatabaseConnection from "../database/DatabaseConnection";
import InvoiceRepository, { InvoiceItem, PeriodInvoice } from "../../application/repository/InvoiceRepository";

export default class InvoiceDatabaseRepository implements InvoiceRepository {

	constructor (readonly connection: DatabaseConnection) {
	}

	async replacePeriod(month: number, year: number, type: string, invoices: InvoiceItem[]): Promise<void> {
		await this.connection.transaction(async (txConnection) => {
			await txConnection.query(
				"delete from branas.invoice where month = $1 and year = $2 and type = $3",
				[month, year, type]
			);
			for (const invoice of invoices) {
				await txConnection.query(
					"insert into branas.invoice (id_contract, month, year, type, date, amount) values ($1, $2, $3, $4, $5, $6)",
					[invoice.idContract, month, year, type, invoice.date, invoice.amount]
				);
			}
		});
	}

	async list(month: number, year: number, type: string): Promise<PeriodInvoice[]> {
		const invoicesData = await this.connection.query(
			"select date, amount from branas.invoice where month = $1 and year = $2 and type = $3 order by date asc",
			[month, year, type]
		);
		const invoices: PeriodInvoice[] = [];
		for (const invoiceData of invoicesData) {
			invoices.push({
				date: new Date(invoiceData.date),
				amount: parseFloat(invoiceData.amount)
			});
		}
		return invoices;
	}

}

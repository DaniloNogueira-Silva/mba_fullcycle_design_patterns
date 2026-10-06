import InvoiceRepository from "../repository/InvoiceRepository";
import PresenterFactory from "../presenter/PresenterFactory";
import Usecase from "./Usecase";

export default class GetInvoices implements Usecase {

	constructor (
		readonly invoiceRepository: InvoiceRepository,
		readonly presenterFactory: PresenterFactory
	) {
	}

	async execute (input: Input): Promise<any> {
		const presenter = this.presenterFactory.create(input.format);
		const invoices = await this.invoiceRepository.list(
			Number(input.month),
			Number(input.year),
			input.type
		);
		const output: Output[] = invoices.map(invoice => ({
			date: invoice.date,
			amount: invoice.amount
		}));
		return presenter.present(output);
	}
}

export type Input = {
	month: number | string;
	year: number | string;
	type: string;
	format?: string;
}

export type Output = {
	date: Date;
	amount: number;
}

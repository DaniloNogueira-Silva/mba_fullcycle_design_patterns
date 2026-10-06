import ContractRepository from "../repository/ContractRepository";
import InvoiceRepository, { InvoiceItem } from "../repository/InvoiceRepository";
import PresenterFactory from "../presenter/PresenterFactory";
import Mediator from "../mediator/Mediator";
import Usecase from "./Usecase";
import InvoiceGenerationFactory from "../../domain/InvoiceGenerationFactory";

export default class CloseInvoicing implements Usecase {

	constructor (
		readonly contractRepository: ContractRepository,
		readonly invoiceRepository: InvoiceRepository,
		readonly presenterFactory: PresenterFactory,
		readonly mediator?: Mediator
	) {
	}

	async execute (input: Input): Promise<any> {
		const presenter = this.presenterFactory.create(input.format);
		InvoiceGenerationFactory.create(input.type);
		const invoicesToPersist: InvoiceItem[] = [];
		const output: Output[] = [];
		const contracts = await this.contractRepository.list();
		for (const contract of contracts) {
			const invoices = contract.generateInvoices(input.month, input.year, input.type);
			for (const invoice of invoices) {
				output.push({ date: invoice.date, amount: invoice.amount });
				invoicesToPersist.push({
					idContract: contract.idContract,
					date: invoice.date,
					amount: invoice.amount
				});
			}
		}
		await this.invoiceRepository.replacePeriod(input.month, input.year, input.type, invoicesToPersist);
		const total = invoicesToPersist.reduce((acc, invoice) => acc + invoice.amount, 0);
		if (this.mediator) {
			await this.mediator.publish("InvoicesClosed", {
				month: input.month,
				year: input.year,
				type: input.type,
				invoices: invoicesToPersist.length,
				total
			});
		}
		return presenter.present(output);
	}
}

export type Input = {
	month: number;
	year: number;
	type: string;
	format?: string;
}

export type Output = {
	date: Date;
	amount: number;
}

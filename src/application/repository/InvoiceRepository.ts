export type InvoiceItem = {
	idContract: string;
	date: Date;
	amount: number;
};

export type PeriodInvoice = {
	date: Date;
	amount: number;
};

export default interface InvoiceRepository {
	replacePeriod (month: number, year: number, type: string, invoices: InvoiceItem[]): Promise<void>;
	list (month: number, year: number, type: string): Promise<PeriodInvoice[]>;
}

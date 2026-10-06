import HttpServer from "./HttpServer";
import Usecase from "../../application/usecase/Usecase";

export default class InvoiceController {

	constructor (
		readonly httpServer: HttpServer,
		readonly closeInvoicing: Usecase,
		readonly getInvoices: Usecase
	) {
		httpServer.on("post", "/close_invoicing", async function (params: any, body: any, headers: any) {
			const input = body;
			body.userAgent = headers?.["user-agent"];
			body.host = headers?.host;
			const output = await closeInvoicing.execute(input);
			return output;
		});

		httpServer.on("get", "/invoices", async function (params: any, body: any, headers: any, query: any) {
			const input = {
				month: query?.month !== undefined ? Number(query.month) : undefined,
				year: query?.year !== undefined ? Number(query.year) : undefined,
				type: query?.type,
				format: query?.format,
				userAgent: headers?.["user-agent"],
				host: headers?.host
			};
			const output = await getInvoices.execute(input);
			return output;
		});
	}

}

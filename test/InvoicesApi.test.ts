import axios from "axios";

test("Deve fechar faturamento e consultar faturas pela API", async function () {
	// 1. Fechamento accrual via POST /close_invoicing
	const closeResponse = await axios.post("http://localhost:3000/close_invoicing", {
		month: 1,
		year: 2022,
		type: "accrual"
	});
	expect(closeResponse.data).toEqual([
		{ date: "2022-01-01T13:00:00.000Z", amount: 500 }
	]);

	// 2. Consulta via GET /invoices
	const getResponse = await axios.get("http://localhost:3000/invoices", {
		params: { month: 1, year: 2022, type: "accrual" }
	});
	expect(getResponse.data).toEqual([
		{ date: "2022-01-01T13:00:00.000Z", amount: 500 }
	]);

	// 3. Reprocessamento substitutivo: fechar novamente não duplica
	await axios.post("http://localhost:3000/close_invoicing", {
		month: 1,
		year: 2022,
		type: "accrual"
	});
	const getAfterReprocess = await axios.get("http://localhost:3000/invoices", {
		params: { month: 1, year: 2022, type: "accrual" }
	});
	expect(getAfterReprocess.data).toHaveLength(1);
});

test("Deve fechar faturamento e consultar em CSV com texto puro", async function () {
	const closeResponse = await axios.post("http://localhost:3000/close_invoicing", {
		month: 1,
		year: 2022,
		type: "cash",
		format: "csv"
	});
	expect(closeResponse.data).toBe("2022-01-05;6000");

	const getResponse = await axios.get("http://localhost:3000/invoices", {
		params: { month: 1, year: 2022, type: "cash", format: "csv" }
	});
	expect(getResponse.data).toBe("2022-01-05;6000");
});

test("Deve retornar lista vazia para período sem faturas via API", async function () {
	const response = await axios.get("http://localhost:3000/invoices", {
		params: { month: 3, year: 2023, type: "cash" }
	});
	expect(response.data).toEqual([]);
});

test("Deve gerar faturas com CSV no endpoint /generate_invoices sem persistir nada", async function () {
	// Respeita format: "csv"
	const generateResponse = await axios.post("http://localhost:3000/generate_invoices", {
		month: 1,
		year: 2022,
		type: "accrual",
		format: "csv"
	});
	expect(generateResponse.data).toBe("2022-01-01;500");

	// Garante que não persistiu nada além do que já estava fechado
	const invoices = await axios.get("http://localhost:3000/invoices", {
		params: { month: 1, year: 2022, type: "accrual" }
	});
	expect(invoices.data).toHaveLength(1);
});

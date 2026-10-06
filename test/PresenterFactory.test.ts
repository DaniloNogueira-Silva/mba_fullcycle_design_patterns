import PresenterFactory from "../src/infra/presenter/PresenterFactory";
import JsonPresenter from "../src/infra/presenter/JsonPresenter";
import CsvPresenter from "../src/infra/presenter/CsvPresenter";

test("Deve retornar JsonPresenter para formato json", function () {
	const factory = new PresenterFactory();
	const presenter = factory.create("json");
	expect(presenter).toBeInstanceOf(JsonPresenter);
});

test("Deve retornar JsonPresenter na ausência de formato", function () {
	const factory = new PresenterFactory();
	const presenter = factory.create();
	expect(presenter).toBeInstanceOf(JsonPresenter);
});

test("Deve retornar CsvPresenter para formato csv", function () {
	const factory = new PresenterFactory();
	const presenter = factory.create("csv");
	expect(presenter).toBeInstanceOf(CsvPresenter);
});

test("Deve lançar Invalid format para formato desconhecido", function () {
	const factory = new PresenterFactory();
	expect(() => factory.create("xml")).toThrow("Invalid format");
});

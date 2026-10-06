import PresenterFactory from "../../application/presenter/PresenterFactory";
import Presenter from "../../application/presenter/Presenter";
import JsonPresenter from "./JsonPresenter";
import CsvPresenter from "./CsvPresenter";

export default class DefaultPresenterFactory implements PresenterFactory {

	static create (format?: string): Presenter {
		if (!format || format === "json") {
			return new JsonPresenter();
		}
		if (format === "csv") {
			return new CsvPresenter();
		}
		throw new Error("Invalid format");
	}

	create (format?: string): Presenter {
		return DefaultPresenterFactory.create(format);
	}
}

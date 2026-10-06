import Presenter from "../../application/presenter/Presenter";

export default class JsonPresenter implements Presenter {

	present(output: any): any {
		return output;
	}

}

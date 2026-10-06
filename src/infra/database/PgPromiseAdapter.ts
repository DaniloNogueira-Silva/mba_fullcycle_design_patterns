import DatabaseConnection from "./DatabaseConnection";
import pgp from "pg-promise";

export default class PgPromiseAdapter implements DatabaseConnection {
	connection: any;

	constructor (connection?: any) {
		this.connection = connection || pgp()("postgres://postgres:123456@localhost:5432/app");
	}

	query(statement: string, params?: any): Promise<any> {
		return this.connection.query(statement, params);
	}

	close(): Promise<void> {
		if (this.connection.$pool) {
			return this.connection.$pool.end();
		}
		return Promise.resolve();
	}

	async transaction<T = any>(work: (connection: DatabaseConnection) => Promise<T>): Promise<T> {
		return this.connection.tx(async (t: any) => {
			const transactionalConnection = new PgPromiseAdapter(t);
			return work(transactionalConnection);
		});
	}

}
export default interface DatabaseConnection {
	query (statement: string, params?: any): Promise<any>;
	close (): Promise<void>;
	transaction<T = any> (work: (connection: DatabaseConnection) => Promise<T>): Promise<T>;
}

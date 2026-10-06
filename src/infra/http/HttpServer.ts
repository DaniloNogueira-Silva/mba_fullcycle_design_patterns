export default interface HttpServer {
	// Convention for callback arguments: (params: any, body: any, headers: any, query: any)
	on (method: string, url: string, callback: Function): void;
	listen (port: number): void;
}

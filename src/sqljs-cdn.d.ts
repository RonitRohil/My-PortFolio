declare module "sql.js" {
  export interface SqlJsConfig {
    locateFile?: (file: string) => string;
  }

  export interface SqlJsExecResult {
    columns: string[];
    values: unknown[][];
  }

  export interface SqlJsDatabase {
    exec(sql: string): SqlJsExecResult[];
  }

  export interface SqlJsStatic {
    Database: new (data?: Uint8Array) => SqlJsDatabase;
  }

  const initSqlJs: (config?: SqlJsConfig) => Promise<SqlJsStatic>;
  export default initSqlJs;
}

declare module "sql.js/dist/sql-wasm.wasm?url" {
  const url: string;
  export default url;
}

declare module "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js" {
  const initSqlJs: (config?: { locateFile?: (file: string) => string }) => Promise<any>;
  export default initSqlJs;
}

declare module "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/sql-wasm.js" {
  const initSqlJs: (config?: { locateFile?: (file: string) => string }) => Promise<any>;
  export default initSqlJs;
}

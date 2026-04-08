declare module 'unzipper' {
  interface ZipEntry {
    path: string;
    type: string;
    buffer(): Promise<Buffer>;
  }

  interface CentralDirectory {
    files: ZipEntry[];
  }

  const Open: {
    file(path: string): Promise<CentralDirectory>;
    buffer(buffer: Buffer): Promise<CentralDirectory>;
  };

  export { Open };
}

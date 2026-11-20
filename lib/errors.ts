/** Only expected business failures may be displayed to the user. */
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
export function fail(message: string, status = 400): never {
  throw new AppError(message, status);
}

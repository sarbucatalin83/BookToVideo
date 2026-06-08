export class AppError extends Error {
  constructor(message: string, public readonly statusCode: number = 500) {
    super(message)
    this.name = this.constructor.name
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) { super(message, 400) }
}

export class NotFoundError extends AppError {
  constructor(message: string) { super(message, 404) }
}

export class UnprocessableError extends AppError {
  constructor(message: string) { super(message, 422) }
}

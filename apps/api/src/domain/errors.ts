export class DomainError extends Error {
  constructor(
    public code:
      | 'VALIDATION_ERROR'
      | 'TOO_LARGE'
      | 'NOT_FOUND'
      | 'UNAUTHENTICATED'
      | 'FORBIDDEN'
      | 'CONFLICT'
      | 'REVISION_CONFLICT',
    message: string,
  ) {
    super(message);
  }
}

export interface ApiErrorBody {
  detail?: string | { msg?: string }[];
  message?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code ?? httpStatusToCode(status);
  }
}

function httpStatusToCode(status: number): string {
  switch (status) {
    case 400:
      return "INVALID_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 500:
      return "INTERNAL_ERROR";
    case 503:
      return "SERVICE_UNAVAILABLE";
    default:
      if (status >= 500) return "INTERNAL_ERROR";
      if (status >= 400) return "REQUEST_FAILED";
      return "NETWORK_ERROR";
  }
}

export interface CurrentUser {
  id: number;
  name: string;
  email: string;
  created_at: string;
}

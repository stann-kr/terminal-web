export class ApiError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
export async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { cache: 'no-store', ...init }); }
  catch (error) { if (error instanceof Error && error.name === 'AbortError') throw error; throw new ApiError('NETWORK_ERROR', 0); }
  let value: unknown;
  try { value = await response.json(); } catch { throw new ApiError('INVALID_RESPONSE', response.status); }
  if (!response.ok) throw new ApiError(value && typeof value === 'object' && 'error' in value && typeof value.error === 'string' ? value.error : 'INTERNAL_SERVER_ERROR', response.status);
  return value as T;
}
export function postJson<T>(url: string, body: unknown, headers?: Record<string,string>, signal?: AbortSignal) {
  return requestJson<T>(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal });
}
const messages: Record<string,string> = {
  NETWORK_ERROR: '연결이 끊겼습니다. 입력은 보존되어 있습니다. 다시 시도해 주세요.',
  INVALID_RESPONSE: '서버 응답을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  RATE_LIMITED: '요청이 많습니다. 잠시 기다린 뒤 다시 시도해 주세요.',
  ABUSE_CONTROL_UNAVAILABLE: '요청을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  INVALID_ACCESS_CODE: '초대 코드를 다시 확인해 주세요.',
  EVENT_MISMATCH: '현재 접수 대상 이벤트가 바뀌었습니다. 이벤트 목록에서 대상을 다시 확인해 주세요.',
  NO_UPCOMING_EVENT: '현재 접수할 예정 이벤트가 없습니다.',
  REQUEST_PERIOD_INACTIVE: '현재는 게스트 신청 기간이 아닙니다.',
  GUEST_LIMIT_REACHED: '이 초대인의 접수 한도에 도달했습니다.',
  VERIFICATION_UNAVAILABLE: '지금은 코드를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  DATA_UNAVAILABLE: '이벤트 정보를 확인할 수 없습니다. 입력을 유지한 채 다시 시도해 주세요.',
  INVALID_EMAIL_FORMAT: '이메일 주소 형식을 확인해 주세요.',
  INVALID_INSTAGRAM_FORMAT: '인스타그램 ID는 영문·숫자·마침표·밑줄로 입력해 주세요.',
  PRIVACY_CONSENT_REQUIRED: '필수 개인정보 수집에 동의해 주세요.', CONSENT_REQUIRED: '소식 안내를 위한 수집 동의가 필요합니다.',
  ALL_FIELDS_REQUIRED: '모든 필수 항목을 입력해 주세요.', INVALID_INPUT: '입력한 항목과 길이를 확인해 주세요.',
  HANDLE_REQUIRED: '공개 닉네임을 입력해 주세요.', HANDLE_TOO_LONG: '정규화된 닉네임은 24자 이하여야 합니다.',
  MESSAGE_REQUIRED: '메시지를 입력해 주세요.', MESSAGE_TOO_LONG: '메시지는 280자까지 입력할 수 있습니다.',
  CONTENT_REJECTED: '메시지에 허용되지 않는 제어 문자가 있습니다.',
  IDEMPOTENCY_CONFLICT: '전송 식별자가 다른 내용에 사용되었습니다. 다시 전송해 주세요.',
};
export function errorMessage(error: unknown) { return messages[error instanceof ApiError ? error.code : ''] ?? '요청을 완료하지 못했습니다. 입력은 유지됩니다. 잠시 후 다시 시도해 주세요.'; }

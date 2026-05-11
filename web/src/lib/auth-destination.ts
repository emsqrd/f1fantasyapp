const DEFAULT_POST_SIGNUP_DESTINATION = '/create-team';

export function getPostSignupDestination(redirectParam?: string): string {
  if (redirectParam) {
    return redirectParam;
  }
  return DEFAULT_POST_SIGNUP_DESTINATION;
}

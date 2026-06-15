/**
 * Validate that required fields are present and non-empty in the request body.
 * Returns a 400 response with { success: false, message } if validation fails.
 */
export function validate(body: Record<string, any>, required: string[]): string | null {
  for (const field of required) {
    const value = body[field];
    if (value === undefined || value === null || value === '') {
      return `${field} is required`;
    }
  }
  return null;
}

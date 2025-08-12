export function getUserOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}
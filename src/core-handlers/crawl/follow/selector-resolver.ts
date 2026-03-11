// R-CRAWL-82: Selector resolution hierarchy for follow= arg

const CSS_INDICATORS = ['.', '#', '>', '[', ':', '+', '~']

export function isCssSelector(value: string): boolean {
  if (CSS_INDICATORS.some((c) => value.includes(c))) {
    return true
  }
  // Tag names like "a", "div", "span" are also valid CSS
  const tagPattern = /^[a-z][a-z0-9]*$/i
  return tagPattern.test(value)
}

export function textToSelector(text: string): string {
  // Plain text -> match <a> elements whose text contains the string
  return `a:contains("${text}")`
}

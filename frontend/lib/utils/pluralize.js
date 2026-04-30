/**
 * Pluralize a word based on count.
 *
 * @param {number} count
 * @param {string} singular
 * @param {string} [plural] Optional explicit plural form. Defaults to `singular + "s"`.
 * @returns {string} `${count} ${singular | plural}`
 */
export function pluralize(count, singular, plural) {
  const n = Number(count) || 0;
  const word = n === 1 ? singular : (plural ?? `${singular}s`);
  return `${n} ${word}`;
}

export default pluralize;

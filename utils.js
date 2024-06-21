import baseSlugify from "slugify";

export function slugify(str) {
  return baseSlugify(str, {
    replacement: "_",
    lower: true,
    strict: true,
  });
}

/**
 *
 * @param {string} dsId
 * @returns string
 */
export function dsIdToGristId(dsId) {
  return atob(dsId).toLowerCase().replace("-", "_");
}

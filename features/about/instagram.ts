import content from './content.json';

/**
 * The Instagram account, for every place that links to it: the handle, how the site prints it (in
 * capitals, like every other name on it; handles ignore case) and its profile address.
 */
export const instagram = {
  handle: `@${content.instagram}`,
  printed: `@${content.instagram}`.toUpperCase(),
  url: `https://www.instagram.com/${content.instagram}/`,
};

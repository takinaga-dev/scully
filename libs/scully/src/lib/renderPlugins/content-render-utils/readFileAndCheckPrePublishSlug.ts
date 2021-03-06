/* eslint-disable no-prototype-builtins */
import { readFileSync, writeFileSync } from 'fs';
import { stringify } from 'yamljs';
import { randomString } from '../../utils/randomString';
import { logWarn, yellow } from '../../utils';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fm = require('front-matter');

export interface ContentMetaData {
  author?: string;
  published?: boolean;
  slug?: string;
  'publish date'?: Date;
  slugs?: string[];
  title?: string;
  secret?: boolean;
  [key: string]: any;
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function readFileAndCheckPrePublishSlug(file) {
  const prependString = '___UNPUBLISHED___';
  const createSlug = () => `${prependString}${Date.now().toString(36)}_${randomString(32)}`;
  const createSecret = () => `${Date.now().toString(36)}_${randomString(32)}`;
  logWarn(`file path is "${file}"`);
  const originalFile = readFileSync(file, 'utf-8');
  const { attributes: meta, body: fileContent }: { attributes: ContentMetaData; body: string } = fm(originalFile);
  logWarn(meta);
  let prePublished = false;
  if (fileContent.trim() === '') {
    logWarn(`Content file "${yellow(file)}" has no content!`);
  }
  if (meta.hasOwnProperty('publish date') || meta.hasOwnProperty('publish-date') || meta.hasOwnProperty('publishDate')) {
    const date = meta['publish date'] || meta['publish-date'] || meta['publishDate'];
    // check if there is a valid date (getTime on invalid date returns NaN)
    if (date instanceof Date && date.getTime() === date.getTime()) {
      const published = date.getTime() <= new Date().getTime();
      if (published && meta.hasOwnProperty('published') && meta.published === false) {
        /** no need to update when its published anyway already! */
        updateFileWithNewMeta({ ...meta, published });
      }
      /** make sure internal published reflects the state of the published date */
      meta.published = published;
    }
  }
  if (meta.hasOwnProperty('published') && meta.published === false) {
    /** this post needs an pre-publish slug */
    const slugs = Array.isArray(meta.slugs) ? meta.slugs : [];
    let unPublishedSlug = slugs.find((sl: string) => sl.startsWith(prependString));
    if (!unPublishedSlug) {
      /** there is no prepub slug so create one and update the file */
      unPublishedSlug = createSlug();
      updateFileWithNewMeta({ ...meta, slugs: slugs.concat(unPublishedSlug) });
    }
    prePublished = true;
    /** overwrite slug from file with prepub only in memory. we don't want a file with the original slug name now. */
    meta.slug = unPublishedSlug;
  }

  // for secret
  if (meta.hasOwnProperty('secret') && meta.secret === true) {
    logWarn('add secret path');
    const slugs = Array.isArray(meta.slugs) ? meta.slugs : [];
    const secretPath = createSecret();
    if (!slugs.length) {
      updateFileWithNewMeta({ ...meta, slugs: slugs.concat(secretPath) });
    }
    prePublished = true;
    meta.slug = secretPath;
  }
  return { meta, fileContent, prePublished };

  function updateFileWithNewMeta(newMeta: ContentMetaData) {
    /** only update file on actual changes. */
    if (stringify(meta) !== stringify(newMeta)) {
      /** string literal, don't format "correctly" or things will break ;) */
      const newFile = `---
${stringify(newMeta).trim()}
---

${fileContent.trimStart()}`;
      writeFileSync(file, newFile);
    }
  }
}

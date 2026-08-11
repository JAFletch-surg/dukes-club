// Categories a news/blog post can be filed under. Shared by the public news
// filter, the digest preference centres and the digest API's validation, so
// there is one list to update when a new category is introduced.
export const NEWS_CATEGORIES = [
  'Announcement',
  'Education',
  'Careers',
  'Research',
  'Events',
  'Policy',
  'Member News',
  'General',
] as const

export type NewsCategory = (typeof NEWS_CATEGORIES)[number]

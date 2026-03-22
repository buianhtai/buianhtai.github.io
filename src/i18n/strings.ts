const strings = {
  en: {
    home: 'Home',
    greeting: "Hey, I'm Tai",
    bio: 'Backend engineer. Documenting what I learn — Java, AI, DevOps, and beyond.',
    recentPosts: 'Recent Posts',
    allPosts: 'All Posts',
    viewAll: 'View all →',
    backToBlog: '← Back to blog',
    allTags: '← All tags',
    posts: 'posts',
    langSwitch: '🇻🇳 VI',
  },
  vi: {
    home: 'Trang chủ',
    greeting: 'Xin chào, tôi là Tài',
    bio: 'Backend engineer. Ghi lại những gì tôi học — Java, AI, DevOps, và hơn thế nữa.',
    recentPosts: 'Bài viết gần đây',
    allPosts: 'Tất cả bài viết',
    viewAll: 'Xem tất cả →',
    backToBlog: '← Về blog',
    allTags: '← Tất cả tags',
    posts: 'bài viết',
    langSwitch: '🇬🇧 EN',
  },
} as const;

export type Lang = keyof typeof strings;

export function t(lang: string, key: keyof (typeof strings)['en']): string {
  const l = (lang === 'vi' ? 'vi' : 'en') as Lang;
  return strings[l][key];
}

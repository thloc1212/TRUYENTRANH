export interface Genre {
  id: string;
  name: string;
  description?: string;
}

export interface Chapter {
  id: string;
  name: string;
}

export interface Comic {
  id: string;
  title: string;
  thumbnail: string;
  last_chapter?: string;
  chapters_count?: number;
  status?: string;
  updated_at?: string;
  views?: string;
  description?: string;
  author?: string;
  genres?: Genre[] | string[];
}

export interface ComicDetail extends Comic {
  author: string;
  status: string;
  genres: Genre[];
  views: string;
  description: string;
  chapters: Chapter[];
}

export interface ChapterDetail {
  comic_name: string;
  chapter_name: string;
  images: {
    page: number;
    src: string;
    backup_src?: string;
  }[];
  chapters: Chapter[];
}

export interface ReadingHistory {
  comicId: string;
  comicTitle: string;
  comicThumbnail: string;
  chapterId: string;
  chapterName: string;
  updatedAt: string;
}

export interface Bookmark {
  comicId: string;
  comicTitle: string;
  comicThumbnail: string;
  bookmarkedAt: string;
}

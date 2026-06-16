import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Image proxy endpoint (to avoid CORS and Referer blocking on Manga sites!)
  app.get('/api-image', async (req, res) => {
    const imageUrl = req.query.url as string;
    if (!imageUrl) {
      return res.status(400).send('URL parameter is required');
    }
    try {
      const parsedUrl = new URL(imageUrl);
      const host = parsedUrl.host;
      const ref = req.query.referer as string || `https://${host}/` || 'https://www.nettruyenmax.com/';
      const response = await fetch(imageUrl, {
        headers: {
          'Referer': ref,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        }
      });
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch image: ${response.statusText}`);
      }
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=2592000'); // Cache for 30 days
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err: any) {
      console.error('Image proxy error:', err.message);
      return res.status(500).send(`Image proxy error: ${err.message}`);
    }
  });

  // Helper functions to map Otruyen format to standard app format
  const mapOtruyenItemToComic = (item: any) => {
    let last_chapter = "";
    if (item.chaptersLatest && item.chaptersLatest.length > 0) {
      last_chapter = item.chaptersLatest[0].filename || "";
    }
    
    let statusText = "Đang tiến hành";
    if (item.status === 'completed') {
      statusText = "Hoàn thành";
    } else if (item.status === 'ongoing') {
      statusText = "Đang tiến hành";
    }
    
    const thumb = item.thumb_url
      ? (item.thumb_url.startsWith('http')
          ? item.thumb_url
          : (item.thumb_url.startsWith('uploads')
              ? `https://otruyenapi.com/${item.thumb_url}`
              : `https://otruyenapi.com/uploads/comics/${item.thumb_url}`))
      : "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80";

    return {
      id: item.slug,
      title: item.name,
      thumbnail: thumb,
      last_chapter: last_chapter || "Chương mới",
      status: statusText,
      updated_at: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('vi-VN') : "Vừa xong",
      views: item.views || "12.5k",
      description: item.content || item.description || "",
      author: Array.isArray(item.author) ? item.author.filter(Boolean).join(', ') : (item.author || "Đang cập nhật"),
      genres: (item.category || []).map((cat: any) => ({
        id: cat.slug,
        name: cat.name
      }))
    };
  };

  const mapOtruyenDetailToComicDetail = (item: any) => {
    const server = item.chapters?.[0] || { server_data: [] };
    const chapters = (server.server_data || []).map((ch: any) => {
      const match = ch.chapter_api_data?.match(/\/chapter\/([a-f0-9]+)$/i);
      const chId = match ? match[1] : ch.chapter_name;
      return {
        id: chId,
        name: `Chương ${ch.chapter_name}${ch.chapter_title ? ' - ' + ch.chapter_title : ''}`
      };
    });

    let statusText = "Đang tiến hành";
    if (item.status === 'completed') {
      statusText = "Hoàn thành";
    } else if (item.status === 'ongoing') {
      statusText = "Đang tiến hành";
    }

    const thumb = item.thumb_url
      ? (item.thumb_url.startsWith('http')
          ? item.thumb_url
          : (item.thumb_url.startsWith('uploads')
              ? `https://otruyenapi.com/${item.thumb_url}`
              : `https://otruyenapi.com/uploads/comics/${item.thumb_url}`))
      : "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&q=80";

    return {
      id: item.slug,
      title: item.name,
      thumbnail: thumb,
      last_chapter: chapters.length > 0 ? chapters[0].name : "Mới nhất",
      status: statusText,
      updated_at: item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('vi-VN') : "Vừa xong",
      views: item.views || "12.5k",
      description: item.content || item.description || "Không có mô tả.",
      author: Array.isArray(item.author) ? item.author.filter(Boolean).join(', ') : (item.author || "Đang cập nhật"),
      genres: (item.category || []).map((cat: any) => ({
        id: cat.slug,
        name: cat.name
      })),
      chapters: chapters
    };
  };

  // REST API Proxy to Forward requests to stable Otruyen APIs mapped as NetTruyen format
  app.get('/api/comics-gateway/*', async (req, res) => {
    const subpath = req.params[0];
    const page = parseInt(req.query.page as string) || 1;
    const query = req.query.q as string || '';

    try {
      // 1. GET /api/comics-gateway/genres
      if (subpath === 'genres') {
        const response = await fetch('https://otruyenapi.com/v1/api/the-loai');
        if (!response.ok) {
          throw new Error(`Otruyen Genres failed: ${response.statusText}`);
        }
        const json = await response.json();
        const items = json.data?.items || [];
        const mapped = items.map((item: any) => ({
          id: item.slug,
          name: item.name,
          description: `Thể loại truyện tranh ${item.name}`
        }));
        return res.json(mapped);
      }

      // 2. GET /api/comics-gateway/genres/:genre_id
      const genreMatch = subpath.match(/^genres\/([^/]+)$/);
      if (genreMatch) {
        const genreId = genreMatch[1];
        const response = await fetch(`https://otruyenapi.com/v1/api/the-loai/${genreId}?page=${page}`);
        if (!response.ok) {
          throw new Error(`Otruyen Genre comics failed: ${response.statusText}`);
        }
        const json = await response.json();
        const items = json.data?.items || [];
        const params = json.data?.params || {};
        const totalItems = params.totalItems || items.length;
        const itemsPerPage = params.itemsPerPage || 24;
        const total_pages = Math.ceil(totalItems / itemsPerPage) || 1;
        const current_page = params.currentPage || page;

        const mappedComics = items.map(mapOtruyenItemToComic);
        return res.json({
          comics: mappedComics,
          total_pages,
          current_page
        });
      }

      // 3. GET /api/comics-gateway/comics/recent
      if (subpath === 'comics/recent') {
        const response = await fetch(`https://otruyenapi.com/v1/api/danh-sach/truyen-moi?page=${page}`);
        if (!response.ok) {
          throw new Error(`Otruyen Recent failed: ${response.statusText}`);
        }
        const json = await response.json();
        const items = json.data?.items || [];
        const params = json.data?.params || {};
        const totalItems = params.totalItems || items.length;
        const itemsPerPage = params.itemsPerPage || 24;
        const total_pages = Math.ceil(totalItems / itemsPerPage) || 1;
        const current_page = params.currentPage || page;

        const mappedComics = items.map(mapOtruyenItemToComic);
        return res.json({
          comics: mappedComics,
          total_pages,
          current_page
        });
      }

      // 4. GET /api/comics-gateway/comics/trending
      if (subpath === 'comics/trending') {
        const response = await fetch(`https://otruyenapi.com/v1/api/danh-sach/dang-cap-nhat?page=${page}`);
        if (!response.ok) {
          throw new Error(`Otruyen Trending failed: ${response.statusText}`);
        }
        const json = await response.json();
        const items = json.data?.items || [];
        const params = json.data?.params || {};
        const totalItems = params.totalItems || items.length;
        const itemsPerPage = params.itemsPerPage || 24;
        const total_pages = Math.ceil(totalItems / itemsPerPage) || 1;
        const current_page = params.currentPage || page;

        const mappedComics = items.map(mapOtruyenItemToComic);
        return res.json({
          comics: mappedComics,
          total_pages,
          current_page
        });
      }

      // 5. GET /api/comics-gateway/comics/new
      if (subpath === 'comics/new') {
        const response = await fetch(`https://otruyenapi.com/v1/api/danh-sach/truyen-moi?page=${page}`);
        if (!response.ok) {
          throw new Error(`Otruyen New failed: ${response.statusText}`);
        }
        const json = await response.json();
        const items = json.data?.items || [];
        const params = json.data?.params || {};
        const totalItems = params.totalItems || items.length;
        const itemsPerPage = params.itemsPerPage || 24;
        const total_pages = Math.ceil(totalItems / itemsPerPage) || 1;
        const current_page = params.currentPage || page;

        const mappedComics = items.map(mapOtruyenItemToComic);
        return res.json({
          comics: mappedComics,
          total_pages,
          current_page
        });
      }

      // 6. GET /api/comics-gateway/comics/completed
      if (subpath === 'comics/completed') {
        const response = await fetch(`https://otruyenapi.com/v1/api/danh-sach/hoan-thanh?page=${page}`);
        if (!response.ok) {
          throw new Error(`Otruyen Completed failed: ${response.statusText}`);
        }
        const json = await response.json();
        const items = json.data?.items || [];
        const params = json.data?.params || {};
        const totalItems = params.totalItems || items.length;
        const itemsPerPage = params.itemsPerPage || 24;
        const total_pages = Math.ceil(totalItems / itemsPerPage) || 1;
        const current_page = params.currentPage || page;

        const mappedComics = items.map(mapOtruyenItemToComic);
        return res.json({
          comics: mappedComics,
          total_pages,
          current_page
        });
      }

      // 7. GET /api/comics-gateway/comics/search
      if (subpath === 'comics/search') {
        const response = await fetch(`https://otruyenapi.com/v1/api/tim-kiem?keyword=${encodeURIComponent(query)}&page=${page}`);
        if (!response.ok) {
          throw new Error(`Otruyen Search failed: ${response.statusText}`);
        }
        const json = await response.json();
        const items = json.data?.items || [];
        const params = json.data?.params || {};
        const totalItems = params.totalItems || items.length;
        const itemsPerPage = params.itemsPerPage || 24;
        const total_pages = Math.ceil(totalItems / itemsPerPage) || 1;
        const current_page = params.currentPage || page;

        const mappedComics = items.map(mapOtruyenItemToComic);
        return res.json({
          comics: mappedComics,
          total_pages,
          current_page
        });
      }

      // 8. GET /api/comics-gateway/comics/:comic_id/chapters/:chapter_id
      const chapterMatch = subpath.match(/^comics\/([^/]+)\/chapters\/([^/]+)$/);
      if (chapterMatch) {
        const comicId = chapterMatch[1];
        const chapterId = chapterMatch[2];

        const [chapterRes, comicRes] = await Promise.all([
          fetch(`https://sv1.otruyencdn.com/v1/api/chapter/${chapterId}`),
          fetch(`https://otruyenapi.com/v1/api/truyen-tranh/${comicId}`)
        ]);

        if (!chapterRes.ok) {
          throw new Error(`Otruyen Chapter failed: ${chapterRes.statusText}`);
        }

        const jsonChapter = await chapterRes.json();
        const chItem = jsonChapter.data?.item;
        const domainCdn = jsonChapter.data?.domain_cdn || "https://sv1.otruyencdn.com";

        const images = (chItem?.chapter_image || []).map((img: any) => ({
          page: img.image_page,
          src: `${domainCdn}/${chItem.chapter_path}/${img.image_file}`
        }));

        let chapters: any[] = [];
        if (comicRes.ok) {
          const jsonComic = await comicRes.json();
          const detail = jsonComic.data?.item;
          if (detail) {
            const server = detail.chapters?.[0] || { server_data: [] };
            chapters = (server.server_data || []).map((ch: any) => {
              const match = ch.chapter_api_data?.match(/\/chapter\/([a-f0-9]+)$/i);
              const chId = match ? match[1] : ch.chapter_name;
              return {
                id: chId,
                name: `Chương ${ch.chapter_name}${ch.chapter_title ? ' - ' + ch.chapter_title : ''}`
              };
            });
          }
        }

        return res.json({
          comic_name: chItem?.comic_name || "Truyện Tranh",
          chapter_name: chItem?.chapter_name ? `Chương ${chItem.chapter_name}` : "Chương",
          images: images,
          chapters: chapters
        });
      }

      // 9. GET /api/comics-gateway/comics/:comic_id
      const detailMatch = subpath.match(/^comics\/([^/]+)$/);
      if (detailMatch) {
        const comicId = detailMatch[1];
        const response = await fetch(`https://otruyenapi.com/v1/api/truyen-tranh/${comicId}`);
        if (!response.ok) {
          throw new Error(`Otruyen Detail failed: ${response.statusText}`);
        }
        const json = await response.json();
        const item = json.data?.item;
        if (!item) {
          return res.status(404).json({ error: "Manga detail not found in Otruyen" });
        }
        const mappedDetail = mapOtruyenDetailToComicDetail(item);
        return res.json(mappedDetail);
      }

      // No match
      return res.status(404).json({ error: "Gateway endpoint not found" });

    } catch (error: any) {
      console.error('Unified Comics-Gateway Proxy Error:', error.message);
      return res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

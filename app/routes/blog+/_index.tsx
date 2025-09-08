import fs from "fs/promises";
import path from "path";
import matter from "gray-matter";
import { json, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

/** Data shape for each card on the index */
type BlogCard = {
  slug: string;            // derived from filename or frontmatter
  title: string;
  description?: string;
  date?: string;           // ISO in frontmatter
  author?: string;
  tags?: string[];
  cover?: string;          // optional: cover image path if you add it to frontmatter
};

/** --- Small utilities --- */

/** Minimal slugify (no external dep) */
function safeSlug(input: string) {
  return String(input)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Helper: newest first */
function byDateDesc(a: BlogCard, b: BlogCard) {
  const ad = a.date ? new Date(a.date).getTime() : 0;
  const bd = b.date ? new Date(b.date).getTime() : 0;
  return bd - ad;
}

/** Stable date formatter (avoid locale surprises) */
const fmt = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

/** Read all MDX posts from /app/routes/blog+ on disk */
async function readAllPosts(): Promise<BlogCard[]> {
  const dir = path.join(process.cwd(), "app", "routes", "blog+");
  const dirents = await fs.readdir(dir, { withFileTypes: true });

  const mdxFiles = dirents
    .filter((d) => d.isFile() && d.name.endsWith(".mdx") && !d.name.startsWith("_") && !d.name.startsWith("$"))
    .map((d) => d.name);

  const posts: BlogCard[] = [];

  for (const file of mdxFiles) {
    try {
      const raw = await fs.readFile(path.join(dir, file), "utf8");
      const { data } = matter(raw) as { data: any };

      const fileSlug = file.replace(/\.mdx$/i, "");
      const resolvedSlug = data?.slug ? safeSlug(String(data.slug)) : safeSlug(fileSlug);

      posts.push({
        slug: resolvedSlug,
        title: data?.title ?? fileSlug,
        description: data?.description ?? "",
        date: data?.date ?? undefined,
        author: data?.author ?? undefined,
        tags: Array.isArray(data?.tags) ? data.tags : undefined,
        cover: data?.cover ?? undefined,
      });
    } catch {
      // Skip unreadable/invalid files; optionally log if you have a logger
      continue;
    }
  }

  posts.sort(byDateDesc);
  return posts;
}

/** Loader: returns the array of cards with pagination */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const pageSize = Math.min(24, Math.max(6, Number(url.searchParams.get("limit") ?? 12)));

  const all = await readAllPosts();
  const total = all.length;
  const start = (page - 1) * pageSize;
  const posts = all.slice(start, start + pageSize);

  return json(
    {
      posts,
      page,
      pageSize,
      total,
      baseUrl: `${url.origin}/blog`,
    },
    {
      headers: {
        // Short public cache; adjust as needed or wire to your CDN
        "Cache-Control": "public, max-age=60, s-maxage=300",
      },
    }
  );
}

/** Meta: canonical + prev/next + basic OG/Twitter */
export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const title = "The Blog – Job market trends, guides & product updates";
  const description = "Fresh, practical articles to level up your job search.";

  // If data is undefined (edge cases), fall back to base /blog
  const page = data?.page ?? 1;
  const pageSize = data?.pageSize ?? 12;
  const total = data?.total ?? 0;
  const baseUrl = data?.baseUrl ?? "https://example.com/blog";

  const thisUrl = page === 1 ? baseUrl : `${baseUrl}?page=${page}&limit=${pageSize}`;
  const nextUrl = page * pageSize < total ? `${baseUrl}?page=${page + 1}&limit=${pageSize}` : null;
  const prevUrl = page > 1 ? `${baseUrl}?page=${page - 1}&limit=${pageSize}` : null;

  const image = "https://example.com/og/blog-og.jpg"; // replace with your real OG image

  const tags: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: thisUrl },
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: thisUrl },
    { property: "og:image", content: image },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];

  if (prevUrl) tags.push({ tagName: "link", rel: "prev", href: prevUrl });
  if (nextUrl) tags.push({ tagName: "link", rel: "next", href: nextUrl });

  return tags;
};

/** JSON-LD for Blog + ItemList (first page slice) */
function BlogLdJson({ posts }: { posts: BlogCard[] }) {
  const ldBlog = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "The Blog",
    "description": "Fresh, practical articles to level up your job search.",
  };

  const listItems = posts.slice(0, 12).map((p, i) => ({
    "@type": "ListItem",
    position: i + 1,
    url: `/blog/${p.slug}`,
  }));

  const ldList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: listItems,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldBlog) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ldList) }}
      />
    </>
  );
}

/** Pagination UI */
function Pager({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const hasPrev = page > 1;
  const hasNext = page * pageSize < total;

  if (total <= pageSize) return null;

  return (
    <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
      <Link
        prefetch="intent"
        to={{ pathname: "/blog", search: `?page=${page - 1}&limit=${pageSize}` }}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          hasPrev ? "hover:bg-secondary" : "opacity-40 pointer-events-none"
        }`}
        aria-disabled={!hasPrev}
      >
        ← Previous
      </Link>
      <span className="text-sm text-muted-foreground">
        Page {page} of {Math.max(1, Math.ceil(total / pageSize))}
      </span>
      <Link
        prefetch="intent"
        to={{ pathname: "/blog", search: `?page=${page + 1}&limit=${pageSize}` }}
        className={`rounded-md border px-3 py-1.5 text-sm ${
          hasNext ? "hover:bg-secondary" : "opacity-40 pointer-events-none"
        }`}
        aria-disabled={!hasNext}
      >
        Next →
      </Link>
    </nav>
  );
}

/** Component: simple, clean grid with small SEO/CWV upgrades */
export default function BlogIndex() {
  const { posts, page, pageSize, total } = useLoaderData<typeof loader>();

  return (
    <main className="min-h-screen">
      {/* Header */}
      <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 pt-12 pb-6 text-center">
        <p className="text-sm text-muted-foreground">The Blog</p>
        <h1 className="mt-2 text-4xl md:text-5xl font-bold tracking-tight">
          Job market trends, job search guides,<br className="hidden md:block" />
          product updates, and more…
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Fresh, practical articles to level up your job search.
        </p>
      </section>

      {/* Grid of posts */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-10">
        <ul className="grid gap-8 md:grid-cols-2">
          {posts.map((post) => (
            <li key={post.slug} className="group">
              <Link
                prefetch="intent"
                to={`/blog/${post.slug}`}
                className="block focus:outline-none"
              >
                <article className="h-full overflow-hidden rounded-2xl border bg-card transition hover:shadow-lg">
                  {/* Optional cover */}
                  {post.cover ? (
                    <div className="aspect-[16/9] overflow-hidden">
                      <img
                        src={post.cover}
                        alt={post.title}
                        width={1200}
                        height={675}
                        loading="lazy"
                        decoding="async"
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                      />
                    </div>
                  ) : null}

                  <div className="p-6">
                    {/* Tags (show up to 2, non-clickable to avoid route deps) */}
                    {post.tags?.length ? (
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {post.tags.slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-secondary/60 px-2 py-0.5"
                          >
                            {t}
                          </span>
                        ))}
                        {post.tags.length > 2 ? (
                          <span className="rounded-full bg-secondary/60 px-2 py-0.5">
                            +{post.tags.length - 2}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <h2 className="text-xl font-semibold leading-snug group-hover:underline">
                      {post.title}
                    </h2>

                    {post.description ? (
                      <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                        {post.description}
                      </p>
                    ) : null}

                    <div className="mt-4 flex items-center gap-3 text-xs text-muted-foreground">
                      {post.author ? <span>by {post.author}</span> : null}
                      {post.author && post.date ? <span>•</span> : null}
                      {post.date ? (
                        <time dateTime={post.date}>
                          {fmt.format(new Date(post.date))}
                        </time>
                      ) : null}
                    </div>
                  </div>
                </article>
              </Link>
            </li>
          ))}
        </ul>

        {/* Pagination */}
        <Pager page={page} pageSize={pageSize} total={total} />
      </section>

      {/* JSON-LD for Blog + ItemList */}
      <BlogLdJson posts={posts} />
    </main>
  );
}

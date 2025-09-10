import { json, type LoaderFunctionArgs } from '@remix-run/node'
import { bundleMDX } from 'mdx-bundler'
import remarkGfm from 'remark-gfm'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

export async function loader({ params }: LoaderFunctionArgs) {
  const slug = params.slug!
  const file = await fs.readFile(path.join(process.cwd(), 'content', `${slug}.mdx`), 'utf8')
  const { code, frontmatter } = await bundleMDX({
    source: file,
    mdxOptions(opts) {
      opts.remarkPlugins = [...(opts.remarkPlugins ?? []), remarkGfm]
      return opts
    },
  })
  return json({ code, frontmatter })
}

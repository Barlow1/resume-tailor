import { json } from '@remix-run/node'
import { Link, useLoaderData } from '@remix-run/react'

export const loader = () => {
  return json({
    templates: [
      { id: 'clean',   name: 'Clean',   img: '/public/templates/Professional.png' },
      { id: 'modern',  name: 'Modern',  img: '/public/templates/Modern.png' },
      { id: 'classic', name: 'Classic', img: '/public/templates/Traditional.png' },
    ],
  })
}

export default function SelectTemplate() {
  const { templates } = useLoaderData<typeof loader>()
  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="mb-6 text-2xl font-bold">Pick a starting point</h1>
      <div className="grid gap-6 md:grid-cols-3">
        {templates.map(t => (
          <Link
            key={t.id}
            to={`/builder?template=${t.id}&demo=true`}
            prefetch="intent"
            className="group"
          >
            <img
              src={t.img}
              alt={`${t.name} resume example`}
              className="rounded-xl shadow transition group-hover:scale-105"
            />
            <p className="mt-2 text-center font-medium">{t.name}</p>
          </Link>
        ))}
      </div>
    </main>
  )
}

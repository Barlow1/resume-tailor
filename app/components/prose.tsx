import * as React from 'react'
import clsx from 'clsx'

export function Prose({
  className,
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <article
      className={clsx(
        'prose prose-zinc lg:prose-lg dark:prose-invert',
        'prose-headings:scroll-mt-24',
        'prose-img:rounded-2xl prose-pre:rounded-xl',
        'prose-hr:my-10',
        'prose-a:no-underline',
        className
      )}
    >
      {children}
    </article>
  )
}

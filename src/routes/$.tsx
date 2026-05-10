import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/$')({
  component: CatchAllPage,
})

function CatchAllPage() {
  return (
    <main className="min-h-screen bg-[#F7F7F2] px-6 py-10 text-neutral-950">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col justify-center">
        <div className="mb-4 inline-flex w-fit rounded-full border border-neutral-300 bg-white px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-neutral-600">
          Route check
        </div>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-5xl">
          That local URL does not map to a page.
        </h1>
        <p className="mt-4 max-w-2xl text-base font-medium leading-7 text-neutral-600">
          The app is running, but this path is not a real route. Use the reader, industry pages,
          or the live search console.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/"
            className="inline-flex rounded-xl bg-neutral-950 px-4 py-3 text-sm font-black text-white"
          >
            Open reader
          </Link>
          <Link
            to="/cleanseek-x"
            className="inline-flex rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-black text-neutral-900"
          >
            Search live
          </Link>
          <Link
            to="/industries"
            className="inline-flex rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-black text-neutral-900"
          >
            Industries
          </Link>
        </div>
      </div>
    </main>
  )
}

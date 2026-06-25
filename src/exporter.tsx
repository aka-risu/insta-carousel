import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { toPng, getFontEmbedCSS } from 'html-to-image'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Project } from './model'
import { microLabels, projectToText } from './model'
import { layout, themeById, slideHeightFor } from './tokens'
import { Slide } from './slides/Slide'

// renders every slide offscreen at natural 1080×1350 (no transform — scaled
// nodes export blurry), rasterizes each to png, zips with caption.txt.
//
// `only` (a slide index) exports just that one slide as a standalone png — but
// it's still rendered inside the full deck, so its page number, micro-label and
// index/total read exactly as they do in the full export.
export async function exportCarousel(
  project: Project,
  assets: Record<string, string>,
  onProgress: (done: number, total: number) => void,
  only?: number,
): Promise<void> {
  const total = project.slides.length
  if (total === 0) throw new Error('nothing to export — add at least one slide')
  if (only != null && (only < 0 || only >= total)) {
    throw new Error('slide to export is out of range')
  }

  const theme = themeById(project.themeId)
  const labels = microLabels(project, theme)
  const slideH = slideHeightFor(project.ratio)
  const showPageNumber = project.chrome?.pageNumbers !== false
  const showWordmark = project.chrome?.wordmark !== false

  // offscreen but rendered: off the left edge, natural size, no transforms
  const container = document.createElement('div')
  Object.assign(container.style, {
    position: 'fixed',
    top: '0',
    left: `-${layout.slideW + 200}px`,
    width: `${layout.slideW}px`,
    pointerEvents: 'none',
  })
  document.body.appendChild(container)
  const root = createRoot(container)

  try {
    flushSync(() => {
      root.render(
        <div>
          {project.slides.map((slide, i) => (
            <div
              key={slide.id}
              data-slide={i}
              style={{ width: layout.slideW, height: slideH }}
            >
              <Slide
                slide={slide}
                microLabel={labels[i]}
                index={i}
                total={total}
                theme={theme}
                assets={assets}
                slideH={slideH}
                showPageNumber={showPageNumber}
                showWordmark={showWordmark}
              />
            </div>
          ))}
        </div>,
      )
    })

    // fonts must be fully loaded or the rasterized text falls back
    await document.fonts.ready
    await waitForImages(container)
    await nextFrame()

    const allNodes = Array.from(container.querySelectorAll<HTMLElement>('[data-slide]'))

    // compute the @font-face embed css once instead of per-slide — this is
    // what keeps a 10-slide export well under 15s
    const fontCss = await getFontEmbedCSS(allNodes[0])

    const render = (node: HTMLElement) =>
      toPng(node, {
        width: layout.slideW,
        height: slideH,
        pixelRatio: 1,
        fontEmbedCSS: fontCss,
      })

    // single-slide export: one png, no zip
    if (only != null) {
      const dataUrl = await render(allNodes[only])
      onProgress(1, 1)
      saveAs(dataUrl, `antara-slide-${String(only + 1).padStart(2, '0')}.png`)
      return
    }

    const zip = new JSZip()
    for (let i = 0; i < allNodes.length; i++) {
      const dataUrl = await render(allNodes[i])
      zip.file(`${String(i + 1).padStart(2, '0')}.png`, dataUrl.split(',')[1], {
        base64: true,
      })
      onProgress(i + 1, total)
    }

    zip.file('caption.txt', projectToText(project))

    const blob = await zip.generateAsync({ type: 'blob' })
    saveAs(blob, 'antara-carousel.zip')
  } finally {
    root.unmount()
    container.remove()
  }
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
}

function waitForImages(scope: HTMLElement): Promise<void> {
  const imgs = Array.from(scope.querySelectorAll('img'))
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve()
          img.onload = () => resolve()
          img.onerror = () => resolve() // missing assets must not block export
        }),
    ),
  ).then(() => undefined)
}

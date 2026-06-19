import type {
  ElementKey,
  ImageMode,
  SlideModel,
  TextBacking,
  TextBgStyle,
} from '../model'
import {
  DEFAULT_IMAGE_FRAC,
  IMAGE_FRAC_RANGE,
  SIZE_RANGE,
  autoSize,
  elementDef,
} from '../model'
import type { Theme } from '../tokens'

const hasSizeControl = (k: ElementKey): boolean => k !== 'image'

export interface ElementPanelProps {
  slide: SlideModel
  elementKey: ElementKey
  theme: Theme
  assets: Record<string, string>
  bodyRef: React.RefObject<HTMLTextAreaElement | null>
  updateSlide: (id: string, changes: Partial<SlideModel>) => void
  removeElement: (id: string, key: ElementKey) => void
  setSize: (id: string, key: ElementKey, value: number | undefined) => void
  setElementColor: (id: string, key: ElementKey, value: string | undefined) => void
  setTextBg: (id: string, key: ElementKey, value: TextBacking | undefined) => void
  wrapSelection: (open: string, close: string) => void
  onClose: () => void
}

export function ElementPanel(props: ElementPanelProps) {
  const { slide, elementKey: key, theme, assets, bodyRef, updateSlide, removeElement, setSize, setElementColor, setTextBg, wrapSelection } = props
  const def = elementDef(slide.type, key)

  return (
    <div className="field selected-el">
      <span className="field-label">
        {def.label}
        <button
          className="field-remove"
          title={`remove ${def.label} from this slide`}
          onClick={() => removeElement(slide.id, key)}
        >
          ×
        </button>
      </span>

      {/* ── content ── */}
      <span className="group-label">content</span>

      {def.asset ? (
        <select
          value={slide[key]}
          onChange={(e) => updateSlide(slide.id, { [key]: e.target.value })}
        >
          <option value="">( none )</option>
          {Object.keys(assets).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {slide[key] && !assets[slide[key]] && (
            <option value={slide[key]}>⚠ {slide[key]} (missing)</option>
          )}
        </select>
      ) : def.multiline ? (
        <textarea
          ref={key === 'text' ? bodyRef : undefined}
          rows={3}
          value={slide[key]}
          onChange={(e) => updateSlide(slide.id, { [key]: e.target.value })}
        />
      ) : (
        <input
          value={slide[key]}
          onChange={(e) => updateSlide(slide.id, { [key]: e.target.value })}
        />
      )}
      <span className="field-hint">{def.hint}</span>

      {/* emphasis marks — select a word in the body, then click */}
      {key === 'text' && (
        <div className="marks-row">
          <span className="size-label">mark selection</span>
          <button className="mark-btn" title="pen circle around the selected words" onClick={() => wrapSelection('*', '*')}>
            ◯ circle
          </button>
          <button className="mark-btn" title="underline the selected words" onClick={() => wrapSelection('_', '_')}>
            <u>underline</u>
          </button>
          <button className="mark-btn" title="highlighter over the selected words" onClick={() => wrapSelection('==', '==')}>
            <span className="mark-hl">highlight</span>
          </button>
        </div>
      )}

      {/* manual size control — available on every text element */}
      {hasSizeControl(key) &&
        (() => {
          const range = SIZE_RANGE[key]
          const current = slide.sizes?.[key] ?? autoSize(slide, key)
          const isAuto = slide.sizes?.[key] == null
          return (
            <div className="size-row">
              <span className="size-label">size</span>
              <button
                className={`size-auto ${isAuto ? 'on' : ''}`}
                onClick={() => setSize(slide.id, key, undefined)}
                title="automatic size"
              >
                auto
              </button>
              <input
                type="range"
                min={range.min}
                max={range.max}
                step={range.step}
                value={current}
                onChange={(e) => setSize(slide.id, key, Number(e.target.value))}
              />
              <span className="size-val">{current}px</span>
            </div>
          )
        })()}

      {/* image placement — boxed inline plate, or a full-bleed band */}
      {key === 'image' && (
        <>
          <div className="size-row">
            <span className="size-label">placement</span>
            {(['inline', 'top', 'bottom'] as ImageMode[]).map((m) => (
              <button
                key={m}
                className={`size-auto ${(slide.imageMode ?? 'inline') === m ? 'on' : ''}`}
                onClick={() =>
                  updateSlide(slide.id, {
                    imageMode: m === 'inline' ? undefined : m,
                  })
                }
                title={
                  m === 'inline'
                    ? 'boxed plate in the text flow'
                    : `full-bleed image pinned to the ${m}`
                }
              >
                {m}
              </button>
            ))}
          </div>
          {(slide.imageMode === 'top' || slide.imageMode === 'bottom') && (
            <div className="size-row">
              <span className="size-label">height</span>
              <input
                type="range"
                min={IMAGE_FRAC_RANGE.min}
                max={IMAGE_FRAC_RANGE.max}
                step={IMAGE_FRAC_RANGE.step}
                value={slide.imageFrac ?? DEFAULT_IMAGE_FRAC}
                onChange={(e) =>
                  updateSlide(slide.id, { imageFrac: Number(e.target.value) })
                }
              />
              <span className="size-val">
                {Math.round((slide.imageFrac ?? DEFAULT_IMAGE_FRAC) * 100)}%
              </span>
            </div>
          )}
        </>
      )}

      {/* ── style ── (omit entirely for image; image has no color/backing) */}
      {key !== 'image' && (
        <>
          <span className="group-label">style</span>

          {/* per-element text color — overrides the palette color */}
          {(() => {
            const cur = slide.colors?.[key]
            return (
              <div className="size-row">
                <span className="size-label">color</span>
                <button
                  className={`size-auto ${cur == null ? 'on' : ''}`}
                  onClick={() => setElementColor(slide.id, key, undefined)}
                  title="use the theme color"
                >
                  auto
                </button>
                <input
                  type="color"
                  value={cur || theme.base.fg}
                  onChange={(e) => setElementColor(slide.id, key, e.target.value)}
                />
                <span className="size-val">{cur ?? 'theme'}</span>
              </div>
            )
          })()}

          {/* per-element text backing plate — legibility on busy images */}
          {(() => {
            const tb = slide.textBg?.[key]
            const styles: TextBgStyle[] = ['box', 'pill', 'highlight', 'band']
            const tokens = ['paper', 'accent', 'fg', 'dim'] as const
            return (
              <>
                <div className="size-row">
                  <span className="size-label">backing</span>
                  <button
                    className={`size-auto ${!tb ? 'on' : ''}`}
                    onClick={() => setTextBg(slide.id, key, undefined)}
                    title="no backing"
                  >
                    off
                  </button>
                  {styles.map((st) => (
                    <button
                      key={st}
                      className={`size-auto ${tb?.style === st ? 'on' : ''}`}
                      onClick={() =>
                        setTextBg(slide.id, key, {
                          style: st,
                          color: tb?.color ?? 'paper',
                          opacity: tb?.opacity ?? 1,
                        })
                      }
                    >
                      {st}
                    </button>
                  ))}
                </div>
                {tb && (
                  <>
                    <div className="size-row">
                      <span className="size-label">plate</span>
                      {tokens.map((tok) => (
                        <button
                          key={tok}
                          className={`size-auto ${tb.color === tok ? 'on' : ''}`}
                          onClick={() => setTextBg(slide.id, key, { ...tb, color: tok })}
                        >
                          {tok}
                        </button>
                      ))}
                      <input
                        type="color"
                        value={tb.color.startsWith('#') ? tb.color : '#ffffff'}
                        onChange={(e) =>
                          setTextBg(slide.id, key, { ...tb, color: e.target.value })
                        }
                      />
                    </div>
                    <div className="size-row">
                      <span className="size-label">opacity</span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={tb.opacity ?? 1}
                        onChange={(e) =>
                          setTextBg(slide.id, key, {
                            ...tb,
                            opacity: Number(e.target.value),
                          })
                        }
                      />
                      <span className="size-val">
                        {Math.round((tb.opacity ?? 1) * 100)}%
                      </span>
                    </div>
                  </>
                )}
              </>
            )
          })()}
        </>
      )}
    </div>
  )
}

import { useRef } from 'react'
import type {
  SlideModel,
  SlideOverlay,
} from '../model'
import { SLIDE_TYPES } from '../model'
import type { Theme } from '../tokens'

export interface SlidePanelProps {
  slide: SlideModel
  theme: Theme
  assets: Record<string, string>
  updateSlide: (id: string, changes: Partial<SlideModel>) => void
  setOverlay: (id: string, value: SlideOverlay | undefined) => void
  addFiles: (files: FileList | File[], onAdded?: (names: string[]) => void) => void | Promise<void>
}

export function SlidePanel({
  slide,
  theme,
  assets,
  updateSlide,
  setOverlay,
  addFiles,
}: SlidePanelProps) {
  const bgInput = useRef<HTMLInputElement>(null)

  return (
    <>
      <label className="pane-label">
        editing · {SLIDE_TYPES[slide.type].name}
      </label>
      <p className="type-about">{SLIDE_TYPES[slide.type].about}</p>

      <div className="field">
        <label className="field-label" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={!slide.eyebrowOff}
            style={{ width: 15, height: 15, cursor: 'pointer', accentColor: 'var(--accent, #b9a87c)' }}
            onChange={(e) => updateSlide(slide.id, { eyebrowOff: e.target.checked ? undefined : true })}
          />
          <span>eyebrow</span>
        </label>
        <input
          type="text"
          value={slide.eyebrow ?? ''}
          placeholder="auto label — e.g. the truth"
          disabled={slide.eyebrowOff}
          onChange={(e) => updateSlide(slide.id, { eyebrow: e.target.value || undefined })}
        />
        <span className="field-hint">
          {slide.eyebrowOff
            ? 'hidden on this slide — tick to show'
            : "the small label in the slide's corner. empty = the theme's auto label"}
        </span>
      </div>

      {theme.backgrounds && (
        <div className="field">
          <span className="field-label">background plate</span>
          <select
            value={slide.background ?? ''}
            onChange={(e) =>
              updateSlide(slide.id, { background: e.target.value || undefined })
            }
          >
            <option value="">auto (by position)</option>
            {theme.backgrounds.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <span className="field-hint">
            each slide cycles through the chart plates unless you pin one here
          </span>
        </div>
      )}

      {/* per-slide background image + overlay — works on any theme */}
      <div className="field">
        <span className="field-label">slide background</span>
        <select
          value={slide.bgImage ?? ''}
          onChange={(e) =>
            updateSlide(slide.id, { bgImage: e.target.value || undefined })
          }
        >
          <option value="">none (use theme)</option>
          {Object.keys(assets).map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
          {slide.bgImage && !assets[slide.bgImage] && (
            <option value={slide.bgImage}>⚠ {slide.bgImage} (missing)</option>
          )}
        </select>
        <div className="add-row">
          <button className="add-chip" onClick={() => bgInput.current?.click()}>
            + upload image
          </button>
          <input
            type="file"
            accept="image/*"
            ref={bgInput}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.length)
                void addFiles(e.target.files, (names) =>
                  updateSlide(slide.id, { bgImage: names[0] }),
                )
              e.target.value = ''
            }}
          />
        </div>
        <span className="field-hint">
          a full-slide photo behind everything — reuse an uploaded image or add one
        </span>

        <div className="size-row">
          <span className="size-label">overlay</span>
          <button
            className={`size-auto ${!slide.overlay ? 'on' : ''}`}
            onClick={() => setOverlay(slide.id, undefined)}
            title="no tint"
          >
            off
          </button>
          {(['wash', 'top', 'bottom'] as const).map((m) => (
            <button
              key={m}
              className={`size-auto ${slide.overlay?.mode === m ? 'on' : ''}`}
              onClick={() =>
                setOverlay(slide.id, {
                  color: slide.overlay?.color ?? '#000000',
                  opacity: slide.overlay?.opacity ?? 0.4,
                  mode: m,
                })
              }
              title={m === 'wash' ? 'even tint across the slide' : `fade from the ${m}`}
            >
              {m}
            </button>
          ))}
        </div>
        {slide.overlay && (
          <>
            <div className="size-row">
              <span className="size-label">tint</span>
              <input
                type="color"
                value={slide.overlay.color}
                onChange={(e) =>
                  setOverlay(slide.id, {
                    ...slide.overlay!,
                    color: e.target.value,
                  })
                }
              />
              <span className="size-val">{slide.overlay.color}</span>
            </div>
            <div className="size-row">
              <span className="size-label">opacity</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={slide.overlay.opacity}
                onChange={(e) =>
                  setOverlay(slide.id, {
                    ...slide.overlay!,
                    opacity: Number(e.target.value),
                  })
                }
              />
              <span className="size-val">
                {Math.round(slide.overlay.opacity * 100)}%
              </span>
            </div>
          </>
        )}
      </div>
    </>
  )
}

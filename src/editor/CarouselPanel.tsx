import { useRef } from 'react'
import type { Project } from '../model'
import type { Theme, CustomThemeData, ColorOverrides } from '../tokens'

export interface CarouselPanelProps {
  project: Project
  theme: Theme
  custom: CustomThemeData
  setCustom: React.Dispatch<React.SetStateAction<CustomThemeData>>
  setCustomBg: (file: File) => void
  autoColors: () => void
  setProjectColor: (key: keyof ColorOverrides, value: string | undefined) => void
  // assets
  assets: Record<string, string>
  builtinAssets: Record<string, string>
  userImages: Record<string, string>
  missing: string[]
  dragging: boolean
  setDragging: (v: boolean) => void
  storageFull: boolean
  addFiles: (files: FileList | File[], onAdded?: (names: string[]) => void) => void | Promise<void>
  removeAsset: (name: string) => void
}

export function CarouselPanel(props: CarouselPanelProps) {
  const customBgInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  return (
    <>
      {props.project.themeId === 'custom' && (
        <div className="custom-theme">
          <label className="pane-label">custom theme</label>
          <div
            className="asset-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              if (e.dataTransfer.files[0]) props.setCustomBg(e.dataTransfer.files[0])
            }}
            onClick={() => customBgInput.current?.click()}
          >
            {props.custom.bg ? 'drop a new background, or click to replace' : 'drop a background image, or click to pick'}
            <input
              ref={customBgInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                if (e.target.files?.[0]) props.setCustomBg(e.target.files[0])
                e.target.value = ''
              }}
            />
          </div>

          {props.custom.bg && (
            <div className="custom-bg-row">
              <img className="custom-bg-preview" src={props.custom.bg} alt="custom background" />
              <button className="ghost-btn" onClick={props.autoColors}>
                auto colors from image
              </button>
              <button className="ghost-btn" onClick={() => props.setCustom((c) => ({ ...c, bg: '' }))}>
                remove image
              </button>
            </div>
          )}

          <div className="color-rows">
            {([
              ['fg', 'text'],
              ['dim', 'secondary'],
              ['accent', 'accent'],
              ['paper', 'paper'],
            ] as const).map(([key, label]) => (
              <label key={key} className="color-row">
                <input
                  type="color"
                  value={props.custom[key]}
                  onChange={(e) => props.setCustom((c) => ({ ...c, [key]: e.target.value }))}
                />
                <span>{label}</span>
                <code>{props.custom[key]}</code>
              </label>
            ))}
          </div>
          <span className="field-hint">
            upload an image and colors auto-fill for contrast — nudge any of them. with no image,
            this is just a colored paper theme. saved across reloads.
          </span>
        </div>
      )}

      {props.project.themeId !== 'custom' && (
        <div className="custom-theme">
          <label className="pane-label">text colors</label>
          <div className="color-rows">
            {([
              ['fg', 'text'],
              ['dim', 'secondary'],
              ['accent', 'accent'],
            ] as const).map(([key, label]) => {
              const overridden = props.project.colors?.[key] != null
              return (
                <label key={key} className="color-row">
                  <input
                    type="color"
                    value={props.project.colors?.[key] || props.theme.base[key]}
                    onChange={(e) => props.setProjectColor(key, e.target.value)}
                  />
                  <span>{label}</span>
                  <code>{overridden ? props.project.colors?.[key] : 'theme'}</code>
                  {overridden && (
                    <button
                      className="field-remove"
                      title={`reset ${label} to the theme color`}
                      onClick={() => props.setProjectColor(key, undefined)}
                    >
                      ×
                    </button>
                  )}
                </label>
              )
            })}
          </div>
          <span className="field-hint">
            recolor text, secondary chrome and marks across this whole carousel — on top of the
            "{props.theme.name}" theme. leave as "theme" to keep its colors.
          </span>
        </div>
      )}

      <label className="pane-label">assets</label>
      {props.storageFull && (
        <p className="field-hint" style={{ color: '#b0462f' }}>
          ⚠ browser storage is full — new images stay for this session but won't survive a
          reload. remove unused images to free space.
        </p>
      )}
      <div
        className={`asset-drop ${props.dragging ? 'dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          props.setDragging(true)
        }}
        onDragLeave={() => props.setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          props.setDragging(false)
          props.addFiles(e.dataTransfer.files)
        }}
        onClick={() => fileInput.current?.click()}
      >
        drop images here, or click to pick
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files) props.addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {(Object.keys(props.assets).length > 0 || props.missing.length > 0) && (
        <div className="asset-chips">
          {Object.entries(props.assets).map(([name, url]) => (
            <span key={name} className="chip" title={name}>
              <img src={url} alt="" />
              {name}
              {!props.builtinAssets[name] && (
                <button className="chip-x" onClick={() => props.removeAsset(name)} aria-label={`remove ${name}`}>
                  ×
                </button>
              )}
            </span>
          ))}
          {props.missing.map((name) => (
            <span key={name} className="chip chip-missing" title={`${name} not uploaded`}>
              ⚠ {name}
            </span>
          ))}
        </div>
      )}
    </>
  )
}

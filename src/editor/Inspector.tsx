import { useState } from 'react'
import type { Project, ProjectChrome, SlideModel, ElementKey, SlideOverlay, TextBacking, Align } from '../model'
import { AVAILABLE_ELEMENTS, elementDef } from '../model'
import type { Theme, CustomThemeData, ColorOverrides } from '../tokens'
import { CarouselPanel } from './CarouselPanel'
import { SlidePanel } from './SlidePanel'
import { ElementPanel } from './ElementPanel'

export interface InspectorProps {
  // selection
  selected: SlideModel | null
  activeElement: ElementKey | null

  // carousel-level (CarouselPanel)
  project: Project
  theme: Theme
  custom: CustomThemeData
  setCustom: React.Dispatch<React.SetStateAction<CustomThemeData>>
  setCustomBg: (file: File) => void
  autoColors: () => void
  setProjectColor: (key: keyof ColorOverrides, value: string | undefined) => void
  setChrome: (changes: Partial<ProjectChrome>) => void
  assets: Record<string, string>
  builtinAssets: Record<string, string>
  userImages: Record<string, string>
  missing: string[]
  dragging: boolean
  setDragging: (v: boolean) => void
  storageFull: boolean
  addFiles: (files: FileList | File[], onAdded?: (names: string[]) => void) => void | Promise<void>
  removeAsset: (name: string) => void
  clearUnusedImages: () => number

  // slide-level (SlidePanel)
  patch: (fn: (p: Project) => Project) => void
  updateSlide: (id: string, changes: Partial<SlideModel>) => void
  setOverlay: (id: string, value: SlideOverlay | undefined) => void

  // layout controls (passed through to slide-tab / no-element branch in App)
  layoutClip: SlideModel['positions'] | null
  resetLayout: (id: string) => void
  // revert the selected slide to its last imported/saved version
  resetSlide: (id: string) => void
  canResetSlide: boolean
  copyLayout: () => void
  pasteLayout: (id: string) => void
  applyLayoutToAll: () => void

  // element-level (ElementPanel)
  bodyRef: React.RefObject<HTMLTextAreaElement | null>
  removeElement: (id: string, key: ElementKey) => void
  setSize: (id: string, key: ElementKey, value: number | undefined) => void
  setWidth: (id: string, key: ElementKey, value: number | undefined) => void
  setElementColor: (id: string, key: ElementKey, value: string | undefined) => void
  setHlColor: (id: string, key: ElementKey, value: string | undefined) => void
  setAlign: (id: string, key: ElementKey, value: Align | undefined) => void
  setTextBg: (id: string, key: ElementKey, value: TextBacking | undefined) => void
  wrapSelection: (open: string, close: string) => void
  onCloseElement: () => void

  // add-element chips
  addElement: (id: string, key: ElementKey) => void
  // select an element from the slide's element menu (opens the element panel)
  selectElement: (key: ElementKey) => void
}

export function Inspector(props: InspectorProps) {
  const [tab, setTab] = useState<'slide' | 'carousel'>('slide')

  const {
    selected,
    activeElement,
    project,
    theme,
    custom,
    setCustom,
    setCustomBg,
    autoColors,
    setProjectColor,
    setChrome,
    assets,
    builtinAssets,
    userImages,
    missing,
    dragging,
    setDragging,
    storageFull,
    addFiles,
    removeAsset,
    clearUnusedImages,
    patch,
    updateSlide,
    setOverlay,
    layoutClip,
    resetLayout,
    resetSlide,
    canResetSlide,
    copyLayout,
    pasteLayout,
    applyLayoutToAll,
    bodyRef,
    removeElement,
    setSize,
    setWidth,
    setElementColor,
    setHlColor,
    setAlign,
    setTextBg,
    wrapSelection,
    onCloseElement,
    addElement,
    selectElement,
  } = props

  return (
    <div className="inspector">
      <div className="inspector-tabs">
        <button className={tab === 'slide' ? 'on' : ''} onClick={() => setTab('slide')}>
          slide
        </button>
        <button className={tab === 'carousel' ? 'on' : ''} onClick={() => setTab('carousel')}>
          carousel
        </button>
      </div>

      {tab === 'carousel' ? (
        <CarouselPanel
          project={project}
          theme={theme}
          custom={custom}
          setCustom={setCustom}
          setCustomBg={setCustomBg}
          autoColors={autoColors}
          setProjectColor={setProjectColor}
          setChrome={setChrome}
          assets={assets}
          builtinAssets={builtinAssets}
          userImages={userImages}
          missing={missing}
          dragging={dragging}
          setDragging={setDragging}
          storageFull={storageFull}
          addFiles={addFiles}
          removeAsset={removeAsset}
          clearUnusedImages={clearUnusedImages}
        />
      ) : selected ? (
        activeElement ? (
          <ElementPanel
            slide={selected}
            elementKey={activeElement}
            theme={theme}
            assets={assets}
            bodyRef={bodyRef}
            updateSlide={updateSlide}
            removeElement={removeElement}
            setSize={setSize}
            setWidth={setWidth}
            setElementColor={setElementColor}
            setHlColor={setHlColor}
            setAlign={setAlign}
            setTextBg={setTextBg}
            wrapSelection={wrapSelection}
            onClose={onCloseElement}
          />
        ) : (
          <>
            <SlidePanel
              slide={selected}
              theme={theme}
              assets={assets}
              patch={patch}
              updateSlide={updateSlide}
              setOverlay={setOverlay}
              addFiles={addFiles}
            />

            {selected.elements.length > 0 && (
              <div className="field">
                <span className="field-label">elements</span>
                <div className="element-list">
                  {selected.elements.map((k) => {
                    const empty = !selected[k]
                    return (
                      <button
                        key={k}
                        className="element-row"
                        title={
                          empty
                            ? `${elementDef(selected.type, k).label} — empty; select to add text`
                            : elementDef(selected.type, k).hint
                        }
                        onClick={() => selectElement(k)}
                      >
                        <span className="element-row-label">
                          {elementDef(selected.type, k).label}
                        </span>
                        {empty && <span className="element-row-empty">empty</span>}
                      </button>
                    )
                  })}
                </div>
                <span className="field-hint">
                  every element on this slide — click to edit it. an empty element won't show on
                  the slide until you give it text.
                </span>
              </div>
            )}

            <div className="field">
              <span className="field-label">layout</span>
              <div className="size-row">
                <button
                  className={`size-auto ${!selected.free ? 'on' : ''}`}
                  onClick={() => resetLayout(selected.id)}
                  title="auto-stack the elements (clears free positions)"
                >
                  auto
                </button>
                {/* copy/paste/apply move positions between like-keyed slides;
                    diagrams use their own annotation-line keys, so they only
                    get the auto reset */}
                {selected.type !== 'diagram' && (
                  <>
                    <button
                      className="mark-btn"
                      onClick={copyLayout}
                      disabled={!selected.free}
                      title="copy this slide's element positions"
                    >
                      copy
                    </button>
                    <button
                      className="mark-btn"
                      onClick={() => pasteLayout(selected.id)}
                      disabled={!layoutClip}
                      title="paste the copied positions onto this slide"
                    >
                      paste
                    </button>
                    <button
                      className="mark-btn"
                      onClick={applyLayoutToAll}
                      disabled={!selected.free}
                      title="apply this slide's layout to every other slide"
                    >
                      apply to all
                    </button>
                  </>
                )}
              </div>
              <span className="field-hint">
                drag any element on the slide preview to place it freely. "auto" returns to
                automatic stacking.
              </span>
            </div>

            {AVAILABLE_ELEMENTS[selected.type].filter((k) => !selected.elements.includes(k))
              .length > 0 && (
              <div className="field">
                <span className="field-label">add element</span>
                <div className="add-row">
                  {AVAILABLE_ELEMENTS[selected.type]
                    .filter((k) => !selected.elements.includes(k))
                    .map((k) => (
                      <button
                        key={k}
                        className="add-chip"
                        title={elementDef(selected.type, k).hint}
                        onClick={() => addElement(selected.id, k)}
                      >
                        + {elementDef(selected.type, k).label}
                      </button>
                    ))}
                </div>
              </div>
            )}

            <div className="field">
              <button
                className="ghost-btn"
                onClick={() => resetSlide(selected.id)}
                disabled={!canResetSlide}
                title="discard this slide's changes since the last import/save"
              >
                reset slide
              </button>
              <span className="field-hint">
                revert just this slide to its last imported or saved version.
              </span>
            </div>
          </>
        )
      ) : (
        <p className="empty-note">add a slide to start</p>
      )}
    </div>
  )
}

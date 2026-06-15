import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Download, FileImage, FileText, QrCode, RotateCw } from 'lucide-react';
import { useAppState } from '../app/AppStateContext';
import { useLabelFields } from './label/useLabelFields';
import {
  clamp,
  constrainLabelSettings,
  maxLabelHeightMm,
  maxLabelWidthMm,
  minElementHeightMm,
  minElementWidthMm,
  minLabelHeightMm,
  minLabelWidthMm,
  mmToPx,
  normalizedMarginMm,
  normalizedRotationDeg,
  type ElementResizeMode,
  type LabelResizeMode
} from '../lib/labelLayout';
import { effectivePurchaseLink, exportSingle } from '../lib/export';
import type { ExportFormat } from '../lib/export';
import { buildQrPayload } from '../lib/qr';
import { storageMeta } from '../lib/storage';
import { renderLabelSvg, resolveLabelImageHref } from '../lib/svg';
import { getCatalogEntryForItem } from './hardware/hardwareLogic';
import type { AppState, PlacedField } from '../types';

const PreviewSvgMarkup = memo(({ svg }: { svg: string }) => (
  <div className="label-preview" dangerouslySetInnerHTML={{ __html: svg }} />
));
PreviewSvgMarkup.displayName = 'PreviewSvgMarkup';

const PreviewImageLayer = memo(
  ({
    field,
    href,
    labelWidthMm,
    labelHeightMm
  }: {
    field: PlacedField;
    href: string;
    labelWidthMm: number;
    labelHeightMm: number;
  }) => (
    <img
      className="preview-image-layer"
      src={href}
      alt=""
      draggable={false}
      style={{
        left: `${(field.x / labelWidthMm) * 100}%`,
        top: `${(field.y / labelHeightMm) * 100}%`,
        width: `${(field.width / labelWidthMm) * 100}%`,
        height: `${(field.height / labelHeightMm) * 100}%`,
        transform: `rotate(${field.rotationDeg ?? 0}deg)`
      }}
    />
  )
);
PreviewImageLayer.displayName = 'PreviewImageLayer';

export function PreviewPanel() {
  const { hoveredFieldId, selectedFieldId, selectedId, setHoveredFieldId, setSelectedFieldId, setState, state } = useAppState();
  const { updateField } = useLabelFields();
  const [previewSvg, setPreviewSvg] = useState('');
  const [previewScale, setPreviewScale] = useState(1);
  const [previewImageHrefs, setPreviewImageHrefs] = useState<Record<string, string>>({});
  const [isResizingLabel, setIsResizingLabel] = useState(false);
  const [isResizingElement, setIsResizingElement] = useState(false);
  const [isRotatingElement, setIsRotatingElement] = useState(false);
  const previewStageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    fieldId: string;
    pointerId: number;
    startX: number;
    startY: number;
    fieldX: number;
    fieldY: number;
    moved: boolean;
    wasSelected: boolean;
  } | null>(null);
  const labelResizeRef = useRef<{
    mode: LabelResizeMode;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    widthMm: number;
    heightMm: number;
    scale: number;
  } | null>(null);
  const elementResizeRef = useRef<{
    fieldId: string;
    mode: ElementResizeMode;
    pointerId: number;
    startClientX: number;
    startClientY: number;
    width: number;
    height: number;
    scale: number;
  } | null>(null);
  const elementRotationRef = useRef<{
    fieldId: string;
    pointerId: number;
    centerClientX: number;
    centerClientY: number;
    startAngle: number;
    rotationDeg: number;
  } | null>(null);
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];
  const selectedField = state.labelSettings.fields.find((field) => field.id === selectedFieldId);
  const hoveredField = state.labelSettings.fields.find((field) => field.id === hoveredFieldId);
  const selectedCatalogEntry = getCatalogEntryForItem(selectedItem);
  const selectedSpecUnitSystem = selectedCatalogEntry?.unitSystem ?? state.unitSystem;
  const selectedPurchaseLink = selectedItem ? effectivePurchaseLink(state.purchaseLinks, selectedItem) : '';
  const hasQrElement = state.labelSettings.fields.some((field) => field.kind === 'image' && field.imageSource === 'qr' && field.style.visible);
  const qrInfo = hasQrElement ? buildQrPayload(selectedPurchaseLink) : undefined;
  const previewImageFields = useMemo(
    () => state.labelSettings.fields.filter((field) => field.kind === 'image' && field.style.visible),
    [state.labelSettings.fields]
  );
  const previewImageSignature = useMemo(
    () =>
      JSON.stringify(
        previewImageFields.map((field) => ({
          id: field.id,
          imageSource: field.imageSource,
          imageBase64: field.imageBase64,
          imageMimeType: field.imageMimeType,
          svgStrokeWidth: field.svgStrokeWidth
        }))
      ),
    [previewImageFields]
  );
  const previewBaseWidth = state.labelSettings.widthMm * mmToPx;
  const previewBaseHeight = state.labelSettings.heightMm * mmToPx;
  const labelSettings = state.labelSettings;

  useLayoutEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return;

    const updatePreviewScale = () => {
      const styles = window.getComputedStyle(stage);
      const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const verticalPadding = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
      const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding);
      const availableHeight = Math.max(1, stage.clientHeight - verticalPadding);
      const nextScale = Math.min(availableWidth / previewBaseWidth, availableHeight / previewBaseHeight);

      setPreviewScale(Number.isFinite(nextScale) && nextScale > 0 ? nextScale : 1);
    };

    updatePreviewScale();
    const observer = new ResizeObserver(updatePreviewScale);
    observer.observe(stage);
    window.addEventListener('resize', updatePreviewScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updatePreviewScale);
    };
  }, [previewBaseHeight, previewBaseWidth]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedItem) {
      setPreviewSvg('');
      return;
    }

    renderLabelSvg(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, {
      interactive: true,
      omitImageContent: true
    }).then((svg) => {
      if (!cancelled) {
        setPreviewSvg(svg);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedItem, selectedPurchaseLink, selectedSpecUnitSystem, state.labelSettings]);

  useEffect(() => {
    let cancelled = false;

    if (!selectedItem) {
      setPreviewImageHrefs({});
      return;
    }

    Promise.all(
      previewImageFields.map(async (field) => [field.id, await resolveLabelImageHref(field, selectedItem, selectedPurchaseLink)] as const)
    ).then((entries) => {
      if (!cancelled) {
        setPreviewImageHrefs(Object.fromEntries(entries));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [previewImageSignature, selectedItem, selectedPurchaseLink]);

  useEffect(() => {
    if (!isResizingLabel) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const resize = labelResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      event.preventDefault();
      resizeLabelFromClient(event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const resize = labelResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      labelResizeRef.current = null;
      setIsResizingLabel(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isResizingLabel]);

  useEffect(() => {
    if (!isResizingElement) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const resize = elementResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      event.preventDefault();
      resizeElementFromClient(event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const resize = elementResizeRef.current;
      if (!resize || resize.pointerId !== event.pointerId) return;

      elementResizeRef.current = null;
      setIsResizingElement(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isResizingElement]);

  useEffect(() => {
    if (!isRotatingElement) return;

    const handlePointerMove = (event: globalThis.PointerEvent) => {
      const rotation = elementRotationRef.current;
      if (!rotation || rotation.pointerId !== event.pointerId) return;

      event.preventDefault();
      rotateElementFromClient(event.clientX, event.clientY);
    };

    const handlePointerEnd = (event: globalThis.PointerEvent) => {
      const rotation = elementRotationRef.current;
      if (!rotation || rotation.pointerId !== event.pointerId) return;

      elementRotationRef.current = null;
      setIsRotatingElement(false);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [isRotatingElement]);

  const getPreviewPointerPosition = (event: ReactPointerEvent<HTMLDivElement>) => {
    const svg = previewStageRef.current?.querySelector('.label-preview svg');
    const rect = svg?.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) {
      return null;
    }

    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * state.labelSettings.widthMm, 0, state.labelSettings.widthMm),
      y: clamp(((event.clientY - rect.top) / rect.height) * state.labelSettings.heightMm, 0, state.labelSettings.heightMm)
    };
  };

  const getPreviewFieldId = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target instanceof Element ? event.target : null;
    return target?.closest('[data-field-id]')?.getAttribute('data-field-id') ?? null;
  };

  const handlePreviewPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const fieldId = getPreviewFieldId(event);
    const position = getPreviewPointerPosition(event);
    const field = state.labelSettings.fields.find((candidate) => candidate.id === fieldId);

    if (!fieldId || !position || !field) {
      return;
    }

    if (field.kind === 'frame') {
      event.preventDefault();
      setHoveredFieldId(fieldId);
      setSelectedFieldId((current) => (current === fieldId ? null : fieldId));
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setHoveredFieldId(fieldId);
    setSelectedFieldId(fieldId);
    dragRef.current = {
      fieldId,
      pointerId: event.pointerId,
      startX: position.x,
      startY: position.y,
      fieldX: field.x,
      fieldY: field.y,
      moved: false,
      wasSelected: selectedFieldId === fieldId
    };
  };

  const handlePreviewPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag) {
      const nextHoveredFieldId = getPreviewFieldId(event);
      setHoveredFieldId((current) => (current === nextHoveredFieldId ? current : nextHoveredFieldId));
      return;
    }

    const position = getPreviewPointerPosition(event);
    const field = state.labelSettings.fields.find((candidate) => candidate.id === drag.fieldId);

    if (!position || !field) {
      return;
    }

    const deltaX = position.x - drag.startX;
    const deltaY = position.y - drag.startY;

    if (!drag.moved && Math.hypot(deltaX, deltaY) < 0.25) {
      return;
    }

    drag.moved = true;
    const marginMm = normalizedMarginMm(state.labelSettings);
    const nextX = clamp(drag.fieldX + deltaX, marginMm, Math.max(marginMm, state.labelSettings.widthMm - marginMm - field.width));
    const nextY = clamp(drag.fieldY + deltaY, marginMm, Math.max(marginMm, state.labelSettings.heightMm - marginMm - field.height));

    updateField(drag.fieldId, {
      x: Number(nextX.toFixed(2)),
      y: Number(nextY.toFixed(2))
    });
  };

  const endPreviewDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (dragRef.current?.pointerId === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (drag?.pointerId === event.pointerId && !drag.moved && drag.wasSelected) {
      setSelectedFieldId(null);
    }

    dragRef.current = null;
  };

  const resizeLabelFromClient = (clientX: number, clientY: number) => {
    const resize = labelResizeRef.current;

    if (!resize) return;

    const scale = Math.max(0.01, resize.scale);
    const deltaWidthMm = (clientX - resize.startClientX) / (mmToPx * scale);
    const deltaHeightMm = (clientY - resize.startClientY) / (mmToPx * scale);
    const widthMm =
      resize.mode === 'width' || resize.mode === 'both'
        ? Math.round(clamp(resize.widthMm + deltaWidthMm, minLabelWidthMm, maxLabelWidthMm))
        : resize.widthMm;
    const heightMm =
      resize.mode === 'height' || resize.mode === 'both'
        ? Math.round(clamp(resize.heightMm + deltaHeightMm, minLabelHeightMm, maxLabelHeightMm))
        : resize.heightMm;

    setState((current) => {
      if (current.labelSettings.widthMm === widthMm && current.labelSettings.heightMm === heightMm) {
        return current;
      }

      return {
        ...current,
        labelSettings: constrainLabelSettings({
          ...current.labelSettings,
          layout: 'custom',
          widthMm,
          heightMm
        })
      };
    });
  };

  const handleLabelResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, mode: LabelResizeMode) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedFieldId(null);
    setHoveredFieldId(null);
    setIsResizingLabel(true);
    labelResizeRef.current = {
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      widthMm: state.labelSettings.widthMm,
      heightMm: state.labelSettings.heightMm,
      scale: previewScale
    };
  };

  const resizeElementFromClient = (clientX: number, clientY: number) => {
    const resize = elementResizeRef.current;

    if (!resize) return;

    const field = state.labelSettings.fields.find((candidate) => candidate.id === resize.fieldId);
    if (!field || field.kind === 'frame') return;

    const scale = Math.max(0.01, resize.scale);
    const deltaWidthMm = (clientX - resize.startClientX) / (mmToPx * scale);
    const deltaHeightMm = (clientY - resize.startClientY) / (mmToPx * scale);
    const marginMm = normalizedMarginMm(state.labelSettings);
    const maxWidth = Math.max(minElementWidthMm, state.labelSettings.widthMm - marginMm - field.x);
    const maxHeight = Math.max(minElementHeightMm, state.labelSettings.heightMm - marginMm - field.y);
    const width =
      resize.mode === 'width' || resize.mode === 'both'
        ? Number(clamp(resize.width + deltaWidthMm, minElementWidthMm, maxWidth).toFixed(2))
        : field.width;
    const height =
      resize.mode === 'height' || resize.mode === 'both'
        ? Number(clamp(resize.height + deltaHeightMm, minElementHeightMm, maxHeight).toFixed(2))
        : field.height;

    updateField(resize.fieldId, { width, height });
  };

  const handleElementResizePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, field: PlacedField, mode: ElementResizeMode) => {
    event.preventDefault();
    event.stopPropagation();

    if (field.kind === 'frame') return;

    setSelectedFieldId(field.id);
    setHoveredFieldId(field.id);
    setIsResizingElement(true);
    elementResizeRef.current = {
      fieldId: field.id,
      mode,
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      width: field.width,
      height: field.height,
      scale: previewScale
    };
  };

  const pointerAngleFromCenter = (clientX: number, clientY: number, centerClientX: number, centerClientY: number) =>
    (Math.atan2(clientY - centerClientY, clientX - centerClientX) * 180) / Math.PI;

  const rotateElementFromClient = (clientX: number, clientY: number) => {
    const rotation = elementRotationRef.current;
    if (!rotation) return;

    const angle = pointerAngleFromCenter(clientX, clientY, rotation.centerClientX, rotation.centerClientY);
    const delta = angle - rotation.startAngle;
    updateField(rotation.fieldId, { rotationDeg: normalizedRotationDeg(rotation.rotationDeg + delta) });
  };

  const handleElementRotatePointerDown = (event: ReactPointerEvent<HTMLButtonElement>, field: PlacedField) => {
    event.preventDefault();
    event.stopPropagation();

    if (field.kind !== 'image') return;

    const svg = previewStageRef.current?.querySelector('.label-preview svg');
    const rect = svg?.getBoundingClientRect();

    if (!rect || rect.width === 0 || rect.height === 0) {
      return;
    }

    const centerClientX = rect.left + ((field.x + field.width / 2) / state.labelSettings.widthMm) * rect.width;
    const centerClientY = rect.top + ((field.y + field.height / 2) / state.labelSettings.heightMm) * rect.height;

    setSelectedFieldId(field.id);
    setHoveredFieldId(field.id);
    setIsRotatingElement(true);
    elementRotationRef.current = {
      fieldId: field.id,
      pointerId: event.pointerId,
      centerClientX,
      centerClientY,
      startAngle: pointerAngleFromCenter(event.clientX, event.clientY, centerClientX, centerClientY),
      rotationDeg: field.rotationDeg ?? 0
    };
  };

  if (!selectedItem) {
    return null;
  }

  return (
    <aside className="panel preview-panel">
      <div className="panel-title preview-title">
        <div className="panel-title-main">
          <QrCode size={18} />
          <h2>Preview and export</h2>
        </div>
      </div>
      <div
        className="preview-stage"
        ref={previewStageRef}
        onPointerDown={handlePreviewPointerDown}
        onPointerMove={handlePreviewPointerMove}
        onPointerLeave={() => {
          if (!dragRef.current && !elementResizeRef.current) {
            setHoveredFieldId(null);
          }
        }}
        onPointerCancel={endPreviewDrag}
        onPointerUp={endPreviewDrag}
      >
        <div
          className={[
            'label-preview-shell',
            isResizingLabel ? 'resizing' : '',
            isResizingElement ? 'resizing-element' : '',
            isRotatingElement ? 'rotating-element' : ''
          ].filter(Boolean).join(' ')}
          style={{
            width: `${previewBaseWidth * previewScale}px`,
            height: `${previewBaseHeight * previewScale}px`
          }}
        >
          <PreviewSvgMarkup svg={previewSvg} />
          {previewImageFields.map((field) => {
            const href = previewImageHrefs[field.id];
            if (!href) return null;

            return (
              <PreviewImageLayer
                key={field.id}
                field={field}
                href={href}
                labelWidthMm={labelSettings.widthMm}
                labelHeightMm={labelSettings.heightMm}
              />
            );
          })}
          {hoveredField && hoveredField.id !== selectedField?.id && (
            <div
              className="element-outline-box hovered"
              style={{
                left: `${(hoveredField.x / labelSettings.widthMm) * 100}%`,
                top: `${(hoveredField.y / labelSettings.heightMm) * 100}%`,
                width: `${(hoveredField.width / labelSettings.widthMm) * 100}%`,
                height: `${(hoveredField.height / labelSettings.heightMm) * 100}%`
              }}
            />
          )}
          {selectedField && (
            <div
              className="element-outline-box selected"
              style={{
                left: `${(selectedField.x / labelSettings.widthMm) * 100}%`,
                top: `${(selectedField.y / labelSettings.heightMm) * 100}%`,
                width: `${(selectedField.width / labelSettings.widthMm) * 100}%`,
                height: `${(selectedField.height / labelSettings.heightMm) * 100}%`
              }}
            />
          )}
          {selectedField && selectedField.kind !== 'frame' && (
            <div
              className="element-resize-box"
              style={{
                left: `${(selectedField.x / labelSettings.widthMm) * 100}%`,
                top: `${(selectedField.y / labelSettings.heightMm) * 100}%`,
                width: `${(selectedField.width / labelSettings.widthMm) * 100}%`,
                height: `${(selectedField.height / labelSettings.heightMm) * 100}%`
              }}
            >
              {[
                { mode: 'width' as const, className: 'element-resize-handle width', label: 'Resize selected element width' },
                { mode: 'height' as const, className: 'element-resize-handle height', label: 'Resize selected element height' },
                { mode: 'both' as const, className: 'element-resize-handle both', label: 'Resize selected element width and height' }
              ].map((handle) => (
                <button
                  key={handle.mode}
                  type="button"
                  className={handle.className}
                  aria-label={handle.label}
                  title={handle.label}
                  onPointerDown={(event) => handleElementResizePointerDown(event, selectedField, handle.mode)}
                />
              ))}
              {selectedField.kind === 'image' && (
                <button
                  type="button"
                  className="element-rotate-handle"
                  aria-label="Rotate selected image"
                  title="Rotate selected image"
                  onPointerDown={(event) => handleElementRotatePointerDown(event, selectedField)}
                >
                  <RotateCw size={13} strokeWidth={2.4} />
                </button>
              )}
            </div>
          )}
          {[
            { mode: 'width' as const, className: 'label-resize-handle width', label: 'Resize label width' },
            { mode: 'height' as const, className: 'label-resize-handle height', label: 'Resize label height' },
            { mode: 'both' as const, className: 'label-resize-handle both', label: 'Resize label width and height' }
          ].map((handle) => (
            <button
              key={handle.mode}
              type="button"
              className={handle.className}
              aria-label={handle.label}
              title={handle.label}
              onPointerDown={(event) => handleLabelResizePointerDown(event, handle.mode)}
            />
          ))}
        </div>
      </div>
      {qrInfo?.warning && <p className="warning">{qrInfo.warning}</p>}
      <p className="storage-note">Saved locally under {storageMeta.storageKey}.</p>

      <div className="button-grid">
        <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, 'svg')}>
          <FileText size={16} /> SVG
        </button>
        <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, 'png')}>
          <FileImage size={16} /> PNG
        </button>
        <button type="button" onClick={() => exportSingle(selectedItem, state.labelSettings, selectedPurchaseLink, selectedSpecUnitSystem, 'lbx')}>
          <Download size={16} /> LBX
        </button>
      </div>
    </aside>
  );
}

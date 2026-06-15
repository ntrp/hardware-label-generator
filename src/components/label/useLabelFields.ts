import { defaultFieldStyle, defaultFrameStyle, createId } from '../../lib/defaults';
import {
  autoTextElementHeight,
  constrainFieldToSettings,
  normalizedMarginMm
} from '../../lib/labelLayout';
import { useAppState } from '../../app/AppStateContext';
import type { LabelElementKind, PlacedField } from '../../types';

export function useLabelFields() {
  const { setSelectedFieldId, setState, state } = useAppState();

  const updateField = (fieldId: string, patch: Partial<PlacedField>) => {
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: current.labelSettings.fields.map((field) =>
          field.id === fieldId ? constrainFieldToSettings({ ...field, ...patch }, current.labelSettings) : field
        )
      }
    }));
  };

  const removeField = (fieldId: string) => {
    setState((current) => {
      const fields = current.labelSettings.fields.filter((candidate) => candidate.id !== fieldId);
      return {
        ...current,
        labelSettings: {
          ...current.labelSettings,
          layout: 'custom',
          fields
        }
      };
    });

    setSelectedFieldId((current) => (current === fieldId ? null : current));
  };

  const updateFieldStyle = (fieldId: string, patch: Partial<PlacedField['style']>) => {
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: current.labelSettings.fields.map((field) =>
          field.id === fieldId
            ? constrainFieldToSettings(
                {
                  ...field,
                  height: field.kind === 'text' && patch.fontSize !== undefined ? autoTextElementHeight({ style: { ...field.style, ...patch } }) : field.height,
                  style: { ...field.style, ...patch }
                },
                current.labelSettings
              )
            : field
        )
      }
    }));
  };

  const updateFrameStyle = (fieldId: string, patch: Partial<PlacedField['frameStyle']>) => {
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: current.labelSettings.fields.map((field) =>
          field.id === fieldId ? { ...field, frameStyle: { ...defaultFrameStyle, ...field.frameStyle, ...patch } } : field
        )
      }
    }));
  };

  const updateElementKind = (field: PlacedField, kind: LabelElementKind) => {
    if (kind === 'frame') {
      updateField(field.id, {
        kind,
        text: undefined,
        imageSource: undefined,
        imageBase64: undefined,
        imageMimeType: undefined,
        imageName: undefined,
        x: 0,
        y: 0,
        width: state.labelSettings.widthMm,
        height: state.labelSettings.heightMm,
        frameStyle: { ...defaultFrameStyle, ...field.frameStyle }
      });
      return;
    }

    if (kind === 'image') {
      updateField(field.id, { kind, text: undefined, imageSource: field.imageSource ?? 'qr', frameStyle: undefined });
      return;
    }

    updateField(field.id, {
      kind,
      text: field.text ?? '{standardDin} {standardIso}',
      imageSource: undefined,
      imageBase64: undefined,
      imageMimeType: undefined,
      imageName: undefined,
      frameStyle: undefined
    });
  };

  const appendPlaceholder = (field: PlacedField, placeholder: string) => {
    const currentText = field.text ?? '';
    updateField(field.id, { text: `${currentText}${currentText && !currentText.endsWith(' ') ? ' ' : ''}${placeholder}` });
  };

  const updateCustomImage = async (fieldId: string, file: File | undefined) => {
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedMimeTypes = ['image/bmp', 'image/x-ms-bmp', 'image/png', 'image/svg+xml'];
    const supportedExtensions = ['bmp', 'png', 'svg'];
    if (!supportedMimeTypes.includes(file.type) && !supportedExtensions.includes(extension ?? '')) {
      window.alert('Custom label images must be BMP, PNG, or SVG.');
      return;
    }

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';

    for (let index = 0; index < bytes.length; index += 1) {
      binary += String.fromCharCode(bytes[index]);
    }

    const imageBase64 = btoa(binary);

    updateField(fieldId, {
      imageSource: 'custom',
      imageBase64,
      imageMimeType: file.type || 'application/octet-stream',
      imageName: file.name
    });
  };

  const addField = () => {
    const marginMm = normalizedMarginMm(state.labelSettings);
    const next: PlacedField = {
      id: createId('field'),
      kind: 'text',
      text: '{standardDin} {standardIso}',
      x: marginMm,
      y: marginMm,
      width: 25,
      height: 6,
      style: { ...defaultFieldStyle }
    };
    setState((current) => ({
      ...current,
      labelSettings: {
        ...current.labelSettings,
        layout: 'custom',
        fields: [...current.labelSettings.fields, constrainFieldToSettings(next, current.labelSettings)]
      }
    }));
    setSelectedFieldId(next.id);
  };

  return {
    addField,
    appendPlaceholder,
    removeField,
    updateCustomImage,
    updateElementKind,
    updateField,
    updateFieldStyle,
    updateFrameStyle
  };
}

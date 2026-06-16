import { defaultFieldStyle, defaultFrameStyle, createId } from '../../lib/defaults';
import {
  autoTextElementHeight,
  constrainFieldToSettings,
  normalizedMarginMm
} from '../../lib/labelLayout';
import { useAppState } from '../../app/AppStateContext';
import type { LabelElementKind, PlacedField } from '../../types';

export function useLabelFields() {
  const { selectedId, setSelectedFieldId, setState, state } = useAppState();
  const selectedItem = state.hardwareItems.find((item) => item.id === selectedId) ?? state.hardwareItems[0];
  const labelSettings = selectedItem.labelSettings;

  const updateSelectedLabelSettings = (updater: (settings: typeof labelSettings) => typeof labelSettings) => {
    setState((current) => ({
      ...current,
      hardwareItems: current.hardwareItems.map((item) =>
        item.id === selectedId ? { ...item, labelSettings: updater(item.labelSettings) } : item
      )
    }));
  };

  const updateField = (fieldId: string, patch: Partial<PlacedField>) => {
    updateSelectedLabelSettings((settings) => ({
        ...settings,
        layout: 'custom',
        fields: settings.fields.map((field) =>
          field.id === fieldId ? constrainFieldToSettings({ ...field, ...patch }, settings) : field
        )
      }));
  };

  const removeField = (fieldId: string) => {
    updateSelectedLabelSettings((settings) => ({
      ...settings,
      layout: 'custom',
      fields: settings.fields.filter((candidate) => candidate.id !== fieldId)
    }));

    setSelectedFieldId((current) => (current === fieldId ? null : current));
  };

  const updateFieldStyle = (fieldId: string, patch: Partial<PlacedField['style']>) => {
    updateSelectedLabelSettings((settings) => ({
        ...settings,
        layout: 'custom',
        fields: settings.fields.map((field) =>
          field.id === fieldId
            ? constrainFieldToSettings(
                {
                  ...field,
                  height: field.kind === 'text' && patch.fontSize !== undefined ? autoTextElementHeight({ style: { ...field.style, ...patch } }) : field.height,
                  style: { ...field.style, ...patch }
                },
                settings
              )
            : field
        )
      }));
  };

  const updateFrameStyle = (fieldId: string, patch: Partial<PlacedField['frameStyle']>) => {
    updateSelectedLabelSettings((settings) => ({
        ...settings,
        layout: 'custom',
        fields: settings.fields.map((field) =>
          field.id === fieldId ? { ...field, frameStyle: { ...defaultFrameStyle, ...field.frameStyle, ...patch } } : field
        )
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
        width: labelSettings.widthMm,
        height: labelSettings.heightMm,
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
    const marginMm = normalizedMarginMm(labelSettings);
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
    updateSelectedLabelSettings((settings) => ({
        ...settings,
        layout: 'custom',
        fields: [...settings.fields, constrainFieldToSettings(next, settings)]
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

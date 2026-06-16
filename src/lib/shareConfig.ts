import type { AppState } from '../types';
import { parseBackup, serializeBackup } from './storage';

const shareParam = 'config';
const plainPrefix = 'plain.';
const gzipPrefix = 'gzip.';

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.slice(index, index + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToBytes = (value: string) => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const bytesToArrayBuffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const gzipBytes = async (bytes: Uint8Array) => {
  if (typeof CompressionStream === 'undefined') return undefined;

  const stream = new Blob([bytesToArrayBuffer(bytes)]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const gunzipBytes = async (bytes: Uint8Array) => {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot open compressed share links.');
  }

  const stream = new Blob([bytesToArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
};

const sharedConfigPayloadFromState = async (state: AppState) => {
  const jsonBytes = new TextEncoder().encode(serializeBackup(state));
  const plainPayload = `${plainPrefix}${bytesToBase64Url(jsonBytes)}`;
  const gzippedBytes = await gzipBytes(jsonBytes);
  if (!gzippedBytes) return plainPayload;

  const gzipPayload = `${gzipPrefix}${bytesToBase64Url(gzippedBytes)}`;
  return gzipPayload.length < plainPayload.length ? gzipPayload : plainPayload;
};

export const createShareConfigUrl = async (state: AppState, location: Location = window.location) => {
  const url = new URL(location.href);
  url.hash = '';
  url.searchParams.set(shareParam, await sharedConfigPayloadFromState(state));
  return url.toString();
};

export const sharedConfigPayloadFromLocation = (location: Location = window.location) => new URL(location.href).searchParams.get(shareParam);

export const clearShareConfigFromUrl = (location: Location = window.location, history: History = window.history) => {
  const url = new URL(location.href);
  url.searchParams.delete(shareParam);
  history.replaceState(null, '', url.toString());
};

export const parseShareConfigPayload = async (payload: string) => {
  const isGzip = payload.startsWith(gzipPrefix);
  const encoded = isGzip ? payload.slice(gzipPrefix.length) : payload.startsWith(plainPrefix) ? payload.slice(plainPrefix.length) : payload;
  const bytes = isGzip ? await gunzipBytes(base64UrlToBytes(encoded)) : base64UrlToBytes(encoded);
  return parseBackup(new TextDecoder().decode(bytes));
};

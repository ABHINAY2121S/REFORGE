/**
 * REFORGE shared types.
 *
 * This file merges:
 *   1. The Figma prototype's screen-navigation + UI types (AppState, Screen, UserRole, etc.)
 *   2. Cross-module types derived from the Shared Contract (Session, Device from sidecar)
 *
 * All screen files import from '../types' — keep this as the single source of truth.
 */

// ── Screen navigation (Figma prototype) ───────────────────────────────────────

export type Screen =
  | 'login'
  | 'dashboard'
  | 'devices'
  | 'operation-choice'
  | 'file-scope'
  | 'recovery'
  | 'erase'
  | 'verification'
  | 'audit'
  | 'cases'
  | 'settings';

export type UserRole = 'Investigator' | 'Auditor';
export type OperationType = 'recovery' | 'erase';
export type OperationScope = 'whole-drive' | 'specific-files';

/**
 * Device displayed in the UI. Extends the sidecar Device shape with
 * UI-only fields (name, type, capacity string, partitions list).
 * When devices come from the real sidecar they are adapted by the
 * Devices screen; when mock data is used the full shape is provided.
 */
export interface Device {
  id: string;
  name: string;
  type: 'HDD' | 'SSD' | 'USB' | 'SD';
  capacity: string;
  capacityBytes: number;
  interface: 'SATA' | 'NVMe' | 'USB 3.2' | 'microSD';
  model: string;
  serial: string;
  partitions: { label: string; size: string; fs: string }[];
  encrypted?: boolean;
  hiddenArea?: boolean;
  isSystemDrive?: boolean;
  firmwareStatus?: 'verified' | 'unverified' | 'unreliable';
  // Sidecar-augmented fields:
  is_host_drive?: boolean;
  capabilities?: string[];
  firmware_version?: string;
}

export interface AppState {
  isLoggedIn: boolean;
  currentScreen: Screen;
  userRole: UserRole;
  userName: string;
  activeCaseName: string;
  selectedDevice?: Device;
  operationType?: OperationType;
  operationScope?: OperationScope;
  previousScreen?: Screen;
}

export interface NavigateOptions {
  device?: Device;
  operationType?: OperationType;
  operationScope?: OperationScope;
}

// ── Cross-module / sidecar types ──────────────────────────────────────────────

/** Authenticated session returned by the Python sidecar login command. */
export interface Session {
  userId: string;
  username: string;
  role: 'investigator' | 'auditor';
}

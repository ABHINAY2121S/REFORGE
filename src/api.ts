/**
 * REFORGE frontend <-> Python sidecar bridge.
 *
 * All screens call functions from this file — never invoke() directly.
 * This gives us:
 *   - A single place to mock for tests / Storybook (swap the USE_MOCK flag)
 *   - Type-safe parameter and return shapes
 *   - One place to update if the Tauri command name ever changes
 *
 * The Rust layer exposes a single generic `invoke_python` command that
 * takes { method, params } and dispatches to the Python sidecar. This
 * file wraps every sidecar method in a typed function.
 */

import type { Device } from "./types";

declare global {
  interface Window {
    __TAURI__?: unknown;
  }
}

const IS_TAURI = typeof window !== "undefined" && !!window.__TAURI__;

/** Generic Tauri invoke, lazily imported so plain-browser dev still loads. */
async function _invoke<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  if (!IS_TAURI) {
    throw new Error(
      `[REFORGE] Cannot call '${method}' outside Tauri. ` +
        "Start the app with `npm run tauri dev` rather than `npm run dev`."
    );
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>("invoke_python", { method, params });
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface LoginResult {
  id: string;
  username: string;
  role: "investigator" | "auditor";
}

export async function apiLogin(username: string, password: string): Promise<LoginResult | null> {
  return _invoke<LoginResult | null>("login", { username, password });
}

export async function apiNeedsFirstRun(): Promise<boolean> {
  return _invoke<boolean>("needs_first_run");
}

export async function apiSetupFirstAccount(
  username: string,
  password: string,
  role: "investigator" | "auditor"
): Promise<{ id: string; username: string; role: string }> {
  return _invoke("setup_first_account", { username, password, role });
}

// ── Devices ───────────────────────────────────────────────────────────────────

export async function apiListDevices(): Promise<Device[]> {
  return _invoke<Device[]>("list_devices");
}

export async function apiGetDeviceCapabilities(deviceId: string): Promise<Record<string, unknown>> {
  return _invoke("get_device_capabilities", { deviceId });
}

export async function apiValidateSerialConfirmation(
  deviceId: string,
  input: string
): Promise<boolean> {
  return _invoke<boolean>("validate_serial_confirmation", { deviceId, input });
}

// ── Recovery ─────────────────────────────────────────────────────────────────

export interface RecoveryScope {
  mode: "whole_drive" | "targeted";
  paths?: string[];
}

export async function apiRunFullRecovery(
  deviceId: string,
  scope: RecoveryScope,
  caseId: string,
  userId: string
): Promise<string> {
  return _invoke<string>("run_full_recovery", { deviceId, scope, caseId, userId });
}

export interface RecoveredFile {
  id: string;
  operation_id: string;
  filename: string | null;
  size: number;
  confidence_score: number;
  confidence_tier: "High" | "Medium" | "Low";
  sha256: string;
  file_type: string;
  candidate_group_id: string | null;
}

export async function apiGetRecoveredFiles(operationId: string): Promise<RecoveredFile[]> {
  return _invoke<RecoveredFile[]>("get_recovered_files", { operationId });
}

export async function apiGetFragmentCandidates(
  candidateGroupId: string
): Promise<Record<string, unknown>[]> {
  return _invoke("get_fragment_candidates", { candidateGroupId });
}

export async function apiSelectCandidate(
  candidateGroupId: string,
  fragmentCandidateId: string
): Promise<void> {
  await _invoke("select_candidate", { candidateGroupId, fragmentCandidateId });
}

export interface FilePreview {
  type: "image" | "text" | "pdf" | "unsupported";
  data_base64?: string;
  text?: string;
  file_type: string;
  size: number;
  sha256: string;
}

export async function apiGetFilePreview(fileId: string): Promise<FilePreview> {
  return _invoke<FilePreview>("get_file_preview", { fileId });
}

// ── Erase ─────────────────────────────────────────────────────────────────────

export interface MethodRecommendation {
  method: string;
  reasoning: string;
  is_fallback_flagged: boolean;
}

export async function apiGetRecommendedMethod(deviceId: string): Promise<MethodRecommendation> {
  return _invoke<MethodRecommendation>("get_recommended_method", { deviceId });
}

export async function apiExecuteErase(
  deviceId: string,
  method: string,
  caseId: string,
  userId: string,
  dryRun: boolean = false
): Promise<string> {
  return _invoke<string>("execute_erase", { deviceId, method, caseId, userId, dryRun });
}

export interface FallbackResult {
  fallback_attempted: boolean;
  new_method: string | null;
  final_status: "verified" | "incomplete" | "retrying";
}

export async function apiHandleVerificationFailure(
  operationId: string,
  deviceId: string,
  failedMethod: string
): Promise<FallbackResult> {
  return _invoke<FallbackResult>("handle_verification_failure", {
    operationId,
    deviceId,
    failedMethod,
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export interface DashboardStats {
  activeOperations: number;
  casesOpen: number;
  pendingVerifications: number;
  devicesConnected: number;
}

export async function apiGetDashboardStats(): Promise<DashboardStats> {
  const [stats, devices] = await Promise.all([
    _invoke<Omit<DashboardStats, "devicesConnected">>("get_dashboard_stats"),
    apiListDevices(),
  ]);
  return { ...stats, devicesConnected: devices.length };
}

export async function apiGetRecentOperations(): Promise<Record<string, unknown>[]> {
  return _invoke("get_recent_operations");
}

// ── Firmware Reliability DB ───────────────────────────────────────────────────

export async function apiGetFirmwareReliability(): Promise<Record<string, unknown>[]> {
  return _invoke("get_firmware_reliability");
}

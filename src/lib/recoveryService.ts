import { apiFetch } from './apiClient';
import { AccountRecoveryRequest, AccountRecoveryStatus, RecoveryMessage } from '../types';

export interface SubmitRecoveryPayload {
  fullName: string;
  graduationYear?: string;
  oldEmail: string;
  newEmail: string;
  phone?: string;
  reason: string;
  optionalProofNote?: string;
}

export interface RecoveryResponse {
  success: boolean;
  message: string;
  referenceCode?: string;
  status?: AccountRecoveryStatus;
  ticket?: AccountRecoveryRequest;
}

/**
  Submits a public account recovery request when a member has lost access to their registered email.
 */
export async function submitRecoveryRequest(data: SubmitRecoveryPayload): Promise<RecoveryResponse> {
  const res = await apiFetch('/api/auth/recovery/request', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok && !json.referenceCode) {
    throw new Error(json.message || 'Failed to submit recovery request');
  }
  return json;
}

/**
  Looks up the current status and message thread for a recovery request.
 */
export async function getRecoveryStatus(
  referenceCode: string,
  email?: string,
  phone?: string
): Promise<RecoveryResponse> {
  const params = new URLSearchParams();
  params.set('ref', referenceCode.trim().toUpperCase());
  if (email) params.set('email', email.trim().toLowerCase());
  if (phone) params.set('phone', phone.trim());

  const res = await apiFetch(`/api/auth/recovery/status?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Could not retrieve recovery ticket');
  }
  return json;
}

/**
  Allows applicant to send a message / additional info on their ticket.
 */
export async function sendRecoveryMessage(
  referenceCode: string,
  email: string,
  text: string
): Promise<{ success: boolean; message: string; messages: RecoveryMessage[] }> {
  const res = await apiFetch('/api/auth/recovery/message', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ referenceCode, email, text }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to send message');
  }
  return json;
}

/**
  Super Admin: fetch all recovery requests
 */
export async function fetchAdminRecoveryList(): Promise<AccountRecoveryRequest[]> {
  const res = await apiFetch('/api/auth/recovery/admin/list');
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to fetch recovery requests');
  }
  return json.requests || [];
}

/**
  Super Admin: change ticket state (request info, reject, close)
 */
export async function adminRecoveryAction(
  ticketId: string,
  action: 'request_info' | 'reject' | 'close',
  note?: string,
  messageText?: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/auth/recovery/admin/action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ticketId, action, note, messageText }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to update recovery request');
  }
  return json;
}

/**
  Super Admin: Approve recovery and migrate Firebase Auth email while preserving UID and ledger.
 */
export async function adminApproveRecovery(
  ticketId: string,
  adminNote?: string
): Promise<{ success: boolean; message: string }> {
  const res = await apiFetch('/api/auth/recovery/approve', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ticketId, adminNote }),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.message || 'Failed to approve account recovery');
  }
  return json;
}

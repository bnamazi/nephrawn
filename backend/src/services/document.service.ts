import { DocumentType, Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { prisma } from "../lib/prisma.js";
import { logInteraction } from "./interaction.service.js";
import { getStorageAdapter } from "../adapters/local-storage.adapter.js";

// ============================================
// Types
// ============================================

export type CreateDocumentInput = {
  patientId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type?: DocumentType;
  title?: string;
  notes?: string;
  documentDate?: Date;
};

export type UpdateDocumentInput = {
  title?: string;
  notes?: string;
  documentDate?: Date | null;
  type?: DocumentType;
};

export type DocumentListOptions = {
  type?: DocumentType;
  limit?: number;
  offset?: number;
};

// ============================================
// Patient Functions
// ============================================

/**
 * Create a document record and generate an upload URL.
 * The document is created immediately; the client uploads directly to storage.
 */
export async function createDocumentWithUploadUrl(input: CreateDocumentInput) {
  const storage = getStorageAdapter();

  // Generate a unique storage key
  const fileExtension = input.filename.split(".").pop() || "";
  const storageKey = `${input.patientId}/${randomUUID()}.${fileExtension}`;

  // Create document record
  const document = await prisma.document.create({
    data: {
      patientId: input.patientId,
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      storageKey,
      type: input.type ?? "LAB_RESULT",
      title: input.title,
      notes: input.notes,
      documentDate: input.documentDate,
    },
  });

  // Generate signed upload URL
  const uploadUrl = await storage.generateUploadUrl(storageKey, input.mimeType);

  // Log interaction
  await logInteraction({
    patientId: input.patientId,
    interactionType: "PATIENT_DOCUMENT",
    metadata: {
      documentId: document.id,
      action: "create",
      filename: input.filename,
    } as Prisma.InputJsonValue,
  });

  return {
    document,
    uploadUrl,
  };
}

/**
 * List documents for a patient.
 */
export async function listDocuments(
  patientId: string,
  options?: DocumentListOptions
) {
  const documents = await prisma.document.findMany({
    where: {
      patientId,
      ...(options?.type && { type: options.type }),
    },
    orderBy: { uploadedAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });

  return documents;
}

/**
 * Get a single document with ownership check.
 */
export async function getDocument(documentId: string, patientId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.patientId !== patientId) {
    return null;
  }

  return document;
}

/**
 * Update document metadata.
 */
export async function updateDocument(
  documentId: string,
  patientId: string,
  input: UpdateDocumentInput
) {
  // Verify ownership
  const existing = await getDocument(documentId, patientId);
  if (!existing) {
    return null;
  }

  const document = await prisma.document.update({
    where: { id: documentId },
    data: {
      title: input.title,
      notes: input.notes,
      documentDate: input.documentDate,
      type: input.type,
    },
  });

  await logInteraction({
    patientId,
    interactionType: "PATIENT_DOCUMENT",
    metadata: {
      documentId: document.id,
      action: "update",
    } as Prisma.InputJsonValue,
  });

  return document;
}

/**
 * Generate a download URL for a document.
 */
export async function generateDownloadUrl(documentId: string, patientId: string) {
  const document = await getDocument(documentId, patientId);
  if (!document) {
    return null;
  }

  const storage = getStorageAdapter();
  const downloadUrl = await storage.generateDownloadUrl(document.storageKey);

  return { document, downloadUrl };
}

/**
 * Delete a document and its file.
 */
export async function deleteDocument(documentId: string, patientId: string) {
  const document = await getDocument(documentId, patientId);
  if (!document) {
    return null;
  }

  const storage = getStorageAdapter();

  // Delete file from storage
  await storage.deleteFile(document.storageKey);

  // Delete database record
  await prisma.document.delete({
    where: { id: documentId },
  });

  await logInteraction({
    patientId,
    interactionType: "PATIENT_DOCUMENT",
    metadata: {
      documentId,
      action: "delete",
      filename: document.filename,
    } as Prisma.InputJsonValue,
  });

  return { success: true };
}

// ============================================
// Clinician Functions
// ============================================

/**
 * Get documents for a patient (clinician view).
 * Verifies enrollment before returning documents.
 */
export async function getDocumentsForClinician(
  patientId: string,
  clinicianId: string,
  options?: DocumentListOptions
) {
  // Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinician: {
        id: clinicianId,
      },
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return null;
  }

  const documents = await prisma.document.findMany({
    where: {
      patientId,
      ...(options?.type && { type: options.type }),
    },
    orderBy: { uploadedAt: "desc" },
    take: options?.limit ?? 50,
    skip: options?.offset ?? 0,
  });

  // Log interaction
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_DOCUMENT_VIEW",
    metadata: {
      action: "list",
      documentCount: documents.length,
    } as Prisma.InputJsonValue,
  });

  return documents;
}

/**
 * Get a single document for clinician (with enrollment check).
 */
export async function getDocumentForClinician(
  documentId: string,
  patientId: string,
  clinicianId: string
) {
  // Verify enrollment
  const enrollment = await prisma.enrollment.findFirst({
    where: {
      patientId,
      clinician: {
        id: clinicianId,
      },
      status: "ACTIVE",
    },
  });

  if (!enrollment) {
    return null;
  }

  const document = await prisma.document.findUnique({
    where: { id: documentId },
  });

  if (!document || document.patientId !== patientId) {
    return null;
  }

  return document;
}

/**
 * Generate download URL for clinician (with enrollment check).
 */
export async function generateDownloadUrlForClinician(
  documentId: string,
  patientId: string,
  clinicianId: string
) {
  const document = await getDocumentForClinician(documentId, patientId, clinicianId);
  if (!document) {
    return null;
  }

  const storage = getStorageAdapter();
  const downloadUrl = await storage.generateDownloadUrl(document.storageKey);

  // Log interaction
  await logInteraction({
    patientId,
    clinicianId,
    interactionType: "CLINICIAN_DOCUMENT_VIEW",
    metadata: {
      documentId,
      action: "download",
      filename: document.filename,
    } as Prisma.InputJsonValue,
  });

  return { document, downloadUrl };
}

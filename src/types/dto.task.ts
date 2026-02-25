// src/types/dto.task.ts

export type TaskDTO = {
  task_id: string;
  owner_user_id?: string;
  name?: string;
  status?: string;
  processing_type?: string | null;
  original_image_url?: string | null;
  qr_url?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type CreateTaskIn = {
  name: string;
};

export type MaskCatalogItemDTO = {
  mask_catalog_id?: string;
  key: string;
  display_name: string;
  processing_type: "INTERIOR" | "EXTERIOR" | string;
  active: boolean;
  sort_order: number;
  mask_prompt?: string | null;
  negative_mask_prompt?: string | null;
};

export type TaskMaskDTO = {
  task_mask_id: string;
  task_id: string;
  mask_id: string; // catalog key
  mask_type: string; // INTERIOR/EXTERIOR
  status:
    | "PENDING"
    | "API1_RUNNING"
    | "API1_FAILED"
    | "API2_RUNNING"
    | "API2_FAILED"
    | "COMPLETED"
    | string;

  mask_jpg_url?: string | null;
  mask_png_url?: string | null;

  mask_jpg_asset_url?: string | null;
  mask_png_asset_url?: string | null;

  error_message?: string | null;
};

export type CreateTaskMasksIn = {
  mask_keys: string[];
};

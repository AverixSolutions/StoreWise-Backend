// backend/src/controllers/upload.controller.ts
import { Request, Response } from "express";
import { getPresignedUploadUrl } from "../lib/r2";
import { v4 as uuidv4 } from "uuid";

export const presignProductImage = async (req: Request, res: Response) => {
  try {
    const { licenseId, contentType } = req.body as {
      licenseId: string;
      contentType: string;
    };

    if (!licenseId || !contentType) {
      return res
        .status(400)
        .json({ error: "licenseId and contentType are required" });
    }

    const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowed.includes(contentType)) {
      return res.status(400).json({ error: "Unsupported image type" });
    }

    const ext = contentType.split("/")[1].replace("jpeg", "jpg");
    const key = `products/${licenseId}/${uuidv4()}.${ext}`;

    const { uploadUrl, publicUrl } = await getPresignedUploadUrl({
      key,
      contentType,
    });

    res.json({ uploadUrl, publicUrl, key });
  } catch (err) {
    console.error("❌ Presign error:", err);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
};

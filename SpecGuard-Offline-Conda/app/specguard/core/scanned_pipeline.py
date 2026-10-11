"""
OpenCV-based Scanned Document Preprocessing and Enhancement Pipeline.
Noise removal, deskew, contrast enhancement (CLAHE), adaptive binarization, and local OCR.
"""

import cv2
import numpy as np
import logging
from typing import Tuple, List, Dict, Optional, Any
from specguard.core.models import BBox

logger = logging.getLogger(__name__)


class ScannedDocumentPipeline:
    """
    End-to-end local computer vision pipeline for scanned documents and images.
    Enhances visual quality and extracts bounding-box coordinates.
    """

    @staticmethod
    def preprocess_image(image: np.ndarray) -> np.ndarray:
        """Runs grayscale, noise reduction, and contrast enhancement."""
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()

        # Denoise using bilateral filter to preserve sharp technical edges
        denoised = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

        # Contrast Limited Adaptive Histogram Equalization (CLAHE)
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)

        return enhanced

    @staticmethod
    def deskew_image(image: np.ndarray) -> Tuple[np.ndarray, float]:
        """Calculates skew angle and deskews the page image."""
        # Convert to binary
        thresh = cv2.threshold(image, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]

        # Find coordinates of all foreground pixels
        coords = np.column_stack(np.where(thresh > 0))
        if len(coords) < 100:
            return image, 0.0

        # Minimum bounding rectangle
        rect = cv2.minAreaRect(coords)
        angle = rect[-1]

        # Normalize angle
        if angle < -45:
            angle = -(90 + angle)
        elif angle > 45:
            angle = 90 - angle
        else:
            angle = -angle

        # If angle is very small, skip rotation
        if abs(angle) < 0.2:
            return image, 0.0

        # Rotate image around center
        (h, w) = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        deskewed = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)

        logger.debug("Deskewed image with angle: %.2f degrees", angle)
        return deskewed, angle

    @staticmethod
    def binarize(image: np.ndarray) -> np.ndarray:
        """Adaptive Gaussian thresholding for crisp text segmentation."""
        return cv2.adaptiveThreshold(
            image, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8
        )

    @staticmethod
    def extract_text_regions(binary_image: np.ndarray) -> List[BBox]:
        """Uses morphological dilation to find word/line bounding regions."""
        # Invert so text is white
        inv = 255 - binary_image
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (15, 3))
        dilated = cv2.dilate(inv, kernel, iterations=2)

        contours, _ = cv2.findContours(dilated, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        boxes = []
        h, w = binary_image.shape[:2]

        for cnt in contours:
            x, y, bw, bh = cv2.boundingRect(cnt)
            # Filter out tiny noise and full-page borders
            if bw > 20 and bh > 8 and (bw < w * 0.98 or bh < h * 0.98):
                boxes.append(BBox(x0=float(x), y0=float(y), x1=float(x + bw), y1=float(y + bh)))

        # Sort top-to-bottom, left-to-right
        boxes.sort(key=lambda b: (b.y0 // 20, b.x0))
        return boxes

    @classmethod
    def process_scanned_page(
        cls,
        fitz_page,
        page_num: int,
        dpi: int = 150
    ) -> Tuple[List[Any], List[Any], List[Any], str]:
        """
        Processes an image-only / scanned PDF page where native vector text is zero.
        Renders the page to high-DPI raster image, applies CV denoising, deskewing,
        and thresholding, and runs offline OCR / layout region extraction.
        Returns: (raw_blocks, tables, figures, full_page_text)
        """
        from specguard.core.models import TextBlock, WordModel, LineModel, TableData, FigureData, BBox

        page_w = float(fitz_page.rect.width)
        page_h = float(fitz_page.rect.height)

        raw_blocks: List[TextBlock] = []
        tables: List[TableData] = []
        figures: List[FigureData] = []
        full_text_lines: List[str] = []

        try:
            pix = fitz_page.get_pixmap(dpi=dpi)
            img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            scale_x = page_w / float(pix.width)
            scale_y = page_h / float(pix.height)

            # Preprocessing
            enhanced = cls.preprocess_image(img)
            deskewed, angle = cls.deskew_image(enhanced)
            binary = cls.binarize(deskewed)

            ocr_extracted = False
            # Attempt Tesseract OCR if installed locally
            try:
                import pytesseract
                ocr_data = pytesseract.image_to_data(deskewed, output_type=pytesseract.Output.DICT)
                n_boxes = len(ocr_data.get("text", []))
                
                # Group OCR words by (block_num, line_num)
                grouped: Dict[Tuple[int, int], List[Dict[str, Any]]] = {}
                for i in range(n_boxes):
                    txt = str(ocr_data["text"][i]).strip()
                    if not txt:
                        continue
                    b_num = int(ocr_data["block_num"][i])
                    l_num = int(ocr_data["line_num"][i])
                    grouped.setdefault((b_num, l_num), []).append({
                        "text": txt,
                        "x": float(ocr_data["left"][i]) * scale_x,
                        "y": float(ocr_data["top"][i]) * scale_y,
                        "w": float(ocr_data["width"][i]) * scale_x,
                        "h": float(ocr_data["height"][i]) * scale_y,
                        "conf": float(ocr_data.get("conf", [80])[i])
                    })

                if grouped:
                    block_id = 0
                    for (b_num, l_num), w_items in grouped.items():
                        words = [
                            WordModel(
                                text=wi["text"],
                                bbox=BBox(x0=wi["x"], y0=wi["y"], x1=wi["x"] + wi["w"], y1=wi["y"] + wi["h"]),
                                font_name="OCR-Detected",
                                font_size=round(wi["h"] * 0.75, 1)
                            )
                            for wi in w_items
                        ]
                        line_text = " ".join(wi["text"] for wi in w_items)
                        full_text_lines.append(line_text)
                        lx0 = min(w.bbox.x0 for w in words)
                        ly0 = min(w.bbox.y0 for w in words)
                        lx1 = max(w.bbox.x1 for w in words)
                        ly1 = max(w.bbox.y1 for w in words)
                        line_m = LineModel(
                            words=words,
                            text=line_text,
                            bbox=BBox(x0=lx0, y0=ly0, x1=lx1, y1=ly1),
                            font_size=round((ly1 - ly0) * 0.75, 1)
                        )
                        raw_blocks.append(TextBlock(
                            text=line_text,
                            bbox=BBox(x0=lx0, y0=ly0, x1=lx1, y1=ly1),
                            font_name="OCR-Detected",
                            font_size=round((ly1 - ly0) * 0.75, 1),
                            block_id=block_id,
                            words=words,
                            lines=[line_m]
                        ))
                        block_id += 1
                    ocr_extracted = True
            except Exception as ocr_err:
                logger.debug("Local tesseract OCR not available or failed for page %d: %s", page_num, ocr_err)

            # If OCR was not available or produced 0 words, extract morphological text regions
            if not ocr_extracted or len(raw_blocks) == 0:
                regions = cls.extract_text_regions(binary)
                for b_idx, box in enumerate(regions):
                    rx0 = box.x0 * scale_x
                    ry0 = box.y0 * scale_y
                    rx1 = box.x1 * scale_x
                    ry1 = box.y1 * scale_y
                    placeholder = f"[Scanned Content Region {b_idx + 1}]"
                    full_text_lines.append(placeholder)
                    w_model = WordModel(
                        text=placeholder,
                        bbox=BBox(x0=rx0, y0=ry0, x1=rx1, y1=ry1),
                        font_name="Scanned-Region",
                        font_size=round((ry1 - ry0) * 0.6, 1)
                    )
                    l_model = LineModel(
                        words=[w_model],
                        text=placeholder,
                        bbox=BBox(x0=rx0, y0=ry0, x1=rx1, y1=ry1),
                        font_size=round((ry1 - ry0) * 0.6, 1)
                    )
                    raw_blocks.append(TextBlock(
                        text=placeholder,
                        bbox=BBox(x0=rx0, y0=ry0, x1=rx1, y1=ry1),
                        font_name="Scanned-Region",
                        font_size=round((ry1 - ry0) * 0.6, 1),
                        block_id=b_idx,
                        words=[w_model],
                        lines=[l_model]
                    ))

            # Mark whole-page scanned raster image
            figures.append(FigureData(
                bbox=BBox(x0=0.0, y0=0.0, x1=page_w, y1=page_h),
                page_num=page_num,
                figure_type="scanned_raster_page",
                figure_id=f"scan_p{page_num}",
                confidence=0.99
            ))
            del pix
        except Exception as e:
            logger.error("Failed processing scanned page %d: %s", page_num, e)

        return raw_blocks, tables, figures, "\n".join(full_text_lines)


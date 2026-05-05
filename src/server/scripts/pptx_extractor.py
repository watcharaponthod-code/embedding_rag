import sys
import os
import json
import base64
from io import BytesIO

# Usage: python pptx_extractor.py <path_to_pptx>

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    pptx_path = sys.argv[1]
    
    if not os.path.exists(pptx_path):
        print(json.dumps({"error": "File not found"}))
        sys.exit(1)

    try:
        from pptx import Presentation
        from pptx.enum.shapes import MSO_SHAPE_TYPE
        
        prs = Presentation(pptx_path)
        
        full_text = ""
        all_images = []
        
        # Helper to sort shapes by position (Top -> Bottom, Left -> Right)
        def get_shape_order(shape):
            return (shape.top or 0, shape.left or 0)

        for slide_index, slide in enumerate(prs.slides):
            # Inject Slide/Page Marker (Consistent with PDF logic)
            current_slide_num = slide_index + 1
            full_text += f"\n\n<<PAGE_{current_slide_num}>>\n\n"
            
            # Sort shapes to approximate reading order
            sorted_shapes = sorted(slide.shapes, key=get_shape_order)

            for shape in sorted_shapes:
                # 1. Text Extraction
                if hasattr(shape, "text") and shape.text.strip():
                    text = shape.text.strip()
                    # Check for title/header characteristics (simple heuristic)
                    # In PPTX, titles are usually placeholders, but we can just use markdown based on check
                    full_text += f"{text}\n"

                # 2. Image Extraction
                # Check for Picture (13) or Placeholder Picture
                if shape.shape_type == MSO_SHAPE_TYPE.PICTURE:
                    try:
                        image_blob = shape.image.blob
                        # Encode to Base64
                        base64_str = base64.b64encode(image_blob).decode('utf-8')
                        all_images.append(base64_str)
                        
                        # Add Placeholder
                        full_text += f"\n\n![Image-{len(all_images)}]\n\n"
                    except Exception as img_err:
                        pass # Skip valid images that fail extraction
                
                # Check for shapes with image fill? (Advanced, skip for now to keep it stable)

        output = {
            "full_text": full_text,
            "images": all_images,
            "metadata": {
                "page_count": len(prs.slides),
                "author": prs.core_properties.author or "",
                "title": prs.core_properties.title or ""
            }
        }
            
        sys.stdout.buffer.write(json.dumps(output, ensure_ascii=False).encode('utf-8'))
        sys.exit(0)
        
    except ImportError:
        print(json.dumps({"error": "python-pptx not installed"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

import sys
import os
import json
import base64
from collections import Counter

# Usage: python marker_script.py <path_to_pdf>

def get_font_characteristics(doc):
    """Analyze the document to find the most common font size (body text)."""
    font_counts = Counter()
    
    for page in doc:
        blocks = page.get_text("dict")["blocks"]
        for b in blocks:  
            if b['type'] == 0:  # text
                for l in b["lines"]:
                    for s in l["spans"]:
                        size = round(s['size'], 1)
                        font_counts[size] += len(s['text'].strip())
    
    if not font_counts:
        return 12.0 
        
    body_size = font_counts.most_common(1)[0][0]
    return body_size

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    
    if not os.path.exists(pdf_path):
        print(json.dumps({"error": "File not found"}))
        sys.exit(1)

    try:
        import fitz  # PyMuPDF
        
        doc = fitz.open(pdf_path)
        body_size = get_font_characteristics(doc)
        header_threshold = body_size + 1.5
        
        full_text = ""
        all_images = []
        
        for page_index, page in enumerate(doc):
            # Inject Page Marker (A+ Upgrade)
            current_page_num = page_index + 1
            full_text += f"\n\n<<PAGE_{current_page_num}>>\n\n"
            
            blocks = page.get_text("dict")["blocks"]
            blocks.sort(key=lambda b: (b['bbox'][1], b['bbox'][0]))
            
            for b in blocks:
                # Type 0 = Text
                if b['type'] == 0: 
                    block_text = ""
                    max_size = 0
                    
                    for l in b["lines"]:
                        for s in l["spans"]:
                            block_text += s['text']
                            if s['size'] > max_size:
                                max_size = s['size']
                        block_text += " "
                    
                    block_text = block_text.strip()
                    if not block_text:
                        continue

                    # Markdown Formatting for Headers
                    prefix = ""
                    if max_size >= header_threshold + 4:
                        prefix = "# "
                    elif max_size >= header_threshold:
                        prefix = "## "
                    
                    if prefix:
                        full_text += f"\n\n{prefix}{block_text}\n\n"
                    else:
                        full_text += block_text + "\n"

                # Type 1 = Image
                elif b['type'] == 1:
                    # Filter out small images (Logos/Icons)
                    # bbox = [x0, y0, x1, y1]
                    width = b['bbox'][2] - b['bbox'][0]
                    height = b['bbox'][3] - b['bbox'][1]
                    
                    # Threshold: Ignore if smaller than 100x100 points
                    if width < 100 or height < 100:
                        continue

                    # Extract image bytes
                    image_bytes = b['image']
                    base64_str = base64.b64encode(image_bytes).decode('utf-8')
                    all_images.append(base64_str)
                    # Add placeholder in text
                    full_text += f"\n\n![Image-{len(all_images)}]\n\n"

        # Output standard structure
        output = {
            "full_text": full_text,
            "images": all_images,
            "metadata": {
                "page_count": len(doc),
                "author": doc.metadata.get('author', ''),
                "title": doc.metadata.get('title', '')
            }
        }
            
        sys.stdout.buffer.write(json.dumps(output, ensure_ascii=False).encode('utf-8'))
        sys.exit(0)
        
    except ImportError:
        print(json.dumps({"error": "PyMuPDF not installed"}))
        sys.exit(1)
    except Exception as e:
        # Returning JSON error structure
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

import sys
import os
import json
import base64
from docx import Document
from docx.document import Document as _Document
from docx.oxml.text.paragraph import CT_P
from docx.oxml.table import CT_Tbl
from docx.table import _Cell, Table
from docx.text.paragraph import Paragraph

# Usage: python docx_extractor.py <path_to_docx>

def iter_block_items(parent):
    """
    Yield each paragraph and table child within *parent*, in document order.
    """
    if isinstance(parent, _Document):
        parent_elm = parent.element.body
    elif isinstance(parent, _Cell):
        parent_elm = parent._tc
    else:
        # Should not happen for main Doc body
        return

    for child in parent_elm.iterchildren():
        if isinstance(child, CT_P):
            yield Paragraph(child, parent)
        elif isinstance(child, CT_Tbl):
            yield Table(child, parent)

def get_images_from_paragraph(paragraph, doc):
    """
    Extract images from a paragraph.
    Returns a list of image blobs.
    """
    images = []
    
    # Access the XML element of the paragraph
    p_element = paragraph._element
    
    # Namespace map for XPath
    namespaces = {
        'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
        'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
        'pic': 'http://schemas.openxmlformats.org/drawingml/2006/picture',
        'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
    }

    # Find all drawing elements
    drawings = p_element.findall('.//w:drawing', namespaces)
    
    for drawing in drawings:
        # Find blip elements which contain the relationship ID
        blips = drawing.findall('.//a:blip', namespaces)
        for blip in blips:
            embed_attr = blip.get(f"{{{namespaces['r']}}}embed")
            if embed_attr:
                try:
                    # Retrieve the image part using the relationship ID
                    image_part = doc.part.related_parts[embed_attr]
                    images.append(image_part.blob)
                except KeyError:
                    # Sometimes relation might be missing or handled differently
                    pass
    
    return images

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        sys.exit(1)

    docx_path = sys.argv[1]
    
    if not os.path.exists(docx_path):
        print(json.dumps({"error": "File not found"}))
        sys.exit(1)

    try:
        doc = Document(docx_path)
        
        full_text = ""
        all_images = []
        
        # Start Page Tracking (DOCX doesn't really have pages, but we can simulate or just use one page marker)
        # We'll use a single page marker for now as DOCX is flowable.
        full_text += "<<PAGE_1>>\n\n"

        for block in iter_block_items(doc):
            if isinstance(block, Paragraph):
                text = block.text.strip()
                
                # Check for images in this paragraph
                para_images = get_images_from_paragraph(block, doc)
                
                # Process Text content
                style_name = block.style.name.lower()
                markdown_prefix = ""
                
                if 'heading 1' in style_name or 'title' in style_name:
                    markdown_prefix = "# "
                elif 'heading 2' in style_name or 'subtitle' in style_name:
                    markdown_prefix = "## "
                elif 'heading 3' in style_name:
                    markdown_prefix = "### "
                elif 'heading 4' in style_name:
                    markdown_prefix = "#### "
                
                # Handling List Items
                if 'list' in style_name:
                    markdown_prefix = "- "
                
                # Skip empty text unless it has images
                if text or para_images:
                    if text:
                        full_text += f"\n{markdown_prefix}{text}\n"
                    
                    # Insert Images
                    for img_blob in para_images:
                        base64_str = base64.b64encode(img_blob).decode('utf-8')
                        all_images.append(base64_str)
                        full_text += f"\n\n![Image-{len(all_images)}]\n\n"
                        
            elif isinstance(block, Table):
                # Simple Markdown Table Conversion
                full_text += "\n"
                rows = block.rows
                for i, row in enumerate(rows):
                    row_cells = [cell.text.strip().replace('\n', ' ') for cell in row.cells]
                    full_text += "| " + " | ".join(row_cells) + " |\n"
                    if i == 0:
                        full_text += "| " + " | ".join(['---'] * len(row_cells)) + " |\n"
                full_text += "\n"

        output = {
            "full_text": full_text,
            "images": all_images,
            "metadata": {
                "page_count": 1, # DOCX is flow document
                "author": doc.core_properties.author or "",
                "title": doc.core_properties.title or ""
            }
        }
            
        sys.stdout.buffer.write(json.dumps(output, ensure_ascii=False).encode('utf-8'))
        sys.exit(0)
        
    except Exception as e:
        # Returning JSON error structure
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()

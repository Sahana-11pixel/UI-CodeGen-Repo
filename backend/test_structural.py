import cv2
import numpy as np
from PIL import Image, ImageDraw

def validate_image_ui(img: Image.Image) -> bool:
    """
    Perform structural analysis to reject blank or solid-color images.
    Returns True if valid UI structure is detected, False otherwise.
    """
    # 1. Resolution Check (Min 250x250)
    width, height = img.size
    if width < 250 or height < 250:
        return False

    # 2. Convert PIL to OpenCV format
    if img.mode == 'RGBA':
        img = img.convert('RGB')
    open_cv_image = np.array(img)
    img_bgr = cv2.cvtColor(open_cv_image, cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

    # 3. Structure Detection
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edged = cv2.Canny(blurred, 30, 150)
    contours, _ = cv2.findContours(edged, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    shapes_found = 0
    image_area = width * height
    for cnt in contours:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.04 * peri, True)
        area = cv2.contourArea(cnt)
        if area > 400 and area < 0.95 * image_area:
            if len(approx) >= 4:
                shapes_found += 1

    # 4. Color Uniformity Check (Fallback)
    if shapes_found == 0:
        counts, _ = np.histogram(gray, bins=256, range=(0, 256))
        total_pixels = width * height
        for count in counts:
            if count / total_pixels > 0.99:
                return False 
    return True

def test():
    print("Starting Structural Validation Tests...")
    
    # Test 1: Single Input Box on white (Should PASS)
    img_single_input = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img_single_input)
    # Draw a 300x50 rectangle (centered)
    draw.rectangle([250, 275, 550, 325], outline='black', width=2)
    assert validate_image_ui(img_single_input) == True, "Failed Test 1: Single input box should be accepted"
    print("Test 1 Passed: Single input box accepted.")

    # Test 2: Two centered inputs (Should PASS)
    img_two_inputs = Image.new('RGB', (800, 600), color='white')
    draw = ImageDraw.Draw(img_two_inputs)
    draw.rectangle([250, 250, 550, 290], outline='black', width=2)
    draw.rectangle([250, 310, 550, 350], outline='black', width=2)
    assert validate_image_ui(img_two_inputs) == True, "Failed Test 2: Two inputs should be accepted"
    print("Test 2 Passed: Two inputs accepted.")

    # Test 3: Pure Solid White (Should REJECT)
    img_white = Image.new('RGB', (800, 600), color='white')
    assert validate_image_ui(img_white) == False, "Failed Test 3: Pure white should be rejected"
    print("Test 3 Passed: Pure white rejected.")

    # Test 4: Pure Solid Black (Should REJECT)
    img_black = Image.new('RGB', (800, 600), color='black')
    assert validate_image_ui(img_black) == False, "Failed Test 4: Pure black should be rejected"
    print("Test 4 Passed: Pure black rejected.")

    # Test 5: Dark Theme Single Input (Should PASS)
    img_dark_input = Image.new('RGB', (800, 600), color=(30, 30, 30))
    draw = ImageDraw.Draw(img_dark_input)
    draw.rectangle([250, 275, 550, 325], outline=(200, 200, 200), width=2)
    assert validate_image_ui(img_dark_input) == True, "Failed Test 5: Dark theme input should be accepted"
    print("Test 5 Passed: Dark theme input accepted.")

    print("\nAll structural tests passed!")

if __name__ == "__main__":
    test()

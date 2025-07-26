from PIL import Image
import os

def create_wizard_images(input_png_path, output_dir):
    """
    Creates Inno Setup wizard images (192x192 and 96x96 BMP) from an input PNG.

    Args:
        input_png_path (str): Path to the source PNG image (e.g., zyntel_black.png).
        output_dir (str): Directory where the BMP files will be saved.
    """
    if not os.path.exists(input_png_path):
        print(f"Error: Input PNG '{input_png_path}' not found.")
        return

    os.makedirs(output_dir, exist_ok=True)

    try:
        img = Image.open(input_png_path)
        # Ensure image has an alpha channel if it's black background,
        # otherwise, convert to RGB for BMP saving (BMP doesn't support alpha)
        if img.mode == 'RGBA':
            # Create a white background for the image to blend onto
            # Inno Setup wizard images don't support transparency
            background = Image.new('RGB', img.size, (0, 0, 0)) # Using black background as zyntel_black is dark
            background.paste(img, (0, 0), img)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')


        # Create 192x192 BMP
        wizard_large = img.copy()
        wizard_large.thumbnail((192, 192), Image.Resampling.LANCZOS)
        # Create a new blank image of desired size and paste the thumbnail in the center
        final_large = Image.new("RGB", (192, 192), (0, 0, 0)) # Black background for a dark image
        offset_x = (192 - wizard_large.width) // 2
        offset_y = (192 - wizard_large.height) // 2
        final_large.paste(wizard_large, (offset_x, offset_y))
        output_large_path = os.path.join(output_dir, "YourCompanyWizardImage.bmp")
        final_large.save(output_large_path, format="BMP")
        print(f"Created WizardImageFile: {output_large_path}")

        # Create 96x96 BMP
        wizard_small = img.copy()
        wizard_small.thumbnail((96, 96), Image.Resampling.LANCZOS)
        # Create a new blank image of desired size and paste the thumbnail in the center
        final_small = Image.new("RGB", (96, 96), (0, 0, 0)) # Black background for a dark image
        offset_x = (96 - wizard_small.width) // 2
        offset_y = (96 - wizard_small.height) // 2
        final_small.paste(wizard_small, (offset_x, offset_y))
        output_small_path = os.path.join(output_dir, "YourCompanyHeaderImage.bmp")
        final_small.save(output_small_path, format="BMP")
        print(f"Created WizardSmallImageFile: {output_small_path}")

    except Exception as e:
        print(f"Error creating wizard images: {e}")

if __name__ == "__main__":
    zyntel_png_path = r"F:\zyntel\zyntel-v-1.0\assets\zyntel_black.png" # Assuming zyntel_black.png is in assets
    # You might want to save these BMPs in your 'assets' folder as well, or a new 'installer_assets' folder
    branding_output_dir = r"F:\zyntel\zyntel-v-1.0\assets"
    create_wizard_images(zyntel_png_path, branding_output_dir)
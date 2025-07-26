from PIL import Image
import os

def create_favicon(output_ico_path, light_images, dark_images):
    """
    Creates a .ico file with various sizes and includes both light and dark themes.

    Args:
        output_ico_path (str): The desired path for the output .ico file.
        light_images (dict): A dictionary where keys are image names (e.g., 'vivid_cyan_no_bg')
                             and values are paths to the light theme image files.
        dark_images (dict): A dictionary where keys are image names (e.g., 'black_no_bg')
                            and values are paths to the dark theme image files (fallbacks).
    """

    icon_sizes = [
        (16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (72, 72), (96, 96),
        (128, 128), (192, 192), (256, 256)
    ]

    images_to_save = []

    # Process light theme images
    for img_name, img_path in light_images.items():
        if os.path.exists(img_path):
            try:
                img = Image.open(img_path)
                for size in icon_sizes:
                    resized_img = img.copy()
                    resized_img.thumbnail(size, Image.Resampling.LANCZOS)
                    images_to_save.append(resized_img)
            except Exception as e:
                print(f"Error processing light image {img_path}: {e}")
        else:
            print(f"Light image not found: {img_path}")

    # Process dark theme images (as fallbacks)
    for img_name, img_path in dark_images.items():
        if os.path.exists(img_path):
            try:
                img = Image.open(img_path)
                for size in icon_sizes:
                    resized_img = img.copy()
                    resized_img.thumbnail(size, Image.Resampling.LANCZOS)
                    images_to_save.append(resized_img)
            except Exception as e:
                print(f"Error processing dark image {img_path}: {e}")
        else:
            print(f"Dark image not found: {img_path}")

    if not images_to_save:
        print("No images were successfully processed to create the ICO file.")
        return

    try:
        # Save all collected images into a single .ico file
        # The first image in the list will be the "primary" one,
        # but all will be embedded.
        images_to_save[0].save(
            output_ico_path,
            format="ICO",
            sizes=icon_sizes,
            append_images=images_to_save[1:] # Append all other images
        )
        print(f"Successfully created ICO file: {output_ico_path}")
    except Exception as e:
        print(f"Error saving ICO file: {e}")

if __name__ == "__main__":
    # Define your image paths here.
    # Use raw strings (r"...") for Windows paths
    # or forward slashes (/) instead of backslashes (\).

    dark_theme_images = {
        'vivid_cyan_no_bg': r"F:\zyntel\zyntel-v-1.0\assets\VividCyan(nobg).png",
        'light_gray_no_bg': r"F:\zyntel\zyntel-v-1.0\assets\LightGray(nobg).png"
    }

    light_theme_images = {
        'vivid_cyan_no_bg': r"F:\zyntel\zyntel-v-1.0\assets\VividCyan(nobg).png",
        'vivid_cyan_white_bg': r"F:\zyntel\zyntel-v-1.0\assets\VividCyan(WhiteBackground).png",
        'black_no_bg': r"F:\zyntel\zyntel-v-1.0\assets\Black(nobg).png",
        'black_white_bg': r"F:\zyntel\zyntel-v-1.0\assets\Black(WhiteBackground).png"
    }

    output_file_name = "zyntel_favicon.ico"
    # Make sure this directory path is also a raw string!
    output_directory = r"F:\zyntel\zyntel-v-1.0\assets"
    output_ico_full_path = os.path.join(output_directory, output_file_name)

    create_favicon(output_ico_full_path, light_theme_images, dark_theme_images)

    output_file_name = "zyntel_favicon.ico"
    # You can specify a different output directory if needed
    output_directory = r"F:\zyntel\zyntel-v-1.0\assets"
    output_ico_full_path = os.path.join(output_directory, output_file_name)


    create_favicon(output_ico_full_path, light_theme_images, dark_theme_images)
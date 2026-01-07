#!/usr/bin/env python3
"""
Genera l'icona dell'app Whatis Explorer con logo e testo
Include tutte le dimensioni richieste per iOS
"""

from PIL import Image, ImageDraw, ImageFont
import os
import sys

def create_app_icon(size=1024):
    """
    Crea l'icona dell'app con logo e testo
    """
    # Crea immagine con sfondo bianco
    img = Image.new('RGB', (size, size), color='white')
    draw = ImageDraw.Draw(img)
    
    # Bordo nero sottile (2% della dimensione)
    border_width = max(2, int(size * 0.02))
    draw.rectangle(
        [(border_width, border_width), (size - border_width, size - border_width)],
        outline='black',
        width=border_width
    )
    
    # Area per il logo (circa 60% dell'altezza)
    logo_area_height = int(size * 0.6)
    logo_y_start = int(size * 0.1)
    logo_y_end = logo_y_start + logo_area_height
    
    # Disegna il logo della camera (più dettagliato e visibile)
    camera_width = int(size * 0.55)
    camera_height = int(size * 0.45)
    camera_x = (size - camera_width) // 2
    camera_y = logo_y_start + (logo_area_height - camera_height) // 2
    
    # Corpo della camera (blu vibrante)
    camera_body_color = '#0066CC'  # Blu scuro
    camera_outline_color = '#003366'  # Blu molto scuro
    outline_width = max(2, int(size * 0.012))
    
    # Disegna corpo camera (rettangolo arrotondato)
    corner_radius = int(size * 0.04)
    camera_rect = [camera_x, camera_y, camera_x + camera_width, camera_y + camera_height]
    
    # Disegna corpo principale
    draw.rounded_rectangle(
        camera_rect,
        radius=corner_radius,
        fill=camera_body_color,
        outline=camera_outline_color,
        width=outline_width
    )
    
    # Disegna elementi interni della camera (paesaggio)
    inner_padding = int(size * 0.02)
    inner_rect = [
        camera_x + inner_padding,
        camera_y + inner_padding,
        camera_x + camera_width - inner_padding,
        camera_y + camera_height - inner_padding
    ]
    
    # Cielo (blu chiaro)
    sky_height = int(camera_height * 0.4)
    sky_rect = [inner_rect[0], inner_rect[1], inner_rect[2], inner_rect[1] + sky_height]
    draw.rectangle(sky_rect, fill='#87CEEB', outline=None)
    
    # Terra/acqua (blu scuro)
    ground_y = inner_rect[1] + sky_height
    ground_rect = [inner_rect[0], ground_y, inner_rect[2], inner_rect[3]]
    draw.rectangle(ground_rect, fill='#1E3A8A', outline=None)
    
    # Lighthouse/edificio arancione a sinistra
    building_x = inner_rect[0] + int(camera_width * 0.12)
    building_base_y = ground_y
    building_width = int(camera_width * 0.18)
    building_height = int(camera_height * 0.35)
    
    # Base viola
    base_height = int(building_height * 0.2)
    draw.rectangle(
        [building_x, building_base_y - base_height, building_x + building_width, building_base_y],
        fill='#8B5CF6',  # Viola
        outline=camera_outline_color,
        width=max(1, int(size * 0.004))
    )
    
    # Torre arancione
    tower_rect = [
        building_x,
        building_base_y - building_height,
        building_x + building_width,
        building_base_y - base_height
    ]
    draw.rectangle(
        tower_rect,
        fill='#FF6600',  # Arancione
        outline=camera_outline_color,
        width=max(1, int(size * 0.004))
    )
    
    # Montagne verdi a destra
    mountain_x = inner_rect[0] + int(camera_width * 0.55)
    mountain_base_y = ground_y
    mountain_points = [
        (mountain_x, mountain_base_y),
        (mountain_x + int(camera_width * 0.15), inner_rect[1] + int(sky_height * 0.3)),
        (mountain_x + int(camera_width * 0.25), mountain_base_y)
    ]
    draw.polygon(mountain_points, fill='#00AA00', outline=camera_outline_color)
    
    # Albero verde
    tree_x = mountain_x + int(camera_width * 0.1)
    tree_y = mountain_base_y - int(camera_height * 0.15)
    tree_size = int(size * 0.03)
    # Tronco
    draw.rectangle(
        [tree_x - tree_size//4, tree_y, tree_x + tree_size//4, mountain_base_y],
        fill='#654321',
        outline=None
    )
    # Chioma
    draw.ellipse(
        [tree_x - tree_size//2, tree_y - tree_size//2, tree_x + tree_size//2, tree_y + tree_size//2],
        fill='#228B22',
        outline=None
    )
    
    # Sole giallo
    sun_size = int(size * 0.09)
    sun_x = inner_rect[0] + int(camera_width * 0.7)
    sun_y = inner_rect[1] + int(sky_height * 0.2)
    draw.ellipse(
        [sun_x, sun_y, sun_x + sun_size, sun_y + sun_size],
        fill='#FFD700',  # Giallo
        outline=camera_outline_color,
        width=max(1, int(size * 0.004))
    )
    
    # Location pin centrale (arancione, grande e visibile)
    pin_size = int(size * 0.22)
    pin_x = camera_x + (camera_width - pin_size) // 2
    pin_y = camera_y + (camera_height - pin_size) // 2
    
    # Disegna pin (triangolo con cerchio)
    pin_center_x = pin_x + pin_size // 2
    pin_center_y = pin_y + int(pin_size * 0.55)
    pin_points = [
        (pin_center_x, pin_y + int(pin_size * 0.75)),
        (pin_x + int(pin_size * 0.15), pin_center_y),
        (pin_x + int(pin_size * 0.85), pin_center_y)
    ]
    draw.polygon(pin_points, fill='#FF6600', outline=camera_outline_color, width=outline_width)
    
    # Cerchio bianco nel pin
    circle_size = int(pin_size * 0.45)
    circle_x = pin_center_x - circle_size // 2
    circle_y = pin_center_y - circle_size // 2
    draw.ellipse(
        [circle_x, circle_y, circle_x + circle_size, circle_y + circle_size],
        fill='white',
        outline=camera_outline_color,
        width=max(1, int(size * 0.005))
    )
    
    # Pulsanti sulla camera (linee orizzontali)
    button_y1 = camera_y + int(camera_height * 0.15)
    button_y2 = camera_y + int(camera_height * 0.25)
    button_length = int(camera_width * 0.08)
    button_x1 = camera_x + int(camera_width * 0.1)
    button_x2 = camera_x + int(camera_width * 0.85)
    
    draw.line(
        [(button_x1, button_y1), (button_x1 + button_length, button_y1)],
        fill=camera_outline_color,
        width=max(1, int(size * 0.008))
    )
    draw.line(
        [(button_x2, button_y2), (button_x2 + button_length, button_y2)],
        fill=camera_outline_color,
        width=max(1, int(size * 0.008))
    )
    
    # Testo "WHATIS EXPLORER"
    text_y_start = logo_y_end + int(size * 0.05)
    
    # Prova a caricare un font, altrimenti usa default
    font_size_large = max(12, int(size * 0.12))
    font_size_small = max(10, int(size * 0.10))
    
    font_large = None
    font_small = None
    
    # Prova font system
    font_paths = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/HelveticaNeue.ttc",
    ]
    
    for font_path in font_paths:
        try:
            if font_path.endswith('.ttc'):
                # Per .ttc, prova diversi indici
                for idx in range(3):
                    try:
                        font_large = ImageFont.truetype(font_path, font_size_large, index=idx)
                        font_small = ImageFont.truetype(font_path, font_size_small, index=idx)
                        break
                    except:
                        continue
            else:
                font_large = ImageFont.truetype(font_path, font_size_large)
                font_small = ImageFont.truetype(font_path, font_size_small)
            
            if font_large:
                break
        except:
            continue
    
    # Se non trovato, usa default
    if not font_large:
        try:
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()
        except:
            # Fallback: usa un font di sistema base
            pass
    
    # "WHATIS" in blu scuro
    text1 = "WHATIS"
    text1_color = '#003366'  # Blu molto scuro
    
    if font_large:
        try:
            bbox1 = draw.textbbox((0, 0), text1, font=font_large)
            text1_width = bbox1[2] - bbox1[0]
        except:
            # Fallback: stima larghezza
            text1_width = len(text1) * font_size_large * 0.6
        text1_x = int((size - text1_width) // 2)
        draw.text((text1_x, text_y_start), text1, fill=text1_color, font=font_large)
    else:
        # Fallback senza font
        text1_x = int((size - len(text1) * font_size_large * 0.6) // 2)
        draw.text((text1_x, text_y_start), text1, fill=text1_color)
    
    # "EXPLORER" in blu chiaro/turchese
    text2 = "EXPLORER"
    text2_color = '#00AACC'  # Blu chiaro/turchese
    
    if font_small:
        try:
            bbox2 = draw.textbbox((0, 0), text2, font=font_small)
            text2_width = bbox2[2] - bbox2[0]
        except:
            text2_width = len(text2) * font_size_small * 0.6
        text2_x = int((size - text2_width) // 2)
        text2_y = text_y_start + int(size * 0.15)
        draw.text((text2_x, text2_y), text2, fill=text2_color, font=font_small)
    else:
        text2_x = int((size - len(text2) * font_size_small * 0.6) // 2)
        text2_y = text_y_start + int(size * 0.15)
        draw.text((text2_x, text2_y), text2, fill=text2_color)
    
    return img

def generate_all_sizes():
    """
    Genera tutte le dimensioni richieste per iOS
    """
    base_dir = "WhatisExplorer/Assets.xcassets/AppIcon.appiconset"
    
    # Crea directory se non esiste
    os.makedirs(base_dir, exist_ok=True)
    
    # Dimensioni richieste (in pixel) - CORRETTE per iOS
    sizes = {
        'iOS_AppIcon_40.png': 40,      # 20pt @2x = 40px
        'iOS_AppIcon_58.png': 58,      # 29pt @2x = 58px
        'iOS_AppIcon_60.png': 60,      # 20pt @3x = 60px
        'iOS_AppIcon_80.png': 80,      # 40pt @2x = 80px
        'iOS_AppIcon_87.png': 87,      # 29pt @3x = 87px
        'iOS_AppIcon_120.png': 120,    # 40pt @3x = 120px, 60pt @2x = 120px
        'iOS_AppIcon_180.png': 180,    # 60pt @3x = 180px
        'iOS_AppIcon_76.png': 76,      # 76pt @1x = 76px
        'iOS_AppIcon_152.png': 152,    # 76pt @2x = 152px
        'iOS_AppIcon_167.png': 167,    # 83.5pt @2x = 167px
        'iOS_AppIcon_29.png': 29,      # 29pt @1x = 29px
        'iOS_AppIcon_1024.png': 1024   # App Store = 1024px
    }
    
    print("🎨 Generazione icone Whatis Explorer...")
    
    # Genera icona base 1024x1024
    base_icon = create_app_icon(1024)
    base_icon.save(os.path.join(base_dir, 'iOS_AppIcon_1024.png'), 'PNG')
    print(f"✅ Generata: iOS_AppIcon_1024.png (1024x1024)")
    
    # Genera tutte le altre dimensioni
    for filename, size in sizes.items():
        if filename == 'iOS_AppIcon_1024.png':
            continue  # Già generata
        
        icon = create_app_icon(size)
        icon.save(os.path.join(base_dir, filename), 'PNG')
        print(f"✅ Generata: {filename} ({size}x{size})")
    
    print(f"\n✅ Tutte le icone sono state generate in: {base_dir}")
    print("📱 Ora puoi aprire Xcode e vedere le nuove icone!")

if __name__ == '__main__':
    try:
        generate_all_sizes()
    except ImportError:
        print("❌ Errore: Pillow (PIL) non è installato.")
        print("📦 Installa con: pip3 install Pillow")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Errore durante la generazione: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


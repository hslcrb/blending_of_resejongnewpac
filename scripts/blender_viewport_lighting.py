"""Make the 3D viewport use the scene's authored lights and time-linked world."""
def use_scene_preview(screens):
    changed = 0
    for screen in screens:
        for area in screen.areas:
            if area.type != 'VIEW_3D':
                continue
            shading = area.spaces.active.shading
            shading.type = 'MATERIAL'
            shading.use_scene_lights = True
            shading.use_scene_world = True
            changed += 1
    return changed

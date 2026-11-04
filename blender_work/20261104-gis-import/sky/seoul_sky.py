"""Seoul solar sky for Blender. Execute this Text block to start live updates."""
import bpy, math, datetime
from mathutils import Vector

LAT = math.radians(37.572)
LON = 126.9763
KST = datetime.timezone(datetime.timedelta(hours=9))

def solar(moment):
    t=moment.astimezone(KST); day=t.timetuple().tm_yday
    days=366 if (t.year%4==0 and (t.year%100!=0 or t.year%400==0)) else 365
    h=t.hour+t.minute/60+t.second/3600
    g=2*math.pi/days*(day-1+(h-12)/24)
    eq=229.18*(0.000075+0.001868*math.cos(g)-0.032077*math.sin(g)-0.014615*math.cos(2*g)-0.040849*math.sin(2*g))
    dec=0.006918-0.399912*math.cos(g)+0.070257*math.sin(g)-0.006758*math.cos(2*g)+0.000907*math.sin(2*g)-0.002697*math.cos(3*g)+0.00148*math.sin(3*g)
    mins=(h*60+eq+4*LON-540+1440)%1440
    hour=(mins/4-180)*math.pi/180
    el=math.asin(math.sin(LAT)*math.sin(dec)+math.cos(LAT)*math.cos(dec)*math.cos(hour))
    az=(math.atan2(math.sin(hour),math.cos(hour)*math.sin(LAT)-math.tan(dec)*math.cos(LAT))+math.pi)%(2*math.pi)
    return az,el

def values(scene, moment):
    az,el=solar(moment); north=math.cos(az)*math.cos(el); east=math.sin(az)*math.cos(el)
    vector=Vector((east,north,math.sin(el))) if scene['seoul_sky_axis']=='seoul' else Vector((north,-east,math.sin(el)))
    return az,el,vector

def apply(scene, moment, keyframe=None):
    az,el,direction=values(scene,moment)
    sun=scene.objects.get('Seoul time - Sun')
    if not sun or not scene.world: raise RuntimeError('Seoul sky setup is missing')
    sky=next(n for n in scene.world.node_tree.nodes if n.type=='TEX_SKY')
    background=next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND')
    rotation=(-direction).to_track_quat('-Z','Y').to_euler()
    rotation.make_compatible(sun.rotation_euler)
    sun.rotation_euler=rotation
    sky.sun_elevation=el
    sky_rotation=az+(math.pi/2 if scene['seoul_sky_axis']=='local' else 0)
    if keyframe is not None:
        while sky_rotation-sky.sun_rotation>math.pi: sky_rotation-=2*math.pi
        while sky_rotation-sky.sun_rotation< -math.pi: sky_rotation+=2*math.pi
    sky.sun_rotation=sky_rotation
    daylight=max(0,min(1,(el+0.12)/0.32))
    daylight=daylight*daylight*(3-2*daylight)
    sun.data.energy=max(0,math.sin(el))*2.6
    background.inputs['Strength'].default_value=0.4+0.3*daylight
    fill=scene.objects.get('Seoul time - night fill')
    if fill: fill.data.energy=0.6*(1-daylight)
    night=scene.world.node_tree.nodes.get('Seoul night ambient')
    if night:
        night.outputs['Color'].default_value=(0.05*(1-daylight),0.08*(1-daylight),0.18*(1-daylight),1)
    if keyframe is not None:
        sun.keyframe_insert(data_path='rotation_euler',frame=keyframe)
        sun.data.keyframe_insert(data_path='energy',frame=keyframe)
        sky.keyframe_insert(data_path='sun_elevation',frame=keyframe)
        sky.keyframe_insert(data_path='sun_rotation',frame=keyframe)
        background.inputs['Strength'].keyframe_insert(data_path='default_value',frame=keyframe)
        if fill: fill.data.keyframe_insert(data_path='energy',frame=keyframe)
        if night: night.outputs['Color'].keyframe_insert(data_path='default_value',frame=keyframe)

def start_live():
    old=bpy.app.driver_namespace.get('seoul_live_sky_timer')
    if old and bpy.app.timers.is_registered(old): bpy.app.timers.unregister(old)
    def tick():
        scene=bpy.context.scene
        if scene and scene.get('seoul_sky_axis'):
            try:
                apply(scene,datetime.datetime.now(KST))
                for window in bpy.context.window_manager.windows:
                    for area in window.screen.areas:
                        if area.type=='VIEW_3D': area.tag_redraw()
            except Exception as error: print('Seoul sky update:',error)
        return 60.0
    bpy.app.driver_namespace['seoul_live_sky_timer']=tick
    bpy.app.timers.register(tick,first_interval=0.0,persistent=True)
    print('서울 실시간 하늘 동기화 시작 / Seoul live sky synchronization started')

def stop_live():
    old=bpy.app.driver_namespace.pop('seoul_live_sky_timer',None)
    if old and bpy.app.timers.is_registered(old): bpy.app.timers.unregister(old)

if __name__=='__main__': start_live()
